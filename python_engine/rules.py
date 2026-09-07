import math
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# Definición de Zonas Seguras de la Familia Andrada en San Fernando del Valle de Catamarca
SAFE_ZONES_ANDRADA = [
    {
        "name": "Casa Andrada",
        "latitude": -28.469570,
        "longitude": -65.785240,
        "radius_meters": 250.0
    },
    {
        "name": "Colegio / Escuela",
        "latitude": -28.463200,
        "longitude": -65.781100,
        "radius_meters": 200.0
    },
    {
        "name": "Trabajo / UNCA",
        "latitude": -28.459400,
        "longitude": -65.789100,
        "radius_meters": 300.0
    }
]

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia geodésica exacta en metros usando la fórmula de Haversine."""
    R = 6371000.0  # Radio medio de la Tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class SafetyRuleEngine:
    """Motor de Evaluación de Reglas Críticas para la Familia Andrada."""

    def __init__(self):
        self.device_history: Dict[str, dict] = {}

    def evaluate_telemetry(self, telemetry: dict) -> dict:
        user_id = telemetry.get("user_id", "andrada_member")
        user_name = telemetry.get("user_name", "Miembro Familia Andrada")
        lat = float(telemetry.get("latitude", 0.0))
        lng = float(telemetry.get("longitude", 0.0))
        speed_kmh = float(telemetry.get("speed_kmh", 0.0))
        battery_level = int(telemetry.get("battery_level", 100))
        is_shutdown = bool(telemetry.get("is_shutdown_event", False))
        accelerometer_g = telemetry.get("accelerometer_max_g")
        is_duress = bool(telemetry.get("is_duress_panic", False))
        timestamp = telemetry.get("timestamp", datetime.now().timestamp() * 1000)

        alerts_triggered = []
        severity = "NORMAL"

        # 1. REGLA: Pánico Silencioso por PIN de Coacción
        if is_duress:
            alerts_triggered.append({
                "type": "DURESS_PANIC",
                "severity": "CRITICAL",
                "title": "Alerta de Coacción Silenciosa",
                "detail": f"{user_name} introdujo el PIN de coacción. Grabación de 15s de audio y fotos en curso."
            })
            severity = "CRITICAL"

        # 2. REGLA: Apagado Inminente o Batería Crítica / Baja (<= 15%)
        if is_shutdown or battery_level <= 15:
            if is_shutdown or battery_level <= 3:
                event_type = "SHUTDOWN" if is_shutdown else "CRITICAL_BATTERY"
                alerts_triggered.append({
                    "type": event_type,
                    "severity": "CRITICAL",
                    "title": "Batería Crítica / Apagado Inminente",
                    "detail": f"El equipo de {user_name} está al {battery_level}% o se está apagando. Última posición capturada."
                })
                severity = "CRITICAL"
            else:
                alerts_triggered.append({
                    "type": "LOW_BATTERY_WARNING",
                    "severity": "MEDIUM",
                    "title": "Aviso de Batería Baja (<15%)",
                    "detail": f"El celular de {user_name} está por apagarse ({battery_level}%)."
                })
                if severity == "NORMAL":
                    severity = "MEDIUM"

        # 2b. REGLA: Exceso de Velocidad (>110 km/h)
        if speed_kmh > 110.0:
            alerts_triggered.append({
                "type": "SPEED_EXCESS",
                "severity": "HIGH",
                "title": "Alerta de Exceso de Velocidad",
                "detail": f"{user_name} transita a {speed_kmh:.1f} km/h (supera el umbral de 110 km/h)."
            })
            if severity not in ["CRITICAL"]:
                severity = "HIGH"

        # 2c. REGLA: Temporizador Acompáñame (Safe Walk) Expirado
        is_safe_walk_expired = bool(telemetry.get("is_safe_walk_expired", False))
        if is_safe_walk_expired:
            alerts_triggered.append({
                "type": "SAFE_WALK_EXPIRED",
                "severity": "HIGH",
                "title": "Alerta Preventiva Acompáñame (Safe Walk)",
                "detail": f"{user_name} no confirmó su llegada al destino previsto dentro del tiempo estimado."
            })
            if severity not in ["CRITICAL"]:
                severity = "HIGH"


        # 3. REGLA: Detección de Impacto / Colisión (>40 km/h a 0 en <1.5s o G-force > 4.5G)
        prev_state = self.device_history.get(user_id)
        if prev_state:
            prev_speed = prev_state["speed_kmh"]
            prev_time = prev_state["timestamp"]
            delta_seconds = max(0.1, (timestamp - prev_time) / 1000.0)

            is_deceleration = prev_speed >= 40.0 and speed_kmh <= 5.0 and delta_seconds <= 1.5
            is_g_force = accelerometer_g is not None and accelerometer_g >= 4.5

            if is_deceleration or is_g_force:
                alerts_triggered.append({
                    "type": "IMPACT",
                    "severity": "CRITICAL",
                    "title": "Impacto / Caída Fuerte Detectada",
                    "detail": f"Desaceleración violenta de {prev_speed} a {speed_kmh} km/h en {delta_seconds:.1f}s. Aceleración: {accelerometer_g or 'N/A'}G."
                })
                severity = "CRITICAL"

        # 4. REGLA: Desvío Atípico de Ruta (>1.5 km de Zonas Seguras de la Familia Andrada)
        min_distance = 999999.0
        nearest_zone = "Ninguna"
        is_inside_safe_zone = False

        for zone in SAFE_ZONES_ANDRADA:
            dist = haversine_distance_meters(lat, lng, zone["latitude"], zone["longitude"])
            if dist < min_distance:
                min_distance = dist
                nearest_zone = zone["name"]
            if dist <= zone["radius_meters"]:
                is_inside_safe_zone = True

        if not is_inside_safe_zone and min_distance > 1500.0:
            alerts_triggered.append({
                "type": "ROUTE_DEVIATION",
                "severity": "HIGH",
                "title": "Desvío Atípico de Ruta",
                "detail": f"{user_name} se encuentra a {min_distance/1000.0:.2f} km de la zona segura más cercana ({nearest_zone})."
            })
            if severity != "CRITICAL":
                severity = "HIGH"

        # 5. REGLA: Inmovilidad Anómala fuera de Zonas Seguras (>45 min)
        stationary_since = None
        if prev_state and not is_inside_safe_zone and speed_kmh < 1.0:
            stationary_since = prev_state.get("stationary_since") or timestamp
            duration_minutes = (timestamp - stationary_since) / (1000.0 * 60.0)
            if duration_minutes >= 45.0:
                alerts_triggered.append({
                    "type": "INACTIVITY",
                    "severity": "MEDIUM",
                    "title": "Inmovilidad Anómala Prolongada",
                    "detail": f"Inactivo por {int(duration_minutes)} minutos fuera de zonas seguras."
                })
                if severity not in ["CRITICAL", "HIGH"]:
                    severity = "MEDIUM"
        else:
            stationary_since = timestamp if speed_kmh < 1.0 else None

        # 6. REGLA: Detección de Arrebato en Carrera / Despojo Violento (Edge AI Snatch)
        is_snatch = bool(telemetry.get("is_snatch_event", False))
        gait_anomaly_score = float(telemetry.get("gait_anomaly_score", 0.0))
        if is_snatch or (accelerometer_g is not None and accelerometer_g >= 3.8 and speed_kmh >= 10.0 and gait_anomaly_score > 0.6):
            alerts_triggered.append({
                "type": "SNATCH_THEFT",
                "severity": "CRITICAL",
                "title": "Arrebato de Teléfono en Carrera Detectado",
                "detail": f"Biometría de marcha anómala ({gait_anomaly_score*100:.0f}% anomalía) y aceleración brusca ({accelerometer_g or 4.2:.1f}G). Terminal bloqueado instantáneamente por seguridad."
            })
            severity = "CRITICAL"

        # 7. REGLA: Estrés por Voz Pasivo y Palabras Clave de Coacción
        voice_stress = float(telemetry.get("voice_stress_score", 0.0))
        distress_words = telemetry.get("distress_keywords_detected", [])
        if voice_stress >= 0.75 or distress_words:
            detail_msg = f"Nivel de estrés vocal estimado en {int(voice_stress*100)}%."
            if distress_words:
                detail_msg += f" Palabras clave detectadas: {', '.join(distress_words)}."
            alerts_triggered.append({
                "type": "VOICE_STRESS",
                "severity": "CRITICAL" if voice_stress >= 0.85 or distress_words else "HIGH",
                "title": "Estrés por Voz / Auxilio Detectado",
                "detail": detail_msg
            })
            if severity != "CRITICAL" and (voice_stress >= 0.85 or distress_words):
                severity = "CRITICAL"
            elif severity == "NORMAL":
                severity = "HIGH"

        # 8. REGLA: Último Pulso Satelital Direct-to-Cell
        is_satellite = bool(telemetry.get("is_satellite_pulse", False))
        if is_satellite:
            alerts_triggered.append({
                "type": "SATELLITE_PING",
                "severity": "CRITICAL",
                "title": "Último Pulso Satelital Direct-to-Cell",
                "detail": f"Transmisión de socorro enviada vía órbita satelital sin cobertura celular. Precisión de baliza confirmada."
            })
            severity = "CRITICAL"

        # Guardar en memoria para la próxima evaluación
        self.device_history[user_id] = {
            "latitude": lat,
            "longitude": lng,
            "speed_kmh": speed_kmh,
            "battery_level": battery_level,
            "timestamp": timestamp,
            "stationary_since": stationary_since if speed_kmh < 1.0 else None
        }

        # Generar recomendación de mensaje de WhatsApp
        maps_url = f"https://www.google.com/maps?q={lat:.6f},{lng:.6f}"
        whatsapp_preview = None
        if alerts_triggered:
            top_alert = alerts_triggered[0]
            whatsapp_preview = {
                "recipient": "Contactos de Confianza (Familia Andrada)",
                "header": f"🚨 ALERTA SOS: {top_alert['title']}",
                "body": f"Miembro: {user_name}\nBatería: {battery_level}%\nVelocidad: {speed_kmh:.1f} km/h\nDetalle: {top_alert['detail']}\nUbicación: {maps_url}",
                "quick_reply_button": "ESTOY EN CAMINO (ACK)"
            }

        return {
            "user_id": user_id,
            "user_name": user_name,
            "status": "ALERT" if alerts_triggered else "NORMAL",
            "overall_severity": severity,
            "alerts": alerts_triggered,
            "nearest_safe_zone": nearest_zone,
            "distance_to_safe_zone_meters": round(min_distance, 1),
            "is_inside_safe_zone": is_inside_safe_zone,
            "whatsapp_payload_preview": whatsapp_preview,
            "evaluated_at": datetime.now().isoformat()
        }
