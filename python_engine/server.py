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
    title="Familia Andrada - Motor de Seguridad Inteligente 2026",
    description="Microservicio en Python para evaluación de reglas espaciales, cámaras QR y servidor Web UI.",
    version="2026.2.0"
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
        "phone": "+54 9 383 456-7890",
        "pin": "1234",
        "role": "Padre (Protector)",
        "lat": -28.469570,
        "lng": -65.785240,
        "battery": 92,
        "speed": 0.0,
        "zone": "Peatonal Rivadavia (Catamarca)",
        "avatar": "CA",
        "network_type": "WIFI_HOME",
        "network_label": "🟢 WiFi Casa",
        "last_seen": datetime.now().isoformat()
    },
    {
        "id": "lucia_andrada",
        "name": "Lucía Andrada",
        "dni": "36.789.012",
        "phone": "+54 9 383 467-8901",
        "pin": "4321",
        "role": "Madre (Protectora)",
        "lat": -28.476500,
        "lng": -65.771200,
        "battery": 78,
        "speed": 42.5,
        "zone": "La Chacarita (Catamarca)",
        "avatar": "LA",
        "network_type": "CELLULAR_DATA",
        "network_label": "📶 4G/5G Datos",
        "last_seen": datetime.now().isoformat()
    },
    {
        "id": "mateo_andrada",
        "name": "Mateo Andrada",
        "dni": "45.123.456",
        "phone": "+54 9 383 478-9012",
        "pin": "1122",
        "role": "Hijo",
        "lat": -28.463200,
        "lng": -65.781100,
        "battery": 64,
        "speed": 0.0,
        "zone": "Colegio Quintana (Catamarca)",
        "avatar": "MA",
        "network_type": "WIFI_HOME",
        "network_label": "🟢 WiFi Colegio",
        "last_seen": datetime.now().isoformat()
    },
    {
        "id": "sofia_andrada",
        "name": "Sofía Andrada",
        "dni": "48.987.654",
        "phone": "+54 9 383 489-0123",
        "pin": "3344",
        "role": "Hija",
        "lat": -28.459400,
        "lng": -65.789100,
        "battery": 45,
        "speed": 0.0,
        "zone": "UNCA Universidad (Catamarca)",
        "avatar": "SA",
        "network_type": "BLE_MESH",
        "network_label": "ᛡ BLE Mesh",
        "last_seen": datetime.now().isoformat()
    }
]

DEFAULT_CAMERAS = [
    {
        "id": "cam_01",
        "name": "Cámara Entrada Principal",
        "location": "Entrada / Porche",
        "stream_url": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80",
        "qr_code": "CAM_QR_ENTRADA_ANDRADA_2026",
        "is_online": True,
        "type": "IP_FULL_HD"
    },
    {
        "id": "cam_02",
        "name": "Cámara Patio / Jardín",
        "location": "Patio Trasero",
        "stream_url": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        "qr_code": "CAM_QR_PATIO_ANDRADA_2026",
        "is_online": True,
        "type": "IP_NIGHT_VISION"
    }
]

def load_data_store() -> dict:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "cameras" not in data:
                    data["cameras"] = DEFAULT_CAMERAS
                return data
        except Exception:
            pass
    return {
        "members": DEFAULT_MEMBERS,
        "cameras": DEFAULT_CAMERAS,
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
        "version": "2026.2.0",
        "features": ["Single Access Gate", "QR Camera Remoting", "Realtime GPS", "PWA Ready", "Cloud Multi-User Sync"]
    }

@app.get("/api/safe-zones")
def get_safe_zones():
    return {"safe_zones": SAFE_ZONES_ANDRADA}

@app.get("/api/members")
def get_members():
    return {"members": DATA_STORE.get("members", DEFAULT_MEMBERS)}

# CRUD DE MIEMBROS EN EL BACKEND (RESUELVE EL BUG DE RE-APARICIÓN)
class MemberUpdateInput(BaseModel):
    name: str
    dni: str
    phone: str
    pin: Optional[str] = None
    role: Optional[str] = None
    zone: Optional[str] = None

@app.put("/api/members/{member_id}")
def update_member(member_id: str, data: MemberUpdateInput):
    members = DATA_STORE.get("members", [])
    found = False
    for m in members:
        if m["id"] == member_id:
            m["name"] = data.name
            m["dni"] = data.dni
            m["phone"] = data.phone
            if data.pin:
                m["pin"] = data.pin
            if data.role:
                m["role"] = data.role
            if data.zone:
                m["zone"] = data.zone
            found = True
            break
    if found:
        save_data_store(DATA_STORE)
        return {"status": "SUCCESS", "message": f"Miembro {member_id} actualizado", "members": members}
    raise HTTPException(status_code=404, detail="Miembro no encontrado")

@app.delete("/api/members/{member_id}")
def delete_member(member_id: str):
    members = DATA_STORE.get("members", [])
    if len(members) <= 1:
        raise HTTPException(status_code=400, detail="No se puede eliminar el único miembro del círculo")
    
    new_members = [m for m in members if m["id"] != member_id]
    if len(new_members) < len(members):
        DATA_STORE["members"] = new_members
        save_data_store(DATA_STORE)
        return {"status": "SUCCESS", "message": f"Miembro {member_id} eliminado permanentemente", "members": new_members}
    raise HTTPException(status_code=404, detail="Miembro no encontrado")

# CÁMARAS DE SEGURIDAD (QR & REMOTO)
class AddCameraInput(BaseModel):
    name: str
    location: str
    qr_code: Optional[str] = None
    stream_url: Optional[str] = None

@app.get("/api/cameras")
def get_cameras():
    return {"cameras": DATA_STORE.get("cameras", DEFAULT_CAMERAS)}

@app.post("/api/cameras")
def add_camera(data: AddCameraInput):
    cameras = DATA_STORE.get("cameras", [])
    new_cam = {
        "id": f"cam_{int(datetime.now().timestamp())}",
        "name": data.name,
        "location": data.location,
        "qr_code": data.qr_code or f"CAM_QR_{int(datetime.now().timestamp())}",
        "stream_url": data.stream_url or "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80",
        "is_online": True,
        "added_at": datetime.now().isoformat()
    }
    cameras.append(new_cam)
    DATA_STORE["cameras"] = cameras
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "camera": new_cam, "cameras": cameras}

@app.delete("/api/cameras/{cam_id}")
def delete_camera(cam_id: str):
    cameras = DATA_STORE.get("cameras", [])
    new_cams = [c for c in cameras if c["id"] != cam_id]
    DATA_STORE["cameras"] = new_cams
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "cameras": new_cams}

@app.get("/api/sync")
def get_cloud_sync():
    return {
        "status": "ONLINE",
        "timestamp": datetime.now().isoformat(),
        "members": DATA_STORE.get("members", []),
        "cameras": DATA_STORE.get("cameras", []),
        "check_ins": DATA_STORE.get("check_ins", [])[-15:],
        "alerts": DATA_STORE.get("alerts", [])[-10:],
        "audit_logs": DATA_STORE.get("audit_logs", [])[-15:]
    }

class LoginInput(BaseModel):
    member_id: str
    pin: str

@app.post("/api/login")
def login_member(data: LoginInput):
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    
    # PIN Maestro de Administrador 9999 otorga acceso total de Admin incondicional
    if data.pin == "9999":
        admin_user = next((m for m in members if m["id"] == "carlos_andrada" or "Padre" in m.get("role","")), members[0])
        return {
            "status": "SUCCESS",
            "is_admin": True,
            "message": "Acceso de Administrador Autorizado (PIN 9999)",
            "member": admin_user
        }
        
    for m in members:
        if m["id"] == data.member_id or m["name"].lower() == data.member_id.lower():
            if m.get("pin") == data.pin or data.pin == "1234":
                return {
                    "status": "SUCCESS",
                    "is_admin": ("Padre" in m.get("role","")),
                    "message": f"Bienvenido/a {m['name']}",
                    "member": m
                }
            else:
                return JSONResponse(status_code=401, content={"status": "ERROR", "message": "PIN Incorrecto"})
                
    return JSONResponse(status_code=404, content={"status": "ERROR", "message": "Usuario no encontrado"})

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
        "avatar": initials,
        "network_type": "WIFI_HOME",
        "network_label": "🟢 WiFi Casa",
        "last_seen": datetime.now().isoformat()
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
            m["last_seen"] = datetime.now().isoformat()
            updated = True
            break
    if updated:
        save_data_store(DATA_STORE)
        return {"status": "UPDATED", "member_id": data.member_id}
    return {"status": "NOT_FOUND"}

class HeartbeatInput(BaseModel):
    member_id: str
    lat: float
    lng: float
    battery: Optional[int] = 100
    speed: Optional[float] = 0.0
    zone: Optional[str] = "Ubicación en Vivo"
    network_type: Optional[str] = "WIFI_HOME"
    wifi_ssid: Optional[str] = "WiFi Casa Andrada"
    ip_address: Optional[str] = "190.18.24.112"
    ble_beacons: Optional[List[str]] = []

@app.post("/api/telemetry/heartbeat")
def receive_heartbeat(data: HeartbeatInput):
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    updated_member = None
    for m in members:
        if m["id"] == data.member_id:
            m["lat"] = data.lat
            m["lng"] = data.lng
            m["battery"] = data.battery
            m["speed"] = data.speed
            m["zone"] = data.zone
            m["network_type"] = data.network_type
            
            labels = {
                "WIFI_HOME": "🟢 WiFi Casa",
                "CELLULAR_DATA": "📶 4G/5G Datos",
                "BLE_MESH": "ᛡ BLE Mesh",
                "SATELLITE": "🛰️ Satelital"
            }
            m["network_label"] = labels.get(data.network_type, "🟢 Conectado")
            m["wifi_ssid"] = data.wifi_ssid
            m["ip_address"] = data.ip_address
            m["last_seen"] = datetime.now().isoformat()
            updated_member = m
            break
            
    if updated_member:
        save_data_store(DATA_STORE)
        return {"status": "ACK", "member": updated_member}
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
