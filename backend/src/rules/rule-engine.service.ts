import { dbPool, redisClient } from '../database/index.js';
import { alertEscalationQueue } from '../queues/escalation.worker.js';

export interface TelemetryEvent {
  userId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  batteryLevel: number;
  isCharging?: boolean;
  networkType?: string;
  isShutdownEvent?: boolean;
  accelerometerMaxG?: number;
  isDuressPanic?: boolean;
  timestamp: number;
}

export class SafetyRuleEngineService {

  public async processTelemetry(event: TelemetryEvent): Promise<void> {
    const { userId, latitude, longitude, speedKmh, batteryLevel, isShutdownEvent, accelerometerMaxG, isDuressPanic, timestamp } = event;

    // 0. Persistencia inmediata en historial de telemetría (PostGIS Point)
    await dbPool.query(
      `INSERT INTO location_history (user_id, coordinates, speed_kmh, battery_level, is_charging, network_type, recorded_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7, to_timestamp($8 / 1000.0))`,
      [userId, longitude, latitude, speedKmh, batteryLevel, event.isCharging || false, event.networkType || '4G', timestamp]
    );

    // 1. REGLA: Pánico por Código de Coacción (Duress PIN)
    if (isDuressPanic) {
      console.warn(`[RuleEngine] ¡PÁNICO POR COACCIÓN activado para usuario ${userId}!`);
      await this.triggerEmergencyAlert(userId, 'DURESS_PANIC', 'CRITICAL', latitude, longitude, batteryLevel, speedKmh, {
        reason: 'Código PIN de coacción introducido en dispositivo'
      });
      return;
    }

    // 2. REGLA: Apagado Inminente o Batería Crítica (<= 3%)
    if (isShutdownEvent || batteryLevel <= 3) {
      console.warn(`[RuleEngine] Evento de Batería Crítica o Apagado para usuario ${userId}. Batería: ${batteryLevel}%`);
      await this.triggerEmergencyAlert(
        userId,
        isShutdownEvent ? 'SHUTDOWN' : 'CRITICAL_BATTERY',
        'CRITICAL',
        latitude,
        longitude,
        batteryLevel,
        speedKmh,
        { batteryLevel, isShutdownEvent }
      );
      return;
    }

    // 3. REGLA: Detección de Impacto Severo o Colisión (>40 km/h a 0 en <1.5s o fuerza G > 4.5G)
    const prevDeviceState = await redisClient.hgetall(`device:state:${userId}`);
    if (prevDeviceState && prevDeviceState.speed) {
      const prevSpeed = parseFloat(prevDeviceState.speed);
      const prevTime = parseInt(prevDeviceState.timestamp, 10);
      const deltaTimeSeconds = (timestamp - prevTime) / 1000.0;

      const isViolentDeceleration = prevSpeed >= 40 && speedKmh <= 5 && deltaTimeSeconds <= 1.5;
      const isHighGImpact = accelerometerMaxG !== undefined && accelerometerMaxG >= 4.5;

      if (isViolentDeceleration || isHighGImpact) {
        console.warn(`[RuleEngine] ¡IMPACTO DETECTADO para usuario ${userId}! Previa: ${prevSpeed}km/h -> Actual: ${speedKmh}km/h en ${deltaTimeSeconds}s. G: ${accelerometerMaxG}`);
        await this.triggerEmergencyAlert(userId, 'IMPACT', 'CRITICAL', latitude, longitude, batteryLevel, speedKmh, {
          initialSpeed: prevSpeed,
          finalSpeed: speedKmh,
          deltaTimeSeconds,
          accelerometerMaxG
        });
      }
    }

    // 4. REGLA: Desvío Atípico de Ruta (>1.5 km de zonas seguras)
    const zoneEval = await this.evaluateSafeZoneDeviation(userId, latitude, longitude);
    if (zoneEval.deviated && zoneEval.distanceMeters > 1500) {
      console.warn(`[RuleEngine] Desvío de ruta detectado: ${zoneEval.distanceMeters.toFixed(0)}m fuera de zonas habituales.`);
      await this.triggerEmergencyAlert(userId, 'ROUTE_DEVIATION', 'HIGH', latitude, longitude, batteryLevel, speedKmh, {
        deviationDistanceMeters: zoneEval.distanceMeters
      });
    }

    // 5. REGLA: Inmovilidad Anómala (>45 min quieto fuera de zonas seguras)
    await this.evaluateInactivity(userId, latitude, longitude, speedKmh, batteryLevel, zoneEval.isInsideAnySafeZone);

    // 6. Actualizar Cache de Estado en Redis (Hash)
    await redisClient.hmset(`device:state:${userId}`, {
      lat: latitude.toString(),
      lng: longitude.toString(),
      speed: speedKmh.toString(),
      battery: batteryLevel.toString(),
      timestamp: timestamp.toString()
    });
    await redisClient.expire(`device:state:${userId}`, 86400); // 24 horas

    // 7. Actualizar Índices Geoespaciales en Redis para cada círculo del usuario
    const circleIds = await this.getUserCircleIds(userId);
    for (const circleId of circleIds) {
      await redisClient.geoadd(`geo:circle:${circleId}`, longitude, latitude, userId);
    }
  }

  private async evaluateSafeZoneDeviation(userId: string, lat: number, lng: number): Promise<{ isInsideAnySafeZone: boolean; deviated: boolean; distanceMeters: number }> {
    const query = `
      SELECT 
        COALESCE(MIN(ST_Distance(center_point, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)), 999999) AS min_distance
      FROM safe_zones
      WHERE user_id = $3;
    `;
    const result = await dbPool.query(query, [lng, lat, userId]);
    const minDistance = parseFloat(result.rows[0]?.min_distance || '0');

    return {
      isInsideAnySafeZone: minDistance <= 250, // Margen de tolerancia residencial/urbano
      deviated: minDistance > 1500,           // Desvío anómalo > 1.5 km
      distanceMeters: minDistance
    };
  }

  private async evaluateInactivity(userId: string, lat: number, lng: number, speedKmh: number, batteryLevel: number, isInsideSafeZone: boolean): Promise<void> {
    const key = `inactivity:tracker:${userId}`;

    if (isInsideSafeZone) {
      await redisClient.del(key);
      return;
    }

    if (speedKmh < 1.0) {
      const firstSeen = await redisClient.get(key);
      const now = Date.now();

      if (!firstSeen) {
        await redisClient.set(key, now.toString());
      } else {
        const stationaryMinutes = (now - parseInt(firstSeen, 10)) / (1000 * 60);
        if (stationaryMinutes >= 45) {
          console.warn(`[RuleEngine] Inmovilidad anómala detectada (${stationaryMinutes.toFixed(0)} min) fuera de zonas seguras.`);
          await this.triggerEmergencyAlert(userId, 'INACTIVITY', 'MEDIUM', lat, lng, batteryLevel, speedKmh, {
            inactivityDurationMinutes: Math.round(stationaryMinutes)
          });
          // Reseteamos el tracker tras disparar la alerta para no spamear
          await redisClient.set(key, (now + 1800000).toString()); // 30 min cooldown
        }
      }
    } else {
      await redisClient.del(key);
    }
  }

  private async triggerEmergencyAlert(
    userId: string,
    alertType: string,
    severity: string,
    latitude: number,
    longitude: number,
    batteryLevel: number,
    speedKmh: number,
    metadata: Record<string, any>
  ): Promise<string> {
    // 1. Guardar en PostgreSQL
    const res = await dbPool.query(
      `INSERT INTO incident_alerts (user_id, alert_type, severity, trigger_coordinates, telemetry_snapshot)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)
       RETURNING id`,
      [userId, alertType, severity, longitude, latitude, JSON.stringify(metadata)]
    );

    const alertId = res.rows[0].id;

    // 2. Despachar a la cola BullMQ con escalamiento automático
    await alertEscalationQueue.add('INIT_ALERT_DISPATCH', {
      alertId,
      userId,
      alertType,
      lat: latitude,
      lng: longitude,
      batteryLevel,
      speedKmh,
      step: 1 // Iniciar con contacto prioritario (Nivel 1)
    });

    return alertId;
  }

  private async getUserCircleIds(userId: string): Promise<string[]> {
    const res = await dbPool.query('SELECT circle_id FROM circle_members WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.circle_id);
  }
}
