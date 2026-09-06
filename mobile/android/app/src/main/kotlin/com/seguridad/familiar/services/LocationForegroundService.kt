package com.seguridad.familiar.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class LocationForegroundService : Service() {

    companion object {
        private const val TAG = "LocationService"
        const val CHANNEL_ID = "channel_family_safety_persistent_2026"
        const val NOTIFICATION_ID = 9991

        const val ACTION_START_TRACKING = "ACTION_START_TRACKING"
        const val ACTION_STOP_TRACKING = "ACTION_STOP_TRACKING"
        const val ACTION_ULTRA_LOW_POWER = "ACTION_ULTRA_LOW_POWER"
        const val ACTION_NORMAL_TRACKING = "ACTION_NORMAL_TRACKING"

        private const val TELEMETRY_URL = "https://api.tudominio.com/v1/telemetry/ping"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var wakeLock: PowerManager.WakeLock? = null
    private var isUltraLowPower = false
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .build()

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FamilySafety::LocationForegroundWakeLock")
        wakeLock?.acquire(30 * 60 * 1000L) // 30 minutos renovables

        crearCanalNotificacion()
        configurarLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_TRACKING -> {
                detenerServicio()
                return START_NOT_STICKY
            }
            ACTION_ULTRA_LOW_POWER -> {
                isUltraLowPower = true
                configurarFrecuenciaUbicacion(intervalMs = 60000L, fastestIntervalMs = 45000L)
            }
            else -> {
                isUltraLowPower = false
                configurarFrecuenciaUbicacion(intervalMs = 30000L, fastestIntervalMs = 15000L)
            }
        }

        val notification = construirNotificacion(
            "Protección Urbana y Familiar Activa",
            if (isUltraLowPower) "Modo Supervivencia (Ultra Bajo Consumo)" else "Rastreo inteligente en tiempo real habilitado"
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    private fun configurarLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    enviarTelemetriaAlServidor(location)
                }
            }
        }
    }

    private fun configurarFrecuenciaUbicacion(intervalMs: Long, fastestIntervalMs: Long) {
        val priority = if (isUltraLowPower) Priority.PRIORITY_BALANCED_POWER_ACCURACY else Priority.PRIORITY_HIGH_ACCURACY

        val request = LocationRequest.Builder(priority, intervalMs)
            .setMinUpdateIntervalMillis(fastestIntervalMs)
            .setWaitForAccurateLocation(false)
            .build()

        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            Log.i(TAG, "Frecuencia de GPS ajustada: intervalo $intervalMs ms (UltraLow: $isUltraLowPower)")
        } catch (e: SecurityException) {
            Log.e(TAG, "Permiso de ubicación no otorgado", e)
        }
    }

    private fun enviarTelemetriaAlServidor(location: Location) {
        val prefs = getSharedPreferences("safety_app_prefs", Context.MODE_PRIVATE)
        val userId = prefs.getString("user_id", "00000000-0000-0000-0000-000000000001") ?: ""
        val token = prefs.getString("auth_token", "") ?: ""

        val speedKmh = location.speed * 3.6f

        val payload = JSONObject().apply {
            put("userId", userId)
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("accuracyMeters", location.accuracy)
            put("speedKmh", speedKmh)
            put("headingDegrees", location.bearing)
            put("altitudeMeters", location.altitude)
            put("batteryLevel", if (isUltraLowPower) 3 else 75)
            put("networkType", "4G")
            put("timestamp", System.currentTimeMillis())
        }

        val requestBody = payload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(TELEMETRY_URL)
            .addHeader("Authorization", "Bearer $token")
            .post(requestBody)
            .build()

        // Ejecución asíncrona sin bloquear el hilo principal
        httpClient.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: java.io.IOException) {
                Log.w(TAG, "Fallo enviando ping de telemetría a $TELEMETRY_URL: ${e.message}")
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                response.close()
                Log.d(TAG, "Ping de ubicación entregado. Lat: ${location.latitude}, Lng: ${location.longitude}")
            }
        })
    }

    private fun construirNotificacion(titulo: String, mensaje: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(titulo)
            .setContentText(mensaje)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun crearCanalNotificacion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Servicio de Monitoreo Urbano Continuo",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantiene el rastreo de seguridad y respuesta ante emergencias"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun detenerServicio() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        detenerServicio()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
