# Guía de Despliegue en Render.com con Python

Esta guía explica paso a paso cómo subir la aplicación web **Familia Andrada** a **Render.com** (servicio en la nube gratuito).

---

## 🚀 Requisitos Previos

1. Tener tu proyecto en **GitHub** o **GitLab**.
2. Crear una cuenta gratuita en [Render.com](https://render.com).

---

## 🛠️ Opción 1: Despliegue Automático con Blueprint (`render.yaml`) - RECOMENDADO

1. Inicia sesión en [Render Dashboard](https://dashboard.render.com).
2. Haz clic en el botón **New +** y selecciona **Blueprint**.
3. Conecta tu repositorio de GitHub `app familiar`.
4. Render detectará automáticamente el archivo `render.yaml` que creamos.
5. Haz clic en **Apply**. Render compilará e instalará las dependencias y desplegará la app automáticamente.

---

## ⚙️ Opción 2: Configuración Manual de Web Service

Si prefieres configurarlo manualmente en la web de Render:

1. Ve a tu Dashboard de Render y presiona **New +** -> **Web Service**.
2. Conecta tu repositorio de GitHub.
3. Configura los siguientes campos:
   - **Name:** `app-familiar-andrada` (o el nombre que prefieras)
   - **Region:** Selecciona la más cercana (ej: Oregon o Frankfurt)
   - **Branch:** `main` (o `master`)
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
4. Haz clic en **Create Web Service**.

---

## 🔍 Cómo Probar el Despliegue Localmente

Antes de subir a Render, puedes probar el servidor Python unificado en tu computadora:

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Ejecutar servidor local
python main.py
```

Luego abre en tu navegador:
- 🌐 **Web App:** `http://localhost:8000/`
- 📡 **API Info:** `http://localhost:8000/api/info`
- 🛡️ **Zonas Seguras API:** `http://localhost:8000/api/safe-zones`
- 👥 **Miembros API:** `http://localhost:8000/api/members`
- 📑 **Documentación Interactiva Swagger:** `http://localhost:8000/docs`

---

## ✅ ¿Qué incluye esta solución?

1. **Unificación Frontend + Backend:** El servidor Python FastAPI sirve tanto el diseño web responsive (`index.html`, CSS, JS) como la API de seguridad y telemetría (`/api/...`).
2. **Compatibilidad con SSL/HTTPS en Render:** Render provee un certificado SSL gratuito automáticamente para tu dominio `https://tu-app.onrender.com`.
3. **PWA & Service Workers:** Todos los recursos estáticos se sirven correctamente con soporte para Service Worker (`sw.js`).
