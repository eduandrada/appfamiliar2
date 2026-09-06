import { FastifyRequest, FastifyReply } from 'fastify';
import { SafetyRuleEngineService } from '../rules/rule-engine.service.js';
import { TelemetryPayloadSchema } from '@seguridad-familiar/shared';

const ruleEngine = new SafetyRuleEngineService();

export async function handleTelemetryPing(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parseResult = TelemetryPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Payload de telemetría inválido', details: parseResult.error.format() });
    }

    const payload = parseResult.data;
    await ruleEngine.processTelemetry({
      userId: payload.userId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      speedKmh: payload.speedKmh,
      batteryLevel: payload.batteryLevel,
      isCharging: payload.isCharging,
      networkType: payload.networkType,
      isShutdownEvent: payload.isShutdownEvent,
      accelerometerMaxG: payload.accelerometerMaxG,
      timestamp: payload.timestamp
    });

    return reply.status(200).send({ status: 'PROCESSED' });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ error: 'Error interno procesando telemetría' });
  }
}

export async function handleEmergencyShutdown(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body: any = req.body;
    const userId = body.userId || (req as any).user?.id || '00000000-0000-0000-0000-000000000001';

    console.warn(`[TelemetryController] ¡ALERTA DE APAGADO INMINENTE RECIBIDA! Usuario: ${userId}`);

    await ruleEngine.processTelemetry({
      userId,
      latitude: parseFloat(body.latitude) || 0.0,
      longitude: parseFloat(body.longitude) || 0.0,
      speedKmh: 0,
      batteryLevel: parseInt(body.batteryLevel || '2', 10),
      isShutdownEvent: true,
      timestamp: body.timestamp || Date.now()
    });

    return reply.status(200).send({ status: 'SHUTDOWN_ACKNOWLEDGED' });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ error: 'Error registrando apagado crítico' });
  }
}

export async function handleDuressPanic(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body: any = req.body;
    const userId = body.userId || (req as any).user?.id;

    await ruleEngine.processTelemetry({
      userId,
      latitude: parseFloat(body.latitude),
      longitude: parseFloat(body.longitude),
      speedKmh: parseFloat(body.speedKmh || '0'),
      batteryLevel: parseInt(body.batteryLevel || '50', 10),
      isDuressPanic: true,
      timestamp: Date.now()
    });

    return reply.status(200).send({ status: 'DURESS_TRIGGERED_SILENTLY' });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ error: 'Error en pánico por coacción' });
  }
}
