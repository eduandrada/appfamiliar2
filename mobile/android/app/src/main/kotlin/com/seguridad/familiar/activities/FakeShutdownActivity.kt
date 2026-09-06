package com.seguridad.familiar.activities

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class FakeShutdownActivity : Activity() {

    private var secretTapCounter = 0
    private val resetHandler = Handler(Looper.getMainLooper())
    private val resetRunnable = Runnable { secretTapCounter = 0 }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Configurar pantalla totalmente negra y brillo al mínimo
        val layoutParams = window.attributes
        layoutParams.screenBrightness = 0.0f
        window.attributes = layoutParams

        // Mantener la pantalla encendida de forma imperceptible para no activar el lockscreen del sistema
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        // 2. Ocultar todas las barras de navegación y estado del sistema (Immersive Sticky)
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insetsController.hide(WindowInsetsCompat.Type.systemBars())

        // 3. Silenciar timbres y vibraciones para simular que el equipo está apagado
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.ringerMode = AudioManager.RINGER_MODE_SILENT

        // Vista de fondo negro absoluto
        val blackView = View(this).apply {
            setBackgroundColor(android.graphics.Color.BLACK)
            setOnClickListener {
                // Mecanismo secreto de salida: 5 toques rápidos en menos de 3 segundos
                secretTapCounter++
                resetHandler.removeCallbacks(resetRunnable)
                resetHandler.postDelayed(resetRunnable, 3000)

                if (secretTapCounter >= 5) {
                    audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
                    finish()
                }
            }
        }
        setContentView(blackView)
    }

    override fun onBackPressed() {
        // Bloquear botón atrás para no romper la ilusión de apagado
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Interceptar teclas de volumen para evitar sonidos visuales o sonoros
        return when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP,
            KeyEvent.KEYCODE_VOLUME_DOWN,
            KeyEvent.KEYCODE_VOLUME_MUTE -> true
            else -> super.onKeyDown(keyCode, event)
        }
    }
}
