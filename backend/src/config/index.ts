import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres_secure_password_2026@localhost:5432/family_safety_db'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
  },
  metaWhatsApp: {
    apiUrl: process.env.META_WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '106555123456789',
    accessToken: process.env.META_WHATSAPP_SYSTEM_USER_TOKEN || 'EAA...',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'seguridad_familiar_webhook_secret_2026'
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'AC_MOCK_SID',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'MOCK_AUTH_TOKEN',
    fromPhoneNumber: process.env.TWILIO_FROM_PHONE || '+1234567890'
  }
};
