import axios from 'axios';
import { config } from '../config/index.js';

export class TwilioSmsService {
  private readonly endpoint: string;
  private readonly authHeader: string;

  constructor() {
    this.endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  public async sendEmergencySms(toPhoneE164: string, messageBody: string): Promise<{ success: boolean; sid?: string; error?: any }> {
    try {
      const params = new URLSearchParams();
      params.append('To', toPhoneE164);
      params.append('From', config.twilio.fromPhoneNumber);
      params.append('Body', messageBody);

      const response = await axios.post(this.endpoint, params.toString(), {
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 4000
      });

      return { success: true, sid: response.data?.sid };
    } catch (err: any) {
      console.error('[Twilio SMS] Error al enviar SMS de emergencia:', err?.response?.data || err.message);
      return { success: false, error: err?.response?.data || err.message };
    }
  }
}
