import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { handleTelemetryPing, handleEmergencyShutdown, handleDuressPanic } from './controllers/telemetry.controller.js';
import { verifyWhatsAppWebhook, handleWhatsAppWebhookEvent } from './controllers/webhooks.controller.js';
import { SafetyRuleEngineService } from './rules/rule-engine.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });
const ruleEngine = new SafetyRuleEngineService();

async function bootstrap() {
  await app.register(cors, { origin: '*' });
  await app.register(websocket);

  // Servir la aplicación web HTML (Familia Andrada - Protección Familiar)
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../../web'),
    prefix: '/'
  });

  // Health check
  app.get('/api/health', async () => ({
    title: 'Familia Andrada',
    subtitle: 'Protección Familiar',
    status: 'ONLINE',
    version: '2026.1.0'
  }));

  // Rutas de Telemetría y Emergencia
  app.post('/v1/telemetry/ping', handleTelemetryPing);
  app.post('/v1/telemetry/emergency-shutdown', handleEmergencyShutdown);
  app.post('/v1/telemetry/duress-panic', handleDuressPanic);

  // Rutas de Webhook Meta WhatsApp Cloud API
  app.get('/webhook/whatsapp', verifyWhatsAppWebhook);
  app.post('/webhook/whatsapp', handleWhatsAppWebhookEvent);

  // WebSocket en tiempo real para transmisión continua desde dispositivos móviles
  app.register(async function (fastify) {
    fastify.get('/ws/telemetry', { websocket: true }, (connection, req) => {
      app.log.info('[WebSocket] Nuevo dispositivo móvil conectado.');

      connection.socket.on('message', async (message: any) => {
        try {
          const rawString = message.toString();
          const data = JSON.parse(rawString);

          if (data.type === 'PING') {
            await ruleEngine.processTelemetry(data.payload);
            connection.socket.send(JSON.stringify({ type: 'PONG', receivedAt: Date.now() }));
          }
        } catch (err: any) {
          app.log.error('[WebSocket] Error parseando paquete de telemetría:', err);
        }
      });

      connection.socket.on('close', () => {
        app.log.info('[WebSocket] Dispositivo móvil desconectado.');
      });
    });
  });

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 [Server] Plataforma de Seguridad Familiar corriendo en http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
