# Familia Andrada - Protección Familiar (Versión 2026)

Plataforma integral de seguridad urbana y familiar desarrollada con **Python**, **Node.js** y **HTML5/CSS3/JavaScript**. Dispone de rastreo continuo en segundo plano, motor de reglas espaciales, caja negra de audio (15s), simulación de eventos críticos (batería baja, impacto, desvío) y despacho inteligente vía Meta WhatsApp Cloud API y Twilio.

---

## 📁 Estructura del Proyecto

* **`/web`**: Aplicación Web interactiva (HTML5 + Vanilla CSS Glassmorphism + JS)
  * **Título:** `Familia Andrada`
  * **Subtítulo:** `Protección Familiar`
  * Mapa en tiempo real con Leaflet, geocercas seguras (Casa Andrada, Colegio, Trabajo).
  * Botón de Pánico SOS con cuenta regresiva de 30 segundos y cancelación.
  * Diálogo de PIN de Coacción (`9999`) con simulación de desbloqueo normal y alerta silenciosa.
  * Modo Falso Apagado (Ghost Mode con pantalla negra).
  * Grabador de audio ambiente de 15 segundos (Caja Negra) con analizador de frecuencias en canvas.
  * Visor interactivo de plantillas de WhatsApp Cloud API con botón ACK.
* **`/python_engine`**: Motor de Reglas y Cálculo Espacial en Python
  * `rules.py`: Evaluación matemática de desvíos (>1.5 km con fórmula de Haversine), desaceleración brusca (>40 a 0 km/h o fuerza G > 4.5G), inactividad y batería crítica.
  * `server.py`: Microservicio FastAPI para evaluación en tiempo real.
  * `simulator.py`: Script de prueba interactivo con 6 escenarios reales para la Familia Andrada.
* **`/backend`**: Servidor Gateway y Despacho en Node.js
  * Servidor Fastify con entrega de archivos estáticos HTML y WebSockets.
  * Worker BullMQ con temporizador de 60 segundos para escalamiento jerárquico.
  * Despacho y webhook para Meta WhatsApp Cloud API y Twilio SMS.
* **`/docker`**: Orquestación de infraestructura con PostgreSQL 16 PostGIS y Redis 7.2.
* **`/mobile`**: Módulos nativos Android (Kotlin) e iOS (Swift) para captura de `ACTION_SHUTDOWN` y servicios en primer plano.

---

## 🚀 Cómo Ejecutar la Plataforma

### Opción 1: Visualizar la Aplicación Web Directamente
Simplemente abre el archivo `web/index.html` en tu navegador web preferido (Chrome, Edge, Firefox, Safari) o usa una extensión como Live Server.

### Opción 2: Ejecutar el Motor de Pruebas en Python
```bash
# Ejecutar los 6 escenarios de prueba de la Familia Andrada
python python_engine/simulator.py

# Iniciar el microservicio FastAPI en Python (puerto 8000)
python python_engine/server.py
```

### Opción 3: Ejecutar el Servidor Integrado Node.js
```bash
cd backend
npm install
npm run dev
# Abrir en el navegador: http://localhost:3000
```

```env
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:postgres_secure_password_2026@localhost:5432/family_safety_db
REDIS_HOST=localhost
REDIS_PORT=6379

# Meta WhatsApp Cloud API (Graph API v21.0)
META_PHONE_NUMBER_ID=tu_phone_number_id
META_WHATSAPP_SYSTEM_USER_TOKEN=tu_access_token_permanente
META_WEBHOOK_VERIFY_TOKEN=seguridad_familiar_webhook_secret_2026

# Twilio SMS Fallback
TWILIO_ACCOUNT_SID=AC_tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_FROM_PHONE=+1234567890
```

### 3. Ejecutar el Backend
```bash
cd backend
npm install
npm run dev
```

### 4. Configurar el Webhook en Meta for Developers
* **URL de Callback:** `https://tu-dominio-publico.com/webhook/whatsapp`
* **Token de Verificación:** `seguridad_familiar_webhook_secret_2026`
* **Campos Suscritos:** `messages`

Cuando un contacto reciba la plantilla interactiva de SOS en WhatsApp y presione el botón **"Estoy en camino"** o **"Confirmar"** (`ACK_ALERT_{id}`), el webhook procesará el evento inmediatamente y cancelará la siguiente fase de escalamiento.
