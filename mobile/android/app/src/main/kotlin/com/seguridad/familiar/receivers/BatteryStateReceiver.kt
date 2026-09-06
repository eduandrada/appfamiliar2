package com.seguridad.familiar.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.util.Log
import com.seguridad.familiar.activities.FakeShutdownActivity
import com.seguridad.familiar.services.LocationForegroundService

class BatteryStateReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BatteryStateReceiver"
        private const val CRITICAL_THRESHOLD = 3 // 3%
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BATTERY_CHANGED || action == Intent.ACTION_BATTERY_LOW) {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val isCharging = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1) == BatteryManager.BATTERY_STATUS_CHARGING

            if (level >= 0 && scale > 0) {
                val batteryPct = (level * 100 / scale.toFloat()).toInt()

                Log.d(TAG, "Nivel de batería actual: $batteryPct% (Cargando: $isCharging)")

                if (batteryPct <= CRITICAL_THRESHOLD && !isCharging) {
                    Log.w(TAG, "⚠️ Batería crítica detectada ($batteryPct% <= $CRITICAL_THRESHOLD%). Activando protocolo de supervivencia.")

                    // 1. Conmutar el servicio de ubicación al modo Ultra-Low Power
                    val serviceIntent = Intent(context, LocationForegroundService::class.java).apply {
                        this.action = LocationForegroundService.ACTION_ULTRA_LOW_POWER
                    }
                    context.startService(serviceIntent)

                    // 2. Verificar preferencia de Falso Apagado (Ghost Mode)
                    val prefs = context.getSharedPreferences("safety_app_prefs", Context.MODE_PRIVATE)
                    val fakeShutdownEnabled = prefs.getBoolean("enable_fake_shutdown", true)

                    if (fakeShutdownEnabled) {
                        Log.i(TAG, "Lanzando FakeShutdownActivity (Modo Falso Apagado - Pantalla Fantasma).")
                        val fakeIntent = Intent(context, FakeShutdownActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        }
                        context.startActivity(fakeIntent)
                    }
                }
            }
        }
    }
}
