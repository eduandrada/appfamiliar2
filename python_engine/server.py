import os
from datetime import datetime
import uvicorn
from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
try:
    from rules import SafetyRuleEngine, SAFE_ZONES_ANDRADA
except ImportError:
    from python_engine.rules import SafetyRuleEngine, SAFE_ZONES_ANDRADA


app = FastAPI(
    title="Familia Andrada - Motor de Seguridad Inteligente",
    description="Microservicio en Python para evaluación de reglas espaciales, eventos críticos y servidor Web UI.",
    version="2026.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SafetyRuleEngine()

# Rutas relativas a la carpeta web
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web"))

if os.path.exists(WEB_DIR):
    css_path = os.path.join(WEB_DIR, "css")
    js_path = os.path.join(WEB_DIR, "js")
    if os.path.exists(css_path):
        app.mount("/css", StaticFiles(directory=css_path), name="css")
    if os.path.exists(js_path):
        app.mount("/js", StaticFiles(directory=js_path), name="js")

@app.get("/api/health")
@app.get("/api/info")
def system_info():
    return {
        "title": "Familia Andrada",
        "subtitle": "Protección Familiar",
        "system": "Motor de Reglas y Edge AI en Python",
        "status": "ONLINE",
        "version": "2026.1.0",
        "features": ["Gait Snatch Detection", "Voice Stress Analysis", "Direct-to-Cell Satellite Ping", "BLE Mesh Tracking"]
    }

@app.get("/sw.js")
def get_service_worker():
    sw_file = os.path.join(WEB_DIR, "sw.js")
    if os.path.exists(sw_file):
        return FileResponse(sw_file, media_type="application/javascript")
    return {"error": "sw.js not found"}

@app.get("/api/safe-zones")
def get_safe_zones():
    return {"safe_zones": SAFE_ZONES_ANDRADA}

MEMBERS_DB = [
    {"id": "carlos_andrada", "name": "Carlos Andrada", "dni": "34.567.890", "phone": "+54 9 11 2345-6789", "role": "Padre"},
    {"id": "lucia_andrada", "name": "Lucía Andrada", "dni": "36.789.012", "phone": "+54 9 11 3456-7890", "role": "Madre"},
    {"id": "mateo_andrada", "name": "Mateo Andrada", "dni": "45.123.456", "phone": "+54 9 11 4567-8901", "role": "Hijo"},
    {"id": "sofia_andrada", "name": "Sofía Andrada", "dni": "48.987.654", "phone": "+54 9 11 5678-9012", "role": "Hija"}
]

@app.get("/api/members")
def get_members():
    return {"members": MEMBERS_DB}

class RegisterMemberInput(BaseModel):
    name: str
    dni: str
    phone: str
    pin: str
    role: Optional[str] = "Familiar"

@app.post("/api/register")
def register_member(data: RegisterMemberInput):
    new_member = data.model_dump()
    new_member["id"] = f"member_{len(MEMBERS_DB)+1}"
    MEMBERS_DB.append(new_member)
    return {"status": "SUCCESS", "member": new_member}

class CheckInInput(BaseModel):
    member_id: str
    status: str
    time: Optional[str] = None

@app.post("/api/check-in")
def receive_check_in(data: CheckInInput):
    return {
        "status": "SUCCESS",
        "message": f"Check-In registrado para {data.member_id}",
        "check_in": data.model_dump(),
        "received_at": datetime.now().isoformat()
    }

class SilentSosInput(BaseModel):
    member_id: str
    lat: float
    lng: float
    silent: Optional[bool] = True

@app.post("/api/sos-silent")
def receive_silent_sos(data: SilentSosInput):
    telemetry = {
        "user_id": data.member_id,
        "latitude": data.lat,
        "longitude": data.lng,
        "is_duress_panic": True,
        "timestamp": datetime.now().timestamp() * 1000
    }
    evaluation = engine.evaluate_telemetry(telemetry)
    return {
        "status": "ALERT",
        "type": "SILENT_SOS",
        "severity": "CRITICAL",
        "message": "Alerta silenciosa registrada con éxito",
        "evaluation": evaluation
    }

class TelemetryInput(BaseModel):
    user_id: Optional[str] = "andrada_01"
    user_name: Optional[str] = "Carlos Andrada"
    latitude: float
    longitude: float
    speed_kmh: Optional[float] = 0.0
    battery_level: Optional[int] = 100
    is_shutdown_event: Optional[bool] = False
    accelerometer_max_g: Optional[float] = None
    is_duress_panic: Optional[bool] = False
    is_snatch_event: Optional[bool] = False
    gait_anomaly_score: Optional[float] = 0.0
    voice_stress_score: Optional[float] = 0.0
    distress_keywords_detected: Optional[list] = []
    is_satellite_pulse: Optional[bool] = False
    timestamp: Optional[float] = None

@app.post("/api/evaluate")
@app.post("/v1/telemetry/ping")
def evaluate_telemetry(payload: TelemetryInput):
    result = engine.evaluate_telemetry(payload.model_dump())
    return result

@app.post("/v1/telemetry/emergency-shutdown")
def handle_emergency_shutdown(payload: TelemetryInput):
    data = payload.model_dump()
    data["is_shutdown_event"] = True
    result = engine.evaluate_telemetry(data)
    return {
        "status": "EMERGENCY_SHUTDOWN_LOGGED",
        "evaluation": result
    }

@app.post("/v1/telemetry/duress-panic")
def handle_duress_panic(payload: TelemetryInput):
    data = payload.model_dump()
    data["is_duress_panic"] = True
    result = engine.evaluate_telemetry(data)
    return {
        "status": "DURESS_PANIC_LOGGED",
        "evaluation": result
    }

@app.get("/webhook/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "ANDRADA_FAMILIA_TOKEN")
    if hub_mode == "subscribe" and hub_token == VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    return JSONResponse(status_code=403, content={"error": "Verification token mismatch"})

@app.post("/webhook/whatsapp")
def handle_whatsapp_webhook(data: Dict[str, Any]):
    return {"status": "EVENT_RECEIVED", "received_at": datetime.now().isoformat()}

class GaitInput(BaseModel):
    user_id: str
    g_force: float
    speed_kmh: float
    anomaly_score: float = 0.0
    grip_lost: bool = False

@app.post("/api/edge-ai/evaluate-gait")
def evaluate_gait(data: GaitInput):
    is_theft = data.g_force >= 3.8 and data.speed_kmh >= 10.0 and data.anomaly_score >= 0.6
    action = "LOCK_DEVICE" if is_theft or data.grip_lost and data.g_force >= 4.0 else "NORMAL"
    return {
        "status": "ALERT" if action == "LOCK_DEVICE" else "NORMAL",
        "action_required": action,
        "threat_level": "CRITICAL" if action == "LOCK_DEVICE" else "LOW",
        "reason": "Arrebato de dispositivo en carrera detectado" if action == "LOCK_DEVICE" else "Marcha normal"
    }

class VoiceStressInput(BaseModel):
    user_id: str
    stress_level: float  # 0.0 a 1.0
    distress_words: list = []

@app.post("/api/edge-ai/voice-stress")
def evaluate_voice_stress(data: VoiceStressInput):
    is_distress = data.stress_level >= 0.75 or len(data.distress_words) > 0
    return {
        "status": "ALERT" if is_distress else "NORMAL",
        "severity": "CRITICAL" if data.stress_level >= 0.85 or data.distress_words else "HIGH" if is_distress else "LOW",
        "silent_tracking_activated": is_distress,
        "keywords_detected": data.distress_words
    }

class SatellitePingInput(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    battery_level: int
    compressed_payload: str

@app.post("/api/satellite/ping")
def receive_satellite_ping(data: SatellitePingInput):
    return {
        "status": "SATELLITE_ORBIT_ACK",
        "user_id": data.user_id,
        "coordinates": [data.latitude, data.longitude],
        "battery": data.battery_level,
        "timestamp": datetime.now().isoformat(),
        "mesh_broadcast": True
    }

class BleMeshInput(BaseModel):
    observer_id: str
    detected_beacon: str
    rssi_dbm: int
    estimated_distance_m: float
    lat: float
    lng: float

@app.post("/api/ble-mesh/report")
def report_ble_mesh(data: BleMeshInput):
    return {
        "status": "BEACON_REGISTERED",
        "beacon": data.detected_beacon,
        "proximity_meters": data.estimated_distance_m,
        "located_at": [data.lat, data.lng],
        "registered_at": datetime.now().isoformat()
    }

class PrivacyLogInput(BaseModel):
    viewer_id: str
    target_id: str
    timestamp: Optional[str] = None

@app.post("/api/privacy/log-view")
def log_privacy_view(data: PrivacyLogInput):
    return {
        "status": "LOGGED",
        "viewer_id": data.viewer_id,
        "target_id": data.target_id,
        "logged_at": datetime.now().isoformat()
    }

# Sirve el frontend index.html en la raíz '/'
@app.get("/")
def read_root():
    index_file = os.path.join(WEB_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return system_info()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Iniciando Servidor Web y API Python en http://0.0.0.0:{port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)



