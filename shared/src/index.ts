import { z } from 'zod';

export type AlertType =
  | 'SHUTDOWN'
  | 'CRITICAL_BATTERY'
  | 'ROUTE_DEVIATION'
  | 'INACTIVITY'
  | 'IMPACT'
  | 'DURESS_PANIC'
  | 'OFFLINE_BEACON';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'ACTIVE' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED';

export type EscalationChannel = 'WHATSAPP' | 'SMS';

export const TelemetryPayloadSchema = z.object({
  userId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().default(5.0),
  speedKmh: z.number().min(0).default(0),
  headingDegrees: z.number().min(0).max(360).optional(),
  altitudeMeters: z.number().optional(),
  batteryLevel: z.number().min(0).max(100),
  isCharging: z.boolean().default(false),
  networkType: z.enum(['WIFI', '4G', '5G', 'BLE_MESH', 'OFFLINE']).default('4G'),
  isShutdownEvent: z.boolean().optional(),
  accelerometerMaxG: z.number().optional(),
  timestamp: z.number()
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

export interface IncidentAlert {
  id: string;
  userId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  latitude: number;
  longitude: number;
  status: AlertStatus;
  telemetrySnapshot: Record<string, any>;
  blackBoxMediaUrls?: {
    audioUrl?: string;
    frontPhotoUrl?: string;
    rearPhotoUrl?: string;
  };
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  contactName: string;
  phoneE164: string;
  priorityOrder: number;
  receiveWhatsapp: boolean;
  receiveSms: boolean;
}

export interface WhatsAppAlertPayload {
  toPhoneNumberE164: string;
  userName: string;
  alertTypeDesc: string;
  batteryLevel: number;
  speedKmh: number;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  alertId: string;
}
