import sys
import os
import time
import json
from rules import SafetyRuleEngine

# Asegurar UTF-8 en terminal de Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def run_simulation():

    engine = SafetyRuleEngine()
    print("=" * 70)
    print("  FAMILIA ANDRADA - SIMULADOR DE PROTECCIÓN Y EVENTOS CRÍTICOS (PYTHON)")
    print("=" * 70)

    scenarios = [
        {
            "title": "Escenario 1: Carlos Andrada en Casa (Zona Segura)",
            "telemetry": {
                "user_id": "carlos_andrada",
                "user_name": "Carlos Andrada",
                "latitude": -34.603750,
                "longitude": -58.381580,
                "speed_kmh": 0.0,
                "battery_level": 92,
                "is_shutdown_event": False,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 2: Lucía Andrada circulando a 52 km/h (Normal)",
            "telemetry": {
                "user_id": "lucia_andrada",
                "user_name": "Lucía Andrada",
                "latitude": -34.605000,
                "longitude": -58.380000,
                "speed_kmh": 52.0,
                "battery_level": 78,
                "is_shutdown_event": False,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 3: Lucía Andrada sufre Impacto / Colisión (Desaceleración brusca 52 -> 0 km/h y 4.8G)",
            "telemetry": {
                "user_id": "lucia_andrada",
                "user_name": "Lucía Andrada",
                "latitude": -34.605050,
                "longitude": -58.380020,
                "speed_kmh": 0.0,
                "accelerometer_max_g": 4.8,
                "battery_level": 77,
                "is_shutdown_event": False,
                "timestamp": (time.time() + 1.2) * 1000
            }
        },
        {
            "title": "Escenario 4: Mateo Andrada - Desvío Atípico de Ruta (> 2.8 km de Zonas Seguras)",
            "telemetry": {
                "user_id": "mateo_andrada",
                "user_name": "Mateo Andrada",
                "latitude": -34.630000,
                "longitude": -58.420000,
                "speed_kmh": 18.0,
                "battery_level": 45,
                "is_shutdown_event": False,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 5: Sofía Andrada - Batería Crítica (2%) y Apagado Inminente (ACTION_SHUTDOWN)",
            "telemetry": {
                "user_id": "sofia_andrada",
                "user_name": "Sofía Andrada",
                "latitude": -34.608600,
                "longitude": -58.374900,
                "speed_kmh": 0.0,
                "battery_level": 2,
                "is_shutdown_event": True,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 6: Carlos Andrada - Activación de Código PIN de Coacción ('9999')",
            "telemetry": {
                "user_id": "carlos_andrada",
                "user_name": "Carlos Andrada",
                "latitude": -34.603750,
                "longitude": -58.381580,
                "speed_kmh": 0.0,
                "battery_level": 88,
                "is_duress_panic": True,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 7: Protocolo Antifraude - Llamada falsa pidiendo dinero por Mateo Andrada",
            "telemetry": {
                "user_id": "mateo_andrada",
                "user_name": "Mateo Andrada",
                "latitude": -34.608500,
                "longitude": -58.375000,
                "speed_kmh": 0.0,
                "battery_level": 74,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 8: Edge AI - Arrebato en Carrera y Despojo Violento (Snatch Detection)",
            "telemetry": {
                "user_id": "lucia_andrada",
                "user_name": "Lucía Andrada",
                "latitude": -34.606200,
                "longitude": -58.379500,
                "speed_kmh": 14.2,
                "battery_level": 82,
                "accelerometer_max_g": 4.6,
                "is_snatch_event": True,
                "gait_anomaly_score": 0.94,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 9: Conectividad Satelital Direct-to-Cell - Último Pulso de Socorro",
            "telemetry": {
                "user_id": "carlos_andrada",
                "user_name": "Carlos Andrada",
                "latitude": -34.595000,
                "longitude": -58.410000,
                "speed_kmh": 0.0,
                "battery_level": 18,
                "is_satellite_pulse": True,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 10: Temporizador Acompáñame (Safe Walk) Expirado sin confirmación de llegada",
            "telemetry": {
                "user_id": "mateo_andrada",
                "user_name": "Mateo Andrada",
                "latitude": -34.608500,
                "longitude": -58.375000,
                "speed_kmh": 0.0,
                "battery_level": 55,
                "is_safe_walk_expired": True,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 11: Alerta de Telemetría - Batería Baja al 12% (Aviso preventivo)",
            "telemetry": {
                "user_id": "sofia_andrada",
                "user_name": "Sofía Andrada",
                "latitude": -34.599000,
                "longitude": -58.390000,
                "speed_kmh": 0.0,
                "battery_level": 12,
                "timestamp": time.time() * 1000
            }
        },
        {
            "title": "Escenario 12: Seguridad Vial - Exceso de Velocidad a 135 km/h",
            "telemetry": {
                "user_id": "lucia_andrada",
                "user_name": "Lucía Andrada",
                "latitude": -34.620000,
                "longitude": -58.400000,
                "speed_kmh": 135.0,
                "battery_level": 80,
                "timestamp": time.time() * 1000
            }
        }
    ]

    for sc in scenarios:
        print(f"\n▶ {sc['title']}")
        res = engine.evaluate_telemetry(sc["telemetry"])
        status = res["status"]
        severity = res["overall_severity"]
        print(f"  Estado: [{status}] | Severidad: [{severity}] | Zona cercana: {res['nearest_safe_zone']} ({res['distance_to_safe_zone_meters']}m)")
        if res["alerts"]:
            for alert in res["alerts"]:
                print(f"  🚨 ALERTA: {alert['title']} -> {alert['detail']}")
        if res.get("whatsapp_payload_preview"):
            wa = res["whatsapp_payload_preview"]
            print(f"  📲 WHATSAPP A DESPACHAR:")
            print(f"     Destino: {wa['recipient']}")
            print(f"     Cabecera: {wa['header']}")
            print(f"     Cuerpo: {wa['body'].replace(chr(10), ' ')}")
            print(f"     Botón interactivo: [{wa['quick_reply_button']}]")
        time.sleep(0.5)

    print("\n" + "=" * 70)
    print("  SIMULACIÓN COMPLETADA EXITOSAMENTE")
    print("=" * 70)

if __name__ == "__main__":
    run_simulation()
