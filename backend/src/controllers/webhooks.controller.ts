import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/index.js';
import { dbPool } from '../database/index.js';
import axios from 'axios';

export async function verifyWhatsAppWebhook(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as Record<string, string>;
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode === 'subscribe' && token === config.metaWhatsApp.verifyToken) {
    console.log('[WhatsApp Webhook] Verificación de suscripción exitosa de Meta.');
    return reply.status(200).send(challenge);
  }

  return reply.status(403).send({ error: 'Token de verificación inválido' });
}

export async function handleWhatsAppWebhookEvent(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body: any = req.body;

    // Verificar si es un evento de WhatsApp Business Account
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value?.messages) {
            for (const msg of value.messages) {
              await processIncomingWhatsAppMessage(msg, value.metadata?.phone_number_id);
            }
          }
        }
      }
    }

    return reply.status(200).send({ status: 'EVENT_RECEIVED' });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ error: 'Error procesando webhook de WhatsApp' });
  }
}

async function processIncomingWhatsAppMessage(message: any, phoneNumberId: string) {
  const senderPhone = message.from;

  // Detectar si el usuario presionó el botón Quick Reply de confirmación (ACK)
  let buttonPayload = '';
  if (message.type === 'button') {
    buttonPayload = message.button?.payload || '';
  } else if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
    buttonPayload = message.interactive?.button_reply?.id || '';
  }

  if (buttonPayload.startsWith('ACK_ALERT_')) {
    const alertId = buttonPayload.replace('ACK_ALERT_', '');
    console.log(`[WhatsApp Webhook] ¡ALERTA CONFIRMADA (ACK) por contacto ${senderPhone} para Alerta ${alertId}!`);

    // 1. Actualizar estado de la alerta en PostgreSQL para detener la cadena de escalamiento BullMQ
    await dbPool.query(
      `UPDATE incident_alerts 
       SET status = 'ACKNOWLEDGED', resolved_at = NOW() 
       WHERE id = $1`,
      [alertId]
    );

    // 2. Registrar el acuse en la bitácora
    await dbPool.query(
      `UPDATE alert_escalation_logs
       SET status = 'READ', acknowledged_at = NOW()
       WHERE alert_id = $1 AND contact_id IN (
         SELECT id FROM emergency_contacts WHERE phone_e164 LIKE '%' || $2
       )`,
      [alertId, senderPhone.slice(-8)]
    );

    // 3. Enviar mensaje de confirmación al contacto
    await sendTextMessage(phoneNumberId, senderPhone, '✅ Confirmación registrada. Has tomado control de la emergencia familiar.');
  }
}

async function sendTextMessage(phoneNumberId: string, toPhone: string, text: string) {
  try {
    const url = `${config.metaWhatsApp.apiUrl}/${phoneNumberId}/messages`;
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${config.metaWhatsApp.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Fallo enviando mensaje de texto de confirmación:', err?.response?.data || err.message);
  }
}
