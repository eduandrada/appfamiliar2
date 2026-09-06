import { Queue, Worker, Job } from 'bullmq';
import { dbPool, redisClient } from '../database/index.js';
import { config } from '../config/index.js';
import { WhatsAppCloudApiService } from '../notifications/whatsapp-cloud-api.service.js';
import { TwilioSmsService } from '../notifications/twilio-sms.service.js';

export interface EscalationJobData {
  alertId: string;
  userId: string;
  alertType: string;
  lat: number;
  lng: number;
  batteryLevel: number;
  speedKmh: number;
  step: number; // 1 = Primario, 2 = Resto del círculo
}

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port
};

export const alertEscalationQueue = new Queue<EscalationJobData>('ALERT_ESCALATION_QUEUE', {
  connection: redisConnection
});

const waService = new WhatsAppCloudApiService();
const smsService = new TwilioSmsService();

export const escalationWorker = new Worker<EscalationJobData>(
  'ALERT_ESCALATION_QUEUE',
  async (job: Job<EscalationJobData>) => {
    const { alertId, userId, alertType, lat, lng, batteryLevel, speedKmh, step } = job.data;
    console.log(`[EscalationWorker] Procesando nivel ${step} para Alerta ${alertId}`);

    // 1. Verificar estado actual de la alerta en PostgreSQL
    const alertRes = await dbPool.query(
      'SELECT status FROM incident_alerts WHERE id = $1',
      [alertId]
    );

    const currentStatus = alertRes.rows[0]?.status;
    if (!currentStatus || currentStatus === 'ACKNOWLEDGED' || currentStatus === 'RESOLVED') {
      console.log(`[EscalationWorker] Alerta ${alertId} ya confirmada o resuelta (${currentStatus}). Deteniendo cadena.`);
      return;
    }

    // Actualizar estado a 'ESCALATED' si avanzamos del paso 1
    if (step > 1) {
      await dbPool.query("UPDATE incident_alerts SET status = 'ESCALATED' WHERE id = $1", [alertId]);
    }

    // 2. Obtener contactos según nivel de prioridad
    const contactsRes = await dbPool.query(
      `SELECT * FROM emergency_contacts 
       WHERE user_id = $1 AND priority_order = $2`,
      [userId, step]
    );

    const userRes = await dbPool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
    const userName = userRes.rows[0]?.full_name || 'Familiar';
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    if (contactsRes.rows.length === 0) {
      console.log(`[EscalationWorker] No existen más contactos definidos en prioridad ${step}.`);
      return;
    }

    // 3. Despachar a cada contacto en este nivel
    for (const contact of contactsRes.rows) {
      let waDispatched = false;

      // Canal A: WhatsApp Cloud API
      if (contact.receive_whatsapp) {
        const waResult = await waService.sendEmergencyAlertTemplate({
          toPhoneNumberE164: contact.phone_e164,
          userName,
          alertTypeDesc: alertType,
          batteryLevel,
          speedKmh,
          latitude: lat,
          longitude: lng,
          googleMapsUrl,
          alertId
        });

        if (waResult.success) {
          waDispatched = true;
          await dbPool.query(
            `INSERT INTO alert_escalation_logs (alert_id, contact_id, channel, status, provider_message_id)
             VALUES ($1, $2, 'WHATSAPP', 'DISPATCHED', $3)`,
            [alertId, contact.id, waResult.messageId]
          );
        } else {
          console.warn(`[EscalationWorker] Falló WhatsApp a ${contact.phone_e164}. Activando respaldo SMS inmediato.`);
        }
      }

      // Canal B: Twilio SMS Fallback (si falló WhatsApp o no lo tiene habilitado)
      if (!waDispatched && contact.receive_sms) {
        const smsText = `ALERTA SOS 2026: ${userName} envió aviso crítico (${alertType}). Batería: ${batteryLevel}%. Ubicación: ${googleMapsUrl}`;
        const smsResult = await smsService.sendEmergencySms(contact.phone_e164, smsText);

        await dbPool.query(
          `INSERT INTO alert_escalation_logs (alert_id, contact_id, channel, status, provider_message_id)
           VALUES ($1, $2, 'SMS', $3, $4)`,
          [alertId, contact.id, smsResult.success ? 'DISPATCHED' : 'FAILED', smsResult.sid || null]
        );
      }
    }

    // 4. Programar próximo salto jerárquico a los 60 segundos si es el primer nivel
    if (step === 1) {
      console.log(`[EscalationWorker] Contacto primario notificado. Programando escalamiento secundario en 60s.`);
      await alertEscalationQueue.add(
        'ESCALATE_TO_SECONDARY',
        {
          alertId,
          userId,
          alertType,
          lat,
          lng,
          batteryLevel,
          speedKmh,
          step: 2
        },
        { delay: 60000 } // 60 segundos exactos
      );
    }
  },
  { connection: redisConnection }
);
