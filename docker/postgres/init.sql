-- ==============================================================================
-- SISTEMA DE SEGURIDAD FAMILIAR Y URBANA (VERSIÓN 2026)
-- Esquema de Base de Datos Geoespacial (PostgreSQL 16 + PostGIS 3.4)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(120) NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL UNIQUE,
    duress_pin_hash VARCHAR(255) NOT NULL, -- Hash seguro del PIN de Coacción
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Círculos de Protección / Grupos Familiares
CREATE TABLE IF NOT EXISTS family_circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Miembros del Círculo
CREATE TABLE IF NOT EXISTS circle_members (
    circle_id UUID REFERENCES family_circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER', -- 'ADMIN', 'MEMBER', 'PROTECTED'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (circle_id, user_id)
);

-- 4. Contactos de Emergencia (Jerarquía de Escalamiento)
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contact_name VARCHAR(100) NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    priority_order INT NOT NULL DEFAULT 1, -- 1: Primario, 2: Secundario, 3: Terciario
    receive_whatsapp BOOLEAN DEFAULT TRUE,
    receive_sms BOOLEAN DEFAULT TRUE,
    relationship VARCHAR(50) DEFAULT 'FAMILIAR',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Zonas Seguras (Geocercas Poligonales y Radiales)
CREATE TABLE IF NOT EXISTS safe_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'Casa', 'Colegio', 'Trabajo'
    radius_meters DOUBLE PRECISION DEFAULT 150.0,
    area GEOMETRY(Polygon, 4326) NULL, -- Polígono exacto si se define
    center_point GEOGRAPHY(Point, 4326) NOT NULL, -- Centroide WGS84
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safe_zones_center ON safe_zones USING GIST (center_point);
CREATE INDEX IF NOT EXISTS idx_safe_zones_user ON safe_zones(user_id);

-- 6. Historial de Telemetría y Ubicaciones (Particionado)
CREATE TABLE IF NOT EXISTS location_history (
    id BIGSERIAL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    accuracy_meters REAL,
    speed_kmh REAL,
    heading_degrees REAL,
    altitude_meters REAL,
    battery_level INT,
    is_charging BOOLEAN DEFAULT FALSE,
    network_type VARCHAR(20) DEFAULT '4G', -- 'WIFI', '4G', '5G', 'BLE_MESH', 'OFFLINE'
    recorded_at TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Partición por defecto y del año en curso
CREATE TABLE IF NOT EXISTS location_history_default PARTITION OF location_history DEFAULT;
CREATE INDEX IF NOT EXISTS idx_location_history_coords ON location_history USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_location_history_user_time ON location_history (user_id, recorded_at DESC);

-- 7. Registro de Incidentes y Alertas
CREATE TABLE IF NOT EXISTS incident_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'SHUTDOWN', 'CRITICAL_BATTERY', 'ROUTE_DEVIATION', 'INACTIVITY', 'IMPACT', 'DURESS_PANIC'
    severity VARCHAR(20) NOT NULL,    -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    trigger_coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    telemetry_snapshot JSONB NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE', 'ESCALATED', 'ACKNOWLEDGED', 'RESOLVED'
    black_box_media_urls JSONB,        -- Enlaces a S3: fotos dual-camera y audio de 15s
    acknowledged_by_contact_id UUID REFERENCES emergency_contacts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incident_alerts_user ON incident_alerts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_incident_alerts_coords ON incident_alerts USING GIST (trigger_coordinates);

-- 8. Bitácora de Escalamiento Jerárquico de Notificaciones
CREATE TABLE IF NOT EXISTS alert_escalation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES incident_alerts(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES emergency_contacts(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL, -- 'WHATSAPP', 'SMS'
    status VARCHAR(30) NOT NULL,  -- 'DISPATCHED', 'DELIVERED', 'READ', 'FAILED', 'TIMED_OUT'
    provider_message_id VARCHAR(100),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalation_alert ON alert_escalation_logs (alert_id);
