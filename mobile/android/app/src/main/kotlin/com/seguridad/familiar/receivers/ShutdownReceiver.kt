package com.seguridad.familiar.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import android.util.Log
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ShutdownReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ShutdownReceiver"
        private const val EMERGENCY_ENDPOINT = "https://api.tudominio.com/v1/telemetry/emergency-shutdown"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_SHUTDOWN ||
            action == "android.intent.action.QUICKBOOT_POWEROFF" ||
            action == "com.htc.intent.action.QUICKBOOT_POWEROFF") {

            Log.w(TAG, "🚨 ALERTA CRÍTICA: El sistema operativo se está apagando. Acción: $action")

            // Mantener el proceso despierto brevemente con goAsync()
            val pendingResult = goAsync()
            val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    // 1. Obtener última posición de alta precisión con timeout corto
                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                        .addOnSuccessListener { location ->
                            val lat = location?.latitude ?: 0.0
                            val lng = location?.longitude ?: 0.0
                            val accuracy = location?.accuracy ?: 0f

                            despacharAlertaInmediata(context, lat, lng, accuracy)
                            pendingResult.finish()
                        }
                        .addOnFailureListener { e ->
                            Log.e(TAG, "Fallo al obtener coordenadas GPS durante el apagado", e)
                            despacharAlertaInmediata(context, 0.0, 0.0, -1f)
                            pendingResult.finish()
                        }
                } catch (e: Exception) {
                    Log.e(TAG, "Excepción no controlada durante el cierre de emergencia", e)
                    pendingResult.finish()
                }
            }
        }
    }

    private fun despacharAlertaInmediata(context: Context, lat: Double, lng: Double, accuracy: Float) {
        val prefs = context.getSharedPreferences("safety_app_prefs", Context.MODE_PRIVATE)
        val token = prefs.getString("auth_token", "") ?: ""
        val primaryEmergencyPhone = prefs.getString("primary_contact_phone", "") ?: ""

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(2, TimeUnit.SECONDS)
            .writeTimeout(2, TimeUnit.SECONDS)
            .readTimeout(2, TimeUnit.SECONDS)
            .build()

        val jsonPayload = JSONObject().apply {
            put("event", "ACTION_SHUTDOWN")
            put("latitude", lat)
            put("longitude", lng)
            put("accuracy", accuracy)
            put("batteryLevel", 1)
            put("timestamp", System.currentTimeMillis())
        }

        val requestBody = jsonPayload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(EMERGENCY_ENDPOINT)
            .addHeader("Authorization", "Bearer $token")
            .post(requestBody)
            .build()

        try {
            val response = okHttpClient.newCall(request).execute()
            Log.i(TAG, "Última ubicación enviada con éxito al servidor. Código HTTP: ${response.code}")
        } catch (e: Exception) {
            Log.e(TAG, "Fallo de conectividad de datos durante el apagado. Disparando SMS nativo de respaldo...", e)
            
            // Si la red de datos falla, se intenta el envío directo por SMS de hardware
            if (primaryEmergencyPhone.isNotEmpty()) {
                try {
                    val smsManager = SmsManager.getDefault()
                    val smsMessage = "ALERTA SOS: Mi dispositivo se está apagando. Última posición: https://maps.google.com/?q=$lat,$lng"
                    smsManager.sendTextMessage(primaryEmergencyPhone, null, smsMessage, null, null)
                    Log.i(TAG, "SMS de emergencia despachado al contacto primario.")
                } catch (smsEx: Exception) {
                    Log.e(TAG, "Error enviando SMS de emergencia", smsEx)
                }
            }
        }
    }
}
