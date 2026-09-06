import axios from 'axios';
import { config } from '../config/index.js';

export interface WhatsAppAlertPayload {
  toPhoneNumberE164: string; // Formato E.164 sin signo + (ej: 5491123456789)
  userName: string;
  alertTypeDesc: string;
  batteryLevel: number;
  speedKmh: number;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  alertId: string;
}

export class WhatsAppCloudApiService {
  private readonly endpoint: string;

  constructor() {
    this.endpoint = `${config.metaWhatsApp.apiUrl}/${config.metaWhatsApp.phoneNumberId}/messages`;
  }

  public async sendEmergencyAlertTemplate(data: WhatsAppAlertPayload): Promise<{ success: boolean; messageId?: string; error?: any }> {
    try {
      const sanitizedPhone = data.toPhoneNumberE164.replace(/\D/g, '');

      // Payload oficial para Meta WhatsApp Cloud API v21.0
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: sanitizedPhone,
        type: "template",
        template: {
          name: "emergency_family_alert_v1",
          language: { code: "es" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "location",
                  location: {
                    latitude: data.latitude.toString(),
                    longitude: data.longitude.toString(),
                    name: `SOS: ${data.userName}`,
                    address: `Última posición (Batería: ${data.batteryLevel}%)`
                  }
                }
              ]
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: data.userName },
                { type: "text", text: data.alertTypeDesc },
                { type: "text", text: `${data.batteryLevel}%` },
                { type: "text", text: `${data.speedKmh} km/h` },
                { type: "text", text: data.googleMapsUrl }
              ]
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "0",
              parameters: [
                { type: "payload", payload: `ACK_ALERT_${data.alertId}` }
              ]
            }
          ]
        }
      };

      const response = await axios.post(this.endpoint, payload, {
        headers: {
          Authorization: `Bearer ${config.metaWhatsApp.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 segundos máximo para evitar bloquear el worker
      });

      const messageId = response.data?.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      console.error('[WhatsApp Cloud API] Error al enviar plantilla de alerta:', err?.response?.data || err.message);
      return { success: false, error: err?.response?.data || err.message };
    }
  }
}
