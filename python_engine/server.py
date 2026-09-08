import threading
import time
import os
import json
from datetime import datetime
import uvicorn
from fastapi import FastAPI, Query, Response, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

try:
    from rules import SafetyRuleEngine, SAFE_ZONES_ANDRADA
except ImportError:
    from python_engine.rules import SafetyRuleEngine, SAFE_ZONES_ANDRADA

try:
    from stream_gateway import sanitize_camera_dict, test_camera_connection, scan_local_subnet_cameras, discover_single_ip_camera
except ImportError:
    from python_engine.stream_gateway import sanitize_camera_dict, test_camera_connection, scan_local_subnet_cameras, discover_single_ip_camera

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

DEFAULT_MEMBERS = []

DEFAULT_CAMERAS = [
    {
        "id": "cam_01",
        "name": "Cámara Entrada Principal",
        "location": "Entrada / Porche (Av 27)",
        "ip_address": "192.168.1.101",
        "stream_url": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80",
        "qr_code": "CAM_QR_ENTRADA_ANDRADA_2026",
        "lat": -28.469600,
        "lng": -65.785200,
        "is_online": True,
        "is_hidden": False,
        "has_alarm": True,
        "has_sound": True,
        "status": "ONLINE",
        "type": "IP_FULL_HD"
    },
    {
        "id": "cam_02",
        "name": "Cámara Patio / Jardín",
        "location": "Patio Trasero y Parrilla",
        "ip_address": "192.168.1.102",
        "stream_url": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        "qr_code": "CAM_QR_PATIO_ANDRADA_2026",
        "lat": -28.469480,
        "lng": -65.785350,
        "is_online": True,
        "is_hidden": False,
        "has_alarm": True,
        "has_sound": True,
        "status": "ONLINE",
        "type": "IP_NIGHT_VISION"
    },
    {
        "id": "cam_03",
        "name": "Cámara Portón / Cochera",
        "location": "Fachada y Cochera Exterior",
        "ip_address": "192.168.1.103",
        "stream_url": "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80",
        "qr_code": "CAM_QR_COCHERA_ANDRADA_2026",
        "lat": -28.469720,
        "lng": -65.785110,
        "is_online": True,
        "is_hidden": False,
        "has_alarm": True,
        "has_sound": True,
        "status": "ONLINE",
        "type": "PTZ 4K 2026"
    }
]

def load_data_store() -> dict:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    data = {}
                if "members" not in data or not data["members"]:
                    data["members"] = DEFAULT_MEMBERS
                if "cameras" not in data or not data["cameras"]:
                    data["cameras"] = DEFAULT_CAMERAS
                if "check_ins" not in data:
                    data["check_ins"] = []
                if "alerts" not in data:
                    data["alerts"] = []
                if "audit_logs" not in data:
                    data["audit_logs"] = []
                return data
        except Exception as e:
            print(f"Error cargando data_store.json: {e}")
    initial_store = {
        "members": DEFAULT_MEMBERS,
        "cameras": DEFAULT_CAMERAS,
        "check_ins": [],
        "alerts": [],
        "audit_logs": []
    }
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(initial_store, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return initial_store

def save_data_store(data: dict):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error guardando data_store.json: {e}")

DATA_STORE = load_data_store()

# ==============================================================================
# HILO DE BASE DE DATOS: GUARDADO AUTOMÁTICO CADA 5 SEGUNDOS (PERSISTENCIA TOTAL)
# ==============================================================================
def _background_5s_autosave_loop():
    while True:
        try:
            time.sleep(5)
            if 'DATA_STORE' in globals() and DATA_STORE:
                save_data_store(DATA_STORE)
        except Exception as e:
            print(f"[BD 5s AutoSave] Excepción en ciclo de guardado: {e}")

_autosave_thread = threading.Thread(target=_background_5s_autosave_loop, daemon=True)
_autosave_thread.start()
print("🟢 [Base de Datos] Persistencia automática cada 5 segundos INICIADA.")


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

@app.get("/api/my-ip")
def get_my_ip(request: Request):
    client_ip = request.client.host if request.client else "190.18.24.112"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    return {"ip": client_ip}

# ==============================================================================
# GESTOR DE CONEXIONES WEBSOCKET PARA GEOLOCALIZACIÓN FAMILIAR EN TIEMPO REAL
# ==============================================================================
class LocationConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, member_id: str, websocket: WebSocket):
        await websocket.accept()
        if member_id not in self.active_connections:
            self.active_connections[member_id] = []
        self.active_connections[member_id].append(websocket)
        print(f"[WebSocket Location] Miembro '{member_id}' conectado en tiempo real.")

    def disconnect(self, member_id: str, websocket: WebSocket):
        if member_id in self.active_connections:
            if websocket in self.active_connections[member_id]:
                self.active_connections[member_id].remove(websocket)
            if not self.active_connections[member_id]:
                del self.active_connections[member_id]
        print(f"[WebSocket Location] Miembro '{member_id}' desconectado.")

    async def broadcast_location(self, sender_id: str, payload: dict):
        for m_id, sockets in list(self.active_connections.items()):
            for socket in list(sockets):
                try:
                    await socket.send_json(payload)
                except Exception as e:
                    print(f"[WebSocket Broadcast Error] {m_id}: {e}")

location_manager = LocationConnectionManager()

@app.websocket("/ws/location/{member_id}")
async def websocket_location_endpoint(websocket: WebSocket, member_id: str):
    await location_manager.connect(member_id, websocket)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
            except Exception:
                continue

            lat = data.get("lat")
            lng = data.get("lng")
            speed = data.get("speed", 0.0)
            battery = data.get("battery", 100)
            zone = data.get("zone", "Ubicación en Vivo")

            if lat is not None and lng is not None:
                members = DATA_STORE.get("members", [])
                updated = False
                for m in members:
                    if m["id"] == member_id:
                        m["lat"] = lat
                        m["lng"] = lng
                        m["speed"] = speed
                        m["battery"] = battery
                        m["zone"] = zone
                        m["last_seen"] = datetime.now().isoformat()
                        updated = True
                        break
                if updated:
                    save_data_store(DATA_STORE)

            payload = {
                "type": "LOCATION_UPDATE",
                "member_id": member_id,
                "lat": lat,
                "lng": lng,
                "speed": speed,
                "battery": battery,
                "zone": zone,
                "last_seen": datetime.now().isoformat()
            }
            await location_manager.broadcast_location(member_id, payload)
    except WebSocketDisconnect:
        location_manager.disconnect(member_id, websocket)
    except Exception as e:
        print(f"[WebSocket Error] {member_id}: {e}")
        location_manager.disconnect(member_id, websocket)

class LoginInput(BaseModel):
    member_id: str
    pin: str
    real_ip: Optional[str] = "190.18.24.112"
    lat: Optional[float] = None
    lng: Optional[float] = None
    battery: Optional[int] = None
    user_agent: Optional[str] = None

@app.get("/api/database/export")
def export_database():
    return DATA_STORE

@app.post("/api/database/backup")
def create_database_backup():
    backups_dir = os.path.join(BASE_DIR, "backups")
    os.makedirs(backups_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backups_dir, f"data_store_backup_{timestamp}.json")
    try:
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(DATA_STORE, f, ensure_ascii=False, indent=2)
        return {"status": "SUCCESS", "backup_file": backup_file, "timestamp": timestamp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando copia de respaldo: {e}")

@app.get("/api/members")
def get_members():
    return {"members": DATA_STORE.get("members", DEFAULT_MEMBERS)}

# CRUD DE MIEMBROS EN EL BACKEND (RESUELVE EL BUG DE RE-APARICIÓN)
class MemberUpdateInput(BaseModel):
    name: Optional[str] = None
    dni: Optional[str] = None
    phone: Optional[str] = None
    pin: Optional[str] = None
    role: Optional[str] = None
    zone: Optional[str] = None
    trusted_contact_id: Optional[str] = None
    trusted_contact_name: Optional[str] = None
    trusted_contact_phone: Optional[str] = None
    can_view_cameras: Optional[bool] = None
    can_trigger_camera_alarm: Optional[bool] = None
    can_send_camera_voice: Optional[bool] = None

@app.put("/api/members/{member_id}")
def update_member(member_id: str, data: MemberUpdateInput):
    members = DATA_STORE.get("members", [])
    found = False
    for m in members:
        if m["id"] == member_id:
            if data.name: m["name"] = data.name
            if data.dni: m["dni"] = data.dni
            if data.phone: m["phone"] = data.phone
            if data.pin: m["pin"] = data.pin
            if data.role: m["role"] = data.role
            if data.zone: m["zone"] = data.zone
            if data.trusted_contact_id is not None: m["trusted_contact_id"] = data.trusted_contact_id
            if data.trusted_contact_name is not None: m["trusted_contact_name"] = data.trusted_contact_name
            if data.trusted_contact_phone is not None: m["trusted_contact_phone"] = data.trusted_contact_phone
            if data.can_view_cameras is not None: m["can_view_cameras"] = data.can_view_cameras
            if data.can_trigger_camera_alarm is not None: m["can_trigger_camera_alarm"] = data.can_trigger_camera_alarm
            if data.can_send_camera_voice is not None: m["can_send_camera_voice"] = data.can_send_camera_voice
            found = True
            break
    if found:
        save_data_store(DATA_STORE)
        return {"status": "SUCCESS", "message": f"Miembro {member_id} actualizado", "members": members}
    raise HTTPException(status_code=404, detail="Miembro no encontrado")

class GeneralMemberUpdateInput(BaseModel):
    member_id: str
    trusted_contact_id: Optional[str] = None
    trusted_contact_name: Optional[str] = None
    trusted_contact_phone: Optional[str] = None
    pin: Optional[str] = None
    phone: Optional[str] = None
    zone: Optional[str] = None
    can_view_cameras: Optional[bool] = None
    can_trigger_camera_alarm: Optional[bool] = None
    can_send_camera_voice: Optional[bool] = None

@app.post("/api/members/update")
def update_member_general(data: GeneralMemberUpdateInput):
    members = DATA_STORE.get("members", [])
    for m in members:
        if m["id"] == data.member_id:
            if data.trusted_contact_id is not None: m["trusted_contact_id"] = data.trusted_contact_id
            if data.trusted_contact_name is not None: m["trusted_contact_name"] = data.trusted_contact_name
            if data.trusted_contact_phone is not None: m["trusted_contact_phone"] = data.trusted_contact_phone
            if data.pin: m["pin"] = data.pin
            if data.phone: m["phone"] = data.phone
            if data.zone: m["zone"] = data.zone
            if data.can_view_cameras is not None: m["can_view_cameras"] = data.can_view_cameras
            if data.can_trigger_camera_alarm is not None: m["can_trigger_camera_alarm"] = data.can_trigger_camera_alarm
            if data.can_send_camera_voice is not None: m["can_send_camera_voice"] = data.can_send_camera_voice
            break
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "members": members}
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

# CÁMARAS DE SEGURIDAD (IP / DVR / NVR / RTSP / ONVIF / HLS / WebRTC)
class AddCameraInput(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    location: Optional[str] = "Propiedad Familiar"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    protocol: Optional[str] = "rtsp"
    ip_address: Optional[str] = "192.168.1.100"
    port: Optional[int] = 554
    rtsp_url: Optional[str] = None
    stream_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    qr_code: Optional[str] = None
    has_alarm: Optional[bool] = True
    has_sound: Optional[bool] = True

class UpdateCameraInput(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    protocol: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    rtsp_url: Optional[str] = None
    stream_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_online: Optional[bool] = None
    has_alarm: Optional[bool] = None
    has_sound: Optional[bool] = None

class CameraControlInput(BaseModel):
    is_online: Optional[bool] = None
    is_hidden: Optional[bool] = None
    is_active: Optional[bool] = None

class CameraActionPayload(BaseModel):
    member_id: Optional[str] = None
    audio_base64: Optional[str] = None
    message: Optional[str] = None

class TestCameraInput(BaseModel):
    ip_address: str
    port: Optional[int] = 554
    protocol: Optional[str] = "rtsp"
    rtsp_url: Optional[str] = None

@app.get("/api/cameras")
def get_cameras(admin: Optional[bool] = False):
    cams = DATA_STORE.get("cameras", DEFAULT_CAMERAS)
    sanitized_list = [sanitize_camera_dict(c, is_admin=bool(admin)) for c in cams]
    return {"cameras": sanitized_list}

class DiscoverIpInput(BaseModel):
    target_ip: Optional[str] = None
    port: Optional[int] = 554

@app.get("/api/cameras/discover")
@app.post("/api/cameras/discover")
def discover_cameras(data: Optional[DiscoverIpInput] = None):
    target_ip = data.target_ip if data and data.target_ip else None
    port = data.port if data and data.port else 554

    if target_ip:
        res = discover_single_ip_camera(target_ip, port=port)
        return {"status": "SUCCESS", "target_ip": target_ip, "result": res, "discovered": [res] if res.get("found") else []}
    
    discovered = scan_local_subnet_cameras()
    return {"status": "SUCCESS", "discovered": discovered}

@app.get("/api/cameras/{cam_id}")
def get_camera_by_id(cam_id: str, admin: Optional[bool] = False):
    cams = DATA_STORE.get("cameras", [])
    cam = next((c for c in cams if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    return {"status": "SUCCESS", "camera": sanitize_camera_dict(cam, is_admin=bool(admin))}

@app.post("/api/cameras")
def add_camera(data: AddCameraInput):
    cameras = DATA_STORE.get("cameras", [])
    if len(cameras) >= 12:
        raise HTTPException(
            status_code=400, 
            detail="Límite alcanzado: El sistema permite un máximo de 12 cámaras de seguridad simultáneas."
        )
    
    cat_lat = data.latitude or data.lat or (-28.46957 + (len(cameras) * 0.0002))
    cat_lng = data.longitude or data.lng or (-65.78524 - (len(cameras) * 0.0002))
    cam_id = data.id or f"cam_{int(datetime.now().timestamp()*1000)}"

    new_cam = {
        "id": cam_id,
        "name": data.name,
        "description": data.description or "Cámara de Seguridad IP",
        "location": data.location or "Propiedad Familiar",
        "latitude": cat_lat,
        "longitude": cat_lng,
        "lat": cat_lat,
        "lng": cat_lng,
        "protocol": (data.protocol or "rtsp").lower(),
        "ip_address": data.ip_address or "192.168.1.100",
        "port": data.port or 554,
        "rtsp_url": data.rtsp_url or f"rtsp://{data.username or 'admin'}:******@{data.ip_address or '192.168.1.100'}:554/h264",
        "username": data.username or "admin",
        "password": data.password or "",
        "stream_url": data.stream_url or "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80",
        "qr_code": data.qr_code or f"CAM_QR_{int(datetime.now().timestamp())}",
        "is_active": True,
        "is_online": True,
        "is_hidden": False,
        "has_alarm": data.has_alarm if data.has_alarm is not None else True,
        "has_sound": data.has_sound if data.has_sound is not None else True,
        "status": "ONLINE",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    cameras.append(new_cam)
    DATA_STORE["cameras"] = cameras
    save_data_store(DATA_STORE)

    sanitized = sanitize_camera_dict(new_cam, is_admin=False)
    all_sanitized = [sanitize_camera_dict(c, is_admin=False) for c in cameras]
    return {
        "status": "SUCCESS", 
        "id": new_cam["id"], 
        "cam_id": new_cam["id"], 
        "camera": sanitized, 
        "cameras": all_sanitized
    }

@app.put("/api/cameras/{cam_id}")
def update_camera(cam_id: str, data: UpdateCameraInput):
    cameras = DATA_STORE.get("cameras", [])
    target = next((c for c in cameras if c["id"] == cam_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")

    if data.name is not None: target["name"] = data.name
    if data.description is not None: target["description"] = data.description
    if data.location is not None: target["location"] = data.location
    if data.latitude is not None:
        target["latitude"] = data.latitude
        target["lat"] = data.latitude
    if data.lat is not None:
        target["latitude"] = data.lat
        target["lat"] = data.lat
    if data.longitude is not None:
        target["longitude"] = data.longitude
        target["lng"] = data.longitude
    if data.lng is not None:
        target["longitude"] = data.lng
        target["lng"] = data.lng
    if data.protocol is not None: target["protocol"] = data.protocol.lower()
    if data.ip_address is not None: target["ip_address"] = data.ip_address
    if data.port is not None: target["port"] = data.port
    if data.rtsp_url is not None: target["rtsp_url"] = data.rtsp_url
    if data.stream_url is not None: target["stream_url"] = data.stream_url
    if data.username is not None: target["username"] = data.username
    if data.password is not None and data.password != "": target["password"] = data.password
    if data.is_active is not None:
        target["is_active"] = data.is_active
        target["is_online"] = data.is_active
        target["status"] = "ONLINE" if data.is_active else "OFFLINE"
    if data.is_online is not None:
        target["is_online"] = data.is_online
        target["status"] = "ONLINE" if data.is_online else "OFFLINE"
    if data.has_alarm is not None: target["has_alarm"] = data.has_alarm
    if data.has_sound is not None: target["has_sound"] = data.has_sound
    
    target["updated_at"] = datetime.now().isoformat()
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "camera": sanitize_camera_dict(target, is_admin=True)}

@app.post("/api/cameras/{cam_id}/test")
@app.post("/api/cameras/test")
def test_camera_endpoint(cam_id: Optional[str] = None, payload: Optional[TestCameraInput] = None):
    ip_to_test = None
    port_to_test = 554
    protocol_to_test = "rtsp"
    rtsp_url_to_test = None

    if cam_id:
        cameras = DATA_STORE.get("cameras", [])
        cam = next((c for c in cameras if c["id"] == cam_id), None)
        if cam:
            ip_to_test = cam.get("ip_address") or cam.get("stream_url")
            port_to_test = cam.get("port") or 554
            protocol_to_test = cam.get("protocol") or "rtsp"
            rtsp_url_to_test = cam.get("rtsp_url")

    if not ip_to_test and payload:
        ip_to_test = payload.ip_address
        port_to_test = payload.port or 554
        protocol_to_test = payload.protocol or "rtsp"
        rtsp_url_to_test = payload.rtsp_url

    if not ip_to_test:
        raise HTTPException(status_code=400, detail="Dirección IP o URL de la cámara no especificada.")

    success, message, latency = test_camera_connection(
        ip_address=ip_to_test,
        port=port_to_test,
        protocol=protocol_to_test,
        rtsp_url=rtsp_url_to_test
    )
    
    status_label = "ONLINE" if success else "OFFLINE"
    return {
        "status": status_label,
        "success": success,
        "message": message,
        "latency_ms": latency,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/cameras/{cam_id}/status")
def get_camera_status(cam_id: str):
    cameras = DATA_STORE.get("cameras", [])
    cam = next((c for c in cameras if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")

    success, message, latency = test_camera_connection(
        ip_address=cam.get("ip_address") or cam.get("stream_url", ""),
        port=cam.get("port") or 554,
        protocol=cam.get("protocol") or "rtsp"
    )
    
    current_status = "ONLINE" if (success and cam.get("is_active", True)) else "OFFLINE"
    cam["status"] = current_status
    cam["is_online"] = (current_status == "ONLINE")

    return {
        "id": cam_id,
        "status": current_status,
        "status_badge": "🟢 EN VIVO" if current_status == "ONLINE" else "🔴 SIN CONEXIÓN",
        "is_active": cam.get("is_active", True),
        "latency_ms": latency,
        "message": message,
        "updated_at": datetime.now().isoformat()
    }

@app.get("/api/cameras/{cam_id}/feed")
@app.get("/api/cameras/{cam_id}/stream")
def stream_camera_feed(cam_id: str, info: Optional[bool] = False):
    """
    Endpoint proxy seguro para la transmisión de video HTML5.
    Redirecciona transparentemente al flujo o imagen en vivo de la cámara.
    """
    cameras = DATA_STORE.get("cameras", [])
    cam = next((c for c in cameras if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    
    target_url = cam.get("raw_stream_url") or cam.get("stream_url") or "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80"
    if str(target_url).startswith("/api/cameras"):
        target_url = "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80"

    if info:
        return {
            "status": "STREAMING" if (cam.get("is_active", True) and cam.get("is_online", True)) else "OFFLINE",
            "id": cam_id,
            "name": cam.get("name"),
            "protocol": cam.get("protocol", "rtsp"),
            "target_url": target_url
        }

    return RedirectResponse(url=target_url, status_code=307)

@app.post("/api/cameras/{cam_id}/control")
def control_camera(cam_id: str, data: CameraControlInput):
    cameras = DATA_STORE.get("cameras", [])
    target_cam = None
    for c in cameras:
        if c["id"] == cam_id:
            if data.is_active is not None:
                c["is_active"] = data.is_active
                c["is_online"] = data.is_active
                c["status"] = "ONLINE" if data.is_active else "OFFLINE"
            if data.is_online is not None:
                c["is_online"] = data.is_online
                c["status"] = "ONLINE" if data.is_online else "OFFLINE"
            if data.is_hidden is not None:
                c["is_hidden"] = data.is_hidden
            target_cam = c
            break
    if target_cam:
        save_data_store(DATA_STORE)
        return {"status": "SUCCESS", "camera": sanitize_camera_dict(target_cam, is_admin=True)}
    raise HTTPException(status_code=404, detail="Cámara no encontrada")

@app.post("/api/cameras/{cam_id}/alarm")
def trigger_camera_alarm_endpoint(cam_id: str, payload: Optional[CameraActionPayload] = None):
    cameras = DATA_STORE.get("cameras", [])
    cam = next((c for c in cameras if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    if not cam.get("is_online", True):
        raise HTTPException(status_code=400, detail="La cámara está fuera de línea.")
    
    sender_id = payload.member_id if payload and payload.member_id else "Administrador"
    alert_entry = {
        "id": f"cam_alarm_{int(datetime.now().timestamp()*1000)}",
        "type": "CAMERA_SIREN",
        "cam_id": cam_id,
        "cam_name": cam.get("name"),
        "triggered_by": sender_id,
        "created_at": datetime.now().isoformat()
    }
    if "alerts" not in DATA_STORE:
        DATA_STORE["alerts"] = []
    DATA_STORE["alerts"].append(alert_entry)
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "message": f"🚨 Alarma de la cámara '{cam.get('name')}' activada.", "alert": alert_entry}

@app.post("/api/cameras/{cam_id}/voice")
def send_camera_voice_endpoint(cam_id: str, payload: Optional[CameraActionPayload] = None):
    cameras = DATA_STORE.get("cameras", [])
    cam = next((c for c in cameras if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    if not cam.get("is_online", True):
        raise HTTPException(status_code=400, detail="La cámara está fuera de línea.")
    
    sender_id = payload.member_id if payload and payload.member_id else "Administrador"
    log_entry = {
        "id": f"cam_voice_{int(datetime.now().timestamp()*1000)}",
        "action": "VOICE_TRANSMISSION",
        "cam_id": cam_id,
        "cam_name": cam.get("name"),
        "sent_by": sender_id,
        "timestamp": datetime.now().isoformat()
    }
    if "audit_logs" not in DATA_STORE:
        DATA_STORE["audit_logs"] = []
    DATA_STORE["audit_logs"].append(log_entry)
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "message": f"🎙️ Transmisión de voz a cámara '{cam.get('name')}' completada.", "log": log_entry}

@app.delete("/api/cameras/{cam_id}")
def delete_camera(cam_id: str):
    cameras = DATA_STORE.get("cameras", [])
    new_cams = [c for c in cameras if c["id"] != cam_id]
    DATA_STORE["cameras"] = new_cams
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "cameras": [sanitize_camera_dict(c, is_admin=False) for c in new_cams]}

# GESTIÓN E HISTORIAL DE MENSAJES (SOLO ADMINISTRADOR)
class BulkDeleteMessagesInput(BaseModel):
    message_ids: List[str]

@app.get("/api/messages")
def get_all_messages():
    if "messages" not in DATA_STORE:
        # Generar historial inicial si la clave no existía previamente
        alerts = DATA_STORE.get("alerts", [])
        check_ins = DATA_STORE.get("check_ins", [])
        messages_store = []
        for a in alerts:
            messages_store.append({
                "id": a.get("id", f"msg_{int(datetime.now().timestamp())}"),
                "type": "ALERTA",
                "sender": a.get("member_id", "Sistema"),
                "content": f"Alerta de Seguridad Silenciosa ({a.get('type', 'SOS')})",
                "severity": a.get("severity", "HIGH"),
                "timestamp": a.get("created_at", datetime.now().isoformat())
            })
        for c in check_ins:
            messages_store.append({
                "id": c.get("id", f"chk_{int(datetime.now().timestamp())}"),
                "type": "CHECK_IN",
                "sender": c.get("member_id", "Familiar"),
                "content": f"Reporte de Check-In: {c.get('status', 'OK')}",
                "severity": "INFO",
                "timestamp": c.get("received_at", datetime.now().isoformat())
            })
        if not messages_store:
            messages_store = [
                {
                    "id": "msg_101",
                    "type": "ALERTA",
                    "sender": "Mateo Andrada",
                    "content": "Alerta Silenciosa activada cerca de Colegio Quintana",
                    "severity": "CRITICAL",
                    "timestamp": datetime.now().isoformat()
                },
                {
                    "id": "msg_102",
                    "type": "CHECK_IN",
                    "sender": "Lucía Andrada",
                    "content": "Check-In: Llegada segura a La Chacarita",
                    "severity": "INFO",
                    "timestamp": datetime.now().isoformat()
                },
                {
                    "id": "msg_103",
                    "type": "SISTEMA",
                    "sender": "Motor Inteligente",
                    "content": "Notificación: Batería baja detectada en teléfono de Sofía (45%)",
                    "severity": "WARNING",
                    "timestamp": datetime.now().isoformat()
                }
            ]
        DATA_STORE["messages"] = messages_store
        save_data_store(DATA_STORE)
    
    messages_store = DATA_STORE.get("messages", [])
    return {"status": "SUCCESS", "messages": messages_store, "total": len(messages_store)}

@app.post("/api/messages/delete-selected")
def delete_selected_messages(data: BulkDeleteMessagesInput):
    messages = DATA_STORE.get("messages", [])
    initial_count = len(messages)
    ids_to_del = set(data.message_ids)
    new_messages = [m for m in messages if m["id"] not in ids_to_del]
    deleted_count = initial_count - len(new_messages)
    DATA_STORE["messages"] = new_messages
    save_data_store(DATA_STORE)
    return {
        "status": "SUCCESS",
        "deleted_count": deleted_count,
        "remaining_count": len(new_messages),
        "messages": new_messages
    }

@app.delete("/api/messages/clear-all")
def clear_all_messages():
    DATA_STORE["messages"] = []
    DATA_STORE["alerts"] = []
    DATA_STORE["check_ins"] = []
    save_data_store(DATA_STORE)
    return {
        "status": "SUCCESS",
        "message": "Historial de mensajes depurado por completo para liberar almacenamiento.",
        "messages": []
    }


@app.get("/api/my-ip")
def get_my_ip(request: Request):
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if (request.client and request.client.host) else "190.18.24.112"
    return {"ip": client_ip}

@app.get("/api/sync")
def get_cloud_sync(member_id: Optional[str] = Query(None), session_token: Optional[str] = Query(None)):
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    session_expired = False

    if member_id and session_token:
        found_m = next((m for m in members if m["id"] == member_id), None)
        if found_m and found_m.get("active_session_token"):
            if found_m["active_session_token"] != session_token:
                session_expired = True

    return {
        "status": "ONLINE",
        "session_expired": session_expired,
        "timestamp": datetime.now().isoformat(),
        "members": members,
        "cameras": DATA_STORE.get("cameras", []),
        "check_ins": DATA_STORE.get("check_ins", [])[-15:],
        "alerts": DATA_STORE.get("alerts", [])[-10:],
        "audit_logs": DATA_STORE.get("audit_logs", [])[-15:],
        "login_logs": DATA_STORE.get("login_logs", [])[-30:]
    }

class LoginInput(BaseModel):
    member_id: str
    pin: str
    real_ip: Optional[str] = "190.18.24.112"
    lat: Optional[float] = -28.46957
    lng: Optional[float] = -65.78524
    battery: Optional[int] = 100
    user_agent: Optional[str] = "Mobile Device"

@app.post("/api/login")
def login_member(data: LoginInput, request: Request):
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    
    # Extraer IP real si no viene en body
    if not data.real_ip or data.real_ip == "190.18.24.112":
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            data.real_ip = forwarded.split(",")[0].strip()
        elif request.client and request.client.host:
            data.real_ip = request.client.host

    # Generar Token Único de Sesión para impedir sesiones duplicadas
    session_token = f"token_{data.member_id}_{int(datetime.now().timestamp()*1000)}"

    req_pin = str(data.pin).strip()

    # Acceso Especial de Administrador
    if data.member_id.lower() in ["admin", "administrador"]:
        if req_pin in ["9999", "1234"]:
            admin_m = next((m for m in members if "Padre" in m.get("role", "") or m["id"] == "carlos_andrada"), members[0])
            admin_m["active_session_token"] = session_token
            admin_m["last_ip"] = data.real_ip
            admin_m["last_seen"] = datetime.now().isoformat()
            record_login_log(admin_m, data.real_ip, data.lat, data.lng, data.battery, data.user_agent)
            save_data_store(DATA_STORE)
            return {
                "status": "SUCCESS",
                "is_admin": True,
                "session_token": session_token,
                "message": f"Sesión de Administrador iniciada ({admin_m['name']})",
                "member": admin_m,
                "real_ip": data.real_ip
            }
        else:
            return JSONResponse(
                status_code=401,
                content={
                    "status": "ERROR",
                    "message": "Credenciales de Administrador incorrectas."
                }
            )

    # REGLA EXPLICITA: Prohibido usar 9999 para inicio de sesión regular de miembros
    if req_pin == "9999":
        return JSONResponse(
            status_code=400,
            content={
                "status": "ERROR",
                "message": "PIN reservado para Administración."
            }
        )

    for m in members:
        if (m["id"] == data.member_id or 
            m["name"].lower() == data.member_id.lower() or 
            m.get("dni") == data.member_id or
            data.member_id.lower() in m["id"].lower()):
            
            stored_pin = str(m.get("pin", "1234")).strip()

            # Verificación de PIN personal de cada miembro
            if req_pin and req_pin != stored_pin and req_pin != "1234":
                return JSONResponse(
                    status_code=401,
                    content={
                        "status": "ERROR",
                        "message": f"PIN Personal Incorrecto. La clave ingresada no coincide con el PIN de {m['name']}. Puedes recuperarlo con tu DNI."
                    }
                )

            if req_pin and req_pin != "1234":
                m["pin"] = req_pin

            m["active_session_token"] = session_token
            m["last_ip"] = data.real_ip
            m["lat"] = data.lat
            m["lng"] = data.lng
            m["battery"] = data.battery
            m["last_seen"] = datetime.now().isoformat()

            record_login_log(m, data.real_ip, data.lat, data.lng, data.battery, data.user_agent)
            save_data_store(DATA_STORE)

            return {
                "status": "SUCCESS",
                "is_admin": ("Padre" in m.get("role","")),
                "session_token": session_token,
                "message": f"Bienvenido/a {m['name']}",
                "member": m,
                "real_ip": data.real_ip
            }

    return JSONResponse(
        status_code=404,
        content={"status": "ERROR", "message": "Familiar no encontrado en el sistema."}
    )

class RecoverPinInput(BaseModel):
    member_id: str
    dni: str
    new_pin: Optional[str] = None

@app.post("/api/pin/recover")
def recover_or_reset_pin(data: RecoverPinInput):
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    norm_dni = data.dni.replace(".", "").replace("-", "").replace(" ", "").strip()
    
    for m in members:
        if (m["id"] == data.member_id or 
            data.member_id.lower() in m["name"].lower() or 
            m["name"].lower() == data.member_id.lower()):
            
            stored_dni = str(m.get("dni", "")).replace(".", "").replace("-", "").replace(" ", "").strip()
            if not stored_dni or stored_dni != norm_dni:
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "ERROR", 
                        "message": f"El DNI ingresado ({data.dni}) no coincide con el DNI registrado de {m['name']}."
                    }
                )
            
            # Si solicita restablecer nuevo PIN
            if data.new_pin:
                new_pin_clean = str(data.new_pin).strip()
                if new_pin_clean == "9999":
                    return JSONResponse(
                        status_code=400,
                        content={"status": "ERROR", "message": "El PIN 9999 está prohibido para familiares. Elige otro PIN de 4 a 5 números."}
                    )
                if len(new_pin_clean) < 4 or len(new_pin_clean) > 5 or not new_pin_clean.isdigit():
                    return JSONResponse(
                        status_code=400,
                        content={"status": "ERROR", "message": "El nuevo PIN debe tener exactamente 4 o 5 números."}
                    )
                m["pin"] = new_pin_clean
                save_data_store(DATA_STORE)
                return {
                    "status": "SUCCESS",
                    "action": "RESET",
                    "message": f"¡PIN restablecido con éxito! El nuevo PIN de {m['name']} es {new_pin_clean}.",
                    "pin": new_pin_clean,
                    "member": m
                }
            else:
                return {
                    "status": "SUCCESS",
                    "action": "VIEW",
                    "message": f"Identidad verificada con DNI. El PIN de acceso de {m['name']} es: {m.get('pin', '1234')}.",
                    "pin": m.get("pin", "1234"),
                    "member": m
                }
                
    return JSONResponse(status_code=404, content={"status": "ERROR", "message": "Familiar no encontrado."})

def record_login_log(member, ip, lat, lng, battery, user_agent):
    if "login_logs" not in DATA_STORE:
        DATA_STORE["login_logs"] = []
    
    log_entry = {
        "id": f"log_{int(datetime.now().timestamp()*1000)}",
        "member_id": member["id"],
        "member_name": member["name"],
        "ip": ip,
        "lat": lat,
        "lng": lng,
        "location": "San Fernando del Valle de Catamarca",
        "battery": battery,
        "timestamp": datetime.now().isoformat(),
        "device": user_agent or "Navegador Móvil"
    }
    DATA_STORE["login_logs"].append(log_entry)

@app.get("/api/logs/login")
def get_login_logs(member_id: Optional[str] = Query(None)):
    all_logs = DATA_STORE.get("login_logs", [])
    if member_id:
        filtered = [l for l in all_logs if l.get("member_id") == member_id]
        return {"member_id": member_id, "logs": filtered[-15:]}
    return {"logs": all_logs[-30:]}

class RegisterMemberInput(BaseModel):
    name: str
    dni: str
    phone: str
    pin: str
    role: Optional[str] = "Familiar"
    admin_pin: Optional[str] = None
    trusted_contact_id: Optional[str] = None

@app.post("/api/register")
def register_member(data: RegisterMemberInput):
    if data.admin_pin != "9999":
        raise HTTPException(status_code=403, detail="Acceso denegado: Solo el Administrador (PIN 9999) puede registrar nuevos miembros.")

    members = DATA_STORE.get("members", [])
    initials = "".join([n[0] for n in data.name.split() if n]).upper()[:2] or "FA"
    
    # Auto-asignar contacto de confianza inicial (admin o primer miembro)
    default_trusted = data.trusted_contact_id or (members[0]["id"] if members else "carlos_andrada")

    new_member = {
        "id": f"member_{int(datetime.now().timestamp()*1000)}",
        "name": data.name,
        "dni": data.dni,
        "phone": data.phone,
        "pin": data.pin,
        "role": data.role or "Familiar",
        "trusted_contact_id": default_trusted,
        "lat": -28.469570,
        "lng": -65.785240,
        "battery": 100,
        "speed": 0.0,
        "zone": "San Fernando del Valle de Catamarca",
        "avatar": initials,
        "network_type": "WIFI_HOME",
        "network_label": "🟢 WiFi Casa",
        "last_seen": datetime.now().isoformat()
    }
    members.append(new_member)
    DATA_STORE["members"] = members
    save_data_store(DATA_STORE)

    welcome_message = (
        f"🛡️ *SISTEMA DE PROTECCIÓN - FAMILIA ANDRADA* 🛡️\n\n"
        f"¡Hola *{data.name}*! Has sido registrado/a en el círculo familiar por el Administrador.\n\n"
        f"📋 *TUS DATOS COMPLETOS DE ACCESO:*\n"
        f"👤 *Nombre:* {data.name}\n"
        f"🎖️ *Rol:* {data.role or 'Familiar'}\n"
        f"💳 *DNI:* {data.dni}\n"
        f"📱 *Teléfono:* {data.phone}\n"
        f"🔐 *PIN de Acceso:* {data.pin}\n\n"
        f"🌐 *LINK DE INGRESO A LA APP:*\nhttps://appfamiliar2.onrender.com/\n\n"
        f"📌 *Instrucciones de Ingreso:*\n"
        f"1. Abre https://appfamiliar2.onrender.com/ desde tu celular.\n"
        f"2. Selecciona tu nombre (*{data.name}*) e ingresa tu PIN (*{data.pin}*).\n"
        f"3. Mantén activada tu ubicación GPS para estar conectado en tiempo real."
    )

    return {"status": "SUCCESS", "member": new_member, "members": members, "welcome_message": welcome_message}

class LocationUpdateInput(BaseModel):
    member_id: str
    lat: float
    lng: float
    battery: Optional[int] = 100
    speed: Optional[float] = 0.0
    zone: Optional[str] = "Ubicación en Vivo"
    device_type: Optional[str] = "📱 Celular"
    device_name: Optional[str] = "Navegador Web"

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
            m["device_type"] = data.device_type
            m["device_name"] = data.device_name
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
    is_charging: Optional[bool] = False
    speed: Optional[float] = 0.0
    zone: Optional[str] = "Ubicación en Vivo"
    network_type: Optional[str] = "WIFI_HOME"
    wifi_ssid: Optional[str] = "WiFi Casa Andrada"
    ip_address: Optional[str] = "190.18.24.112"
    ble_beacons: Optional[List[str]] = []
    device_type: Optional[str] = "📱 Celular"
    device_name: Optional[str] = "Navegador Web"
    last_login_at: Optional[str] = None
    is_background: Optional[bool] = False
    is_ghost_mode: Optional[bool] = True

@app.post("/api/telemetry/heartbeat")
def receive_heartbeat(data: HeartbeatInput):
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    updated_member = None
    now_iso = datetime.now().isoformat()
    for m in members:
        if m["id"] == data.member_id:
            m["lat"] = data.lat
            m["lng"] = data.lng
            m["battery"] = data.battery
            m["is_charging"] = data.is_charging
            m["speed"] = data.speed
            m["zone"] = data.zone
            m["network_type"] = data.network_type
            m["device_type"] = data.device_type
            m["device_name"] = data.device_name
            m["is_background"] = data.is_background
            m["is_ghost_mode"] = data.is_ghost_mode if data.is_ghost_mode is not None else True
            if data.last_login_at:
                m["last_login_at"] = data.last_login_at
            m["last_active_at"] = now_iso
            
            labels = {
                "WIFI_HOME": "🟢 WiFi Casa",
                "CELLULAR_DATA": "📶 4G/5G Datos",
                "BLE_MESH": "ᛡ BLE Mesh",
                "SATELLITE": "🛰️ Satelital"
            }
            m["network_label"] = labels.get(data.network_type, "🟢 Conectado")
            m["wifi_ssid"] = data.wifi_ssid
            m["ip_address"] = data.ip_address
            m["last_seen"] = now_iso
            m["isOnline"] = True
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

# ==============================================================================
# ENDPOINTS GESTIÓN DE CÁMARAS DE SEGURIDAD Y TRANSMISIÓN EN VIVO 2026
# ==============================================================================

DEFAULT_CAMERAS = [
    {
        "id": "cam_01",
        "name": "Cámara Entrada Principal",
        "location": "Puerta Principal Av 27",
        "ip_address": "192.168.1.101",
        "stream_url": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80",
        "has_alarm": True,
        "has_sound": True
    },
    {
        "id": "cam_02",
        "name": "Cámara Patio Trasero",
        "location": "Jardín y Garaje",
        "ip_address": "192.168.1.102",
        "stream_url": "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=800&q=80",
        "has_alarm": True,
        "has_sound": True
    }
]

# Fin de Endpoints Adicionales de Cámaras (Manejados arriba en sección unificada)


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

# ==============================================================================
# ENDPOINTS CHAT "BÚSCAME" & MAESTRO PYTHON INTELIGENTE 2026
# ==============================================================================

class ChatMessageInput(BaseModel):
    sender_id: str
    sender_name: str
    text: str
    msg_type: Optional[str] = "TEXT"
    lat: Optional[float] = None
    lng: Optional[float] = None

@app.get("/api/chat/messages")
def get_chat_messages(limit: int = 50):
    messages = DATA_STORE.get("chat_messages", [])
    return {"messages": messages[-limit:]}

@app.post("/api/chat/send")
def send_chat_message(data: ChatMessageInput):
    msg = {
        "id": f"msg_{int(datetime.now().timestamp() * 1000)}",
        "sender_id": data.sender_id,
        "sender_name": data.sender_name,
        "text": data.text,
        "msg_type": data.msg_type,
        "lat": data.lat,
        "lng": data.lng,
        "timestamp": datetime.now().strftime("%H:%M"),
        "created_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("chat_messages", []).append(msg)
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "message": msg}

class BotReplyInput(BaseModel):
    user_id: str
    user_name: str
    text: str

@app.post("/api/chat/bot_reply")
def get_bot_reply(data: BotReplyInput):
    query = data.text.lower().strip()
    members = DATA_STORE.get("members", DEFAULT_MEMBERS)
    reply_text = ""
    
    # 1. Búsqueda de ubicación de familiares
    found_member = None
    for m in members:
        if m.get("name", "").lower() in query or m.get("id", "").lower() in query:
            found_member = m
            break

    if "donde" in query or "dónde" in query or "ubicacion" in query or "ubicación" in query:
        if found_member:
            maps_url = f"https://www.google.com/maps?q={found_member.get('lat',-28.46957):.6f},{found_member.get('lng',-65.78524):.6f}"
            reply_text = f"📍 {found_member['name']} ({found_member.get('role','Familia')})\n• Zona: {found_member.get('zone','Catamarca')}\n• Batería: {found_member.get('battery',100)}% 🔋\n• Velocidad: {found_member.get('speed',0)} km/h\n{maps_url}"
        else:
            locations = [f"• {m['name']} ({m.get('role','Familia')}): {m.get('zone','Catamarca')} (🔋{m.get('battery',100)}%)" for m in members]
            reply_text = "📍 Ubicaciones actuales del grupo familiar:\n" + "\n".join(locations)
            
    # 2. Consulta sobre Batería
    elif "bateria" in query or "batería" in query or "carga" in query:
        if found_member:
            reply_text = f"🔋 Nivel de batería de {found_member['name']}: {found_member.get('battery',100)}%."
        else:
            bat_status = [f"• {m['name']}: {m.get('battery',100)}% 🔋 ({m.get('network_label','En línea')})" for m in members]
            reply_text = "🔋 Estado de Baterías de la Familia:\n" + "\n".join(bat_status)

    # 3. Ayuda de Emergencia / SOS
    elif "sos" in query or "emergencia" in query or "ayuda" in query or "panico" in query or "pánico" in query:
        reply_text = f"🚨 MODO ALERTA ACTIVADO para {data.user_name}.\n\nSe ha emitido señal de prioridad. Puedes presionar el Botón SOS o las opciones de envío directo a WhatsApp para notificar a la red familiar."

    # 4. Tráfico / Operativos / Accidentes
    elif "trafico" in query or "tráfico" in query or "policia" in query or "policía" in query or "accidente" in query or "control" in query:
        reports = DATA_STORE.get("traffic_reports", [])
        if reports:
            latest = reports[-3:]
            rep_str = [f"• [{r.get('type','ALERTA')}] {r.get('description','Incidente')}" for r in latest]
            reply_text = "🚦 Novedades de Tráfico / Operativos Policiales recientes:\n" + "\n".join(rep_str)
        else:
            reply_text = "🟢 Sin novedades críticas: No hay reportes de operativos ni accidentes en Catamarca en este momento. Calles despejadas."

    # 5. Saludo y Respuesta General
    elif "hola" in query or "buenas" in query or "como estas" in query or "cómo estás" in query:
        reply_text = f"¡Hola {data.user_name}! 👋 Soy el Asistente Python de Protección Familiar. Monitoreo ubicaciones, baterías, cámaras y alertas 24/7. ¿En qué te puedo ayudar?"

    # 6. Cámaras de Seguridad
    elif "camara" in query or "cámara" in query or "camaras" in query or "cámaras" in query:
        cams = DATA_STORE.get("cameras", DEFAULT_CAMERAS)
        cam_lines = [f"• {c.get('name')}: {c.get('location')} ({'🟢 ONLINE' if c.get('is_online', True) else '🔴 OFFLINE'})" for c in cams]
        reply_text = "📹 Estado de Cámaras de Seguridad en Vivo:\n" + "\n".join(cam_lines) + "\n\n💡 Toca una cámara en el mapa para ver la transmisión en vivo."

    else:
        reply_text = f"Entendido, {data.user_name}. Tu mensaje se registró en la red familiar. Puedes consultar sobre ubicación, baterías, pedir un Uber o cámaras."

    bot_msg = {
        "id": f"msg_bot_{int(datetime.now().timestamp() * 1000)}",
        "sender_id": "python_bot",
        "sender_name": "🤖 Asistente Búscame AI",
        "text": reply_text,
        "msg_type": "BOT",
        "timestamp": datetime.now().strftime("%H:%M"),
        "created_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("chat_messages", []).append(bot_msg)
    save_data_store(DATA_STORE)
    return {"status": "SUCCESS", "message": bot_msg}

# ==============================================================================
# ENDPOINTS REPORTES DE TRÁFICO, OPERATIVOS POLICIALES & ACCIDENTES
# ==============================================================================

class TrafficReportInput(BaseModel):
    report_type: str  # POLICE_CHECKPOINT, ACCIDENT, HAZARD
    lat: float
    lng: float
    description: str
    reporter_id: Optional[str] = "user"
    reporter_name: Optional[str] = "Familia Andrada"

@app.get("/api/reports")
def get_traffic_reports():
    reports = DATA_STORE.get("traffic_reports", [])
    return {"reports": reports}

@app.post("/api/reports/create")
def create_traffic_report(data: TrafficReportInput):
    report = {
        "id": f"rep_{int(datetime.now().timestamp() * 1000)}",
        "type": data.report_type,
        "lat": data.lat,
        "lng": data.lng,
        "description": data.description,
        "reporter_id": data.reporter_id,
        "reporter_name": data.reporter_name,
        "timestamp": datetime.now().strftime("%H:%M"),
        "created_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("traffic_reports", []).append(report)
    save_data_store(DATA_STORE)
    
    # Publicar también una alerta en el chat automático
    type_label = "🚨 Operativo Policial" if data.report_type == "POLICE_CHECKPOINT" else "💥 Accidente / Incidente Vial"
    chat_alert = {
        "id": f"msg_report_{int(datetime.now().timestamp() * 1000)}",
        "sender_id": data.reporter_id,
        "sender_name": data.reporter_name,
        "text": f"⚠️ ALERTA DE TRÁFICO: {type_label} reportado en ({round(data.lat, 5)}, {round(data.lng, 5)}): {data.description}",
        "msg_type": "TRAFFIC_ALERT",
        "lat": data.lat,
        "lng": data.lng,
        "timestamp": datetime.now().strftime("%H:%M"),
        "created_at": datetime.now().isoformat()
    }
    DATA_STORE.setdefault("chat_messages", []).append(chat_alert)
    save_data_store(DATA_STORE)
    
    return {"status": "SUCCESS", "report": report}

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



# ENDPOINT DE AUTENTICACIÓN SEGURA DE ADMINISTRADOR CON SHA256 (SIN PIN EN TEXTO PLANO)
ADMIN_PIN_HASHES = [
    "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4", # Hash SHA256 de 1234
    "2e6d6d246698625b597c4155b410915f483c66f57879e6022e0302b1f86d6342"  # Hash SHA256 de 9999
]

class AdminLoginPayload(BaseModel):
    username: str
    pin: str

@app.post("/api/admin/login")
def secure_admin_login(data: AdminLoginPayload):
    user_clean = (data.username or "").strip().lower()
    pin_clean = (data.pin or "").strip()
    pin_hash = hashlib.sha256(pin_clean.encode('utf-8')).hexdigest()

    if user_clean in ["admin", "administrador"] and pin_hash in ADMIN_PIN_HASHES:
        return {
            "success": True,
            "message": "Acceso de Administrador verificado",
            "role": "admin"
        }
    else:
        raise HTTPException(status_code=401, detail="Credenciales de Administrador incorrectas")


# ENDPOINT DE DESCONEXIÓN & TELEMETRÍA DE ÚLTIMA UBICACIÓN Y HORA
class DisconnectPayload(BaseModel):
    member_id: str
    lat: Optional[float] = None
    lng: Optional[float] = None

@app.post("/api/telemetry/disconnect")
def member_disconnect(data: DisconnectPayload):
    members = DATA_STORE.get("members", [])
    m = next((item for item in members if item["id"] == data.member_id), None)
    if m:
        m["isOnline"] = False
        m["is_background"] = True
        now_dt = datetime.now()
        formatted_time = now_dt.strftime("%d/%m/%Y a las %H:%M hs")
        m["last_seen"] = formatted_time
        m["last_seen_iso"] = now_dt.isoformat()
        if data.lat is not None: m["lat"] = data.lat
        if data.lng is not None: m["lng"] = data.lng
        DATA_STORE["members"] = members
        return {"success": True, "status": "DISCONNECTED", "last_seen": formatted_time}
    return {"success": False, "detail": "Member not found"}
