import os
import json
from datetime import datetime
import uvicorn
from fastapi import FastAPI, Query, Response, HTTPException
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web"))
DATA_FILE = os.path.join(BASE_DIR, "data_store.json")

# Montar carpetas estáticas para la Web UI
if os.path.exists(WEB_DIR):
    for sub in ["css", "js", "icons", "img"]:
        sub_path = os.path.join(WEB_DIR, sub)
        if os.path.exists(sub_path):
            app.mount(f"/{sub}", StaticFiles(directory=sub_path), name=sub)

DEFAULT_MEMBERS = [
    {
        "id": "carlos_andrada",
        "name": "Carlos Andrada",
        "dni": "34.567.890",
        "phone": "+54 9 11 2345-6789",
        "pin": "1234",
        "role": "Padre (Protector)",
        "lat": -34.603722,
        "lng": -58.381592,
        "battery": 92,
        "speed": 0.0,
        "zone": "Casa Andrada",
        "avatar": "CA"
    },
    {
        "id": "lucia_andrada",
        "name": "Lucía Andrada",
        "dni": "36.789.012",
        "phone": "+54 9 11 3456-7890",
        "pin": "4321",
        "role": "Madre (Protectora)",
        "lat": -34.605000,
        "lng": -58.380000,
        "battery": 78,
        "speed": 42.5,
        "zone": "En Ruta",
        "avatar": "LA"
    },
    {
        "id": "mateo_andrada",
        "name": "Mateo Andrada",
        "dni": "45.123.456",
        "phone": "+54 9 11 4567-8901",
        "pin": "1122",
        "role": "Hijo",
        "lat": -34.608500,
        "lng": -58.375000,
        "battery": 64,
        "speed": 0.0,
        "zone": "Colegio / Escuela",
        "avatar": "MA"
    },
    {
        "id": "sofia_andrada",
        "name": "Sofía Andrada",
        "dni": "48.987.654",
        "phone": "+54 9 11 5678-9012",
        "pin": "3344",
        "role": "Hija",
        "lat": -34.599000,
        "lng": -58.390000,
        "battery": 45,
        "speed": 0.0,
        "zone": "Trabajo / Oficina",
        "avatar": "SA"
    }
]

def load_data_store() -> dict:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "members": DEFAULT_MEMBERS,
        "check_ins": [],
        "alerts": [],
        "audit_logs": []
    }

def save_data_store(data: dict):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error guardando data_store.json: {e}")

DATA_STORE = load_data_store()

@app.get("/manifest.json")
def get_manifest():
    manifest_file = os.path.join(WEB_DIR, "manifest.json")
    if os.path.exists(manifest_file):
        return FileResponse(manifest_file, media_type="application/manifest+json")
    return {"error": "manifest.json not found"}

@app.get("/sw.js")
def get_service_worker():
    sw_file = os.path.join(WEB_DIR, "sw.js")
    if os.path.exists(sw_file):
        return FileResponse(sw_file, media_type="application/javascript")
    return {"error": "sw.js not found"}

@app.get("/api/health")
@app.get("/api/info")
def system_info():
    return {
        "title": "Familia Andrada",
        "subtitle": "Protección Familiar",
        "system": "Motor de Reglas y Edge AI en Python",
        "status": "ONLINE",
        "version": "2026.1.0",
        "features": ["PWA Ready", "Cloud Multi-User Persistence", "Gait Snatch Detection", "Voice Stress Analysis", "Direct-to-Cell Satellite Ping", "BLE Mesh Tracking"]
    }

@app.get("/api/safe-zones")
def get_safe_zones():
    return {"safe_zones": SAFE_ZONES_ANDRADA}

@app.get("/api/members")
def get_members():
    return {"members": DATA_STORE.get("members", DEFAULT_MEMBERS)}

@app.get("/api/sync")
def get_cloud_sync():
    return {
        "status": "ONLINE",
        "timestamp": datetime.now().isoformat(),
        "members": DATA_STORE.get("members", []),
        "check_ins": DATA_STORE.get("check_ins", [])[-15:],
        "alerts": DATA_STORE.get("alerts", [])[-10:],
        "audit_logs": DATA_STORE.get("audit_logs", [])[-15:]
    }

class RegisterMemberInput(BaseModel):
    name: str
    dni: str
    phone: str
    pin: str
    role: Optional[str] = "Familiar"

@app.post("/api/register")
def register_member(data: RegisterMemberInput):
    members = DATA_STORE.get("members", [])
    initials = "".join([n[0] for n in data.name.split() if n]).upper()[:2] or "FA"
    new_member = {
        "id": f"member_{int(datetime.now().timestamp()*1000)}",
        "name": data.name,
        "dni": data.dni,
        "phone": data.phone,
        "pin": data.pin,
        "role": data.role or "Familiar",
        "lat": -34.603722,
        "lng": -58.381592,
        "battery": 100,
        "speed": 0.0,
        "zone": "Casa Andrada",
        "avatar": initials
    }
    members.append(new_member)
    DATA_STORE["members"] = members
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "member": new_member, "members": members}

class LocationUpdateInput(BaseModel):
    member_id: str
    lat: float
    lng: float
    battery: Optional[int] = 100
    speed: Optional[float] = 0.0
    zone: Optional[str] = "Ubicación en Vivo"

@app.post("/api/location")
def update_member_location(data: LocationUpdateInput):
    members = DATA_STORE.get("members", [])
    updated = False
    for m in members:
        if m["id"] == data.member_id:
            m["lat"] = data.lat
            m["lng"] = data.lng
            m["battery"] = data.battery
            m["speed"] = data.speed
            m["zone"] = data.zone
            updated = True
            break
    if updated:
        save_data_store(DATA_STORE)
        return {"status": "UPDATED", "member_id": data.member_id}
    return {"status": "NOT_FOUND"}

class CheckInInput(BaseModel):
    member_id: str
    status: str
    time: Optional[str] = None

@app.post("/api/check-in")
def receive_check_in(data: CheckInInput):
    item = {
        "member_id": data.member_id,
        "status": data.status,
        "time": data.time or datetime.now().strftime("%H:%M"),
        "received_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("check_ins", []).append(item)
    save_data_store(DATA_STORE)
    return {
        "status": "SUCCESS",
        "message": f"Check-In registrado para {data.member_id}",
        "check_in": item
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
    alert_item = {
        "id": f"alert_{int(datetime.now().timestamp())}",
        "member_id": data.member_id,
        "type": "SILENT_SOS",
        "severity": "CRITICAL",
        "lat": data.lat,
        "lng": data.lng,
        "created_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("alerts", []).append(alert_item)
    save_data_store(DATA_STORE)
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

class GaitInput(BaseModel):
    user_id: str
    g_force: float
    speed_kmh: float
    anomaly_score: float = 0.0
    grip_lost: bool = False

@app.post("/api/edge-ai/evaluate-gait")
def evaluate_gait(data: GaitInput):
    is_theft = data.g_force >= 3.8 and data.speed_kmh >= 10.0 and data.anomaly_score >= 0.6
    action = "LOCK_DEVICE" if is_theft or (data.grip_lost and data.g_force >= 4.0) else "NORMAL"
    return {
        "status": "ALERT" if action == "LOCK_DEVICE" else "NORMAL",
        "action_required": action,
        "threat_level": "CRITICAL" if action == "LOCK_DEVICE" else "LOW",
        "reason": "Arrebato de dispositivo en carrera detectado" if action == "LOCK_DEVICE" else "Marcha normal"
    }

class VoiceStressInput(BaseModel):
    user_id: str
    stress_level: float
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
    entry = {
        "viewer_id": data.viewer_id,
        "target_id": data.target_id,
        "timestamp": data.timestamp or datetime.now().strftime("%H:%M"),
        "logged_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("audit_logs", []).append(entry)
    save_data_store(DATA_STORE)
    return {
        "status": "LOGGED",
        "entry": entry
    }

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
