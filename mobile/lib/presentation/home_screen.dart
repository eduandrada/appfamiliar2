import 'dart:async';
import 'package:flutter/material.dart';
import '../core/native_bridge.dart';
import '../widgets/glass_container.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isTrackingActive = false;
  int _countdownSeconds = 30;
  Timer? _countdownTimer;
  bool _isCountdownActive = false;
  final TextEditingSize = 24.0;

  @override
  void initState() {
    super.initState();
    _startTrackingAutomatically();
  }

  Future<void> _startTrackingAutomatically() async {
    final success = await NativeBridge.startLocationTracking();
    if (mounted) {
      setState(() {
        _isTrackingActive = success;
      });
    }
  }

  void _triggerPanicCountdown() {
    setState(() {
      _isCountdownActive = true;
      _countdownSeconds = 30;
    });

    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds > 1) {
        setState(() {
          _countdownSeconds--;
        });
      } else {
        timer.cancel();
        _dispatchSOSAlert();
      }
    });
  }

  void _cancelPanicCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _isCountdownActive = false;
      _countdownSeconds = 30;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Alarma SOS cancelada por el usuario.'),
        backgroundColor: Colors.teal,
      ),
    );
  }

  void _dispatchSOSAlert() {
    setState(() {
      _isCountdownActive = false;
      _countdownSeconds = 30;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🚨 ALERTA SOS ENVIADA A CONTACTOS Y VÍA WHATSAPP CLOUD API'),
        backgroundColor: Colors.redAccent,
        duration: Duration(seconds: 5),
      ),
    );
  }

  void _showDuressPinDialog() {
    final TextEditingController pinController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Desbloqueo de Seguridad', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Ingresa tu código PIN para autorizar cambios o cerrar la aplicación.',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: pinController,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              style: const TextStyle(color: Colors.white, fontSize: 22, letterSpacing: 8),
              decoration: const InputDecoration(
                hintText: '••••',
                hintStyle: TextStyle(color: Colors.white24),
                filled: true,
                fillColor: Color(0xFF0F172A),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
            onPressed: () {
              final pin = pinController.text;
              Navigator.pop(ctx);

              // Validación de PIN Normal vs PIN de Coacción
              if (pin == '9999') {
                // PIN de Coacción: Simula salida limpia pero dispara alarma silenciosa
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Sesión cerrada correctamente.'),
                    backgroundColor: Colors.grey,
                  ),
                );
                // En segundo plano: Activar caja negra (15s audio y fotos) y alertar al backend
              } else if (pin == '1234') {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('PIN verificado con éxito.')),
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('PIN incorrecto.'), backgroundColor: Colors.red),
                );
              }
            },
            child: const Text('Confirmar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isTrackingActive ? const Color(0xFF10B981) : Colors.red,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Escudo Familiar 2026',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.lock_outline, color: Colors.white70),
            tooltip: 'Simulación PIN de Coacción',
            onPressed: _showDuressPinDialog,
          ),
          IconButton(
            icon: const Icon(Icons.power_settings_new, color: Colors.white70),
            tooltip: 'Probar Modo Falso Apagado',
            onPressed: () => NativeBridge.triggerFakeShutdown(),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            children: [
              // Estado en Vivo y Telemetría
              GlassContainer(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildTelemetryItem(Icons.directions_run, 'Edge AI', 'Normal', Colors.purpleAccent),
                    _buildTelemetryItem(Icons.satellite_alt, 'Satélite', 'LEO 2026', Colors.cyanAccent),
                    _buildTelemetryItem(Icons.shield, 'Zona', 'Casa', Colors.amberAccent),
                    _buildTelemetryItem(Icons.bluetooth, 'BLE Mesh', 'Activo', Colors.blueAccent),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // BARRA DE CHECK-INS RÁPIDOS (1-TOQUE) Y ACOMPÁÑAME (SAFE WALK)
              GlassContainer(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Check-ins Rápidos (1-Toque)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                        Text('Acompáñame (Safe Walk)', style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981).withOpacity(0.2), foregroundColor: const Color(0xFF10B981), elevation: 0),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('🟢 Check-in enviado: Llegué bien'), backgroundColor: Color(0xFF10B981)),
                              );
                            },
                            child: const Text('Llegué bien', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B).withOpacity(0.2), foregroundColor: const Color(0xFFF59E0B), elevation: 0),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('🟠 Check-in enviado: Demorado/a'), backgroundColor: Color(0xFFF59E0B)),
                              );
                            },
                            child: const Text('Demorado/a', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8).withOpacity(0.2), foregroundColor: const Color(0xFF38BDF8), elevation: 0),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('🔵 Check-in enviado: En camino'), backgroundColor: Color(0xFF38BDF8)),
                              );
                            },
                            child: const Text('En camino', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // Botón de Pánico SOS Central con Cuenta Regresiva
              if (_isCountdownActive)
                Column(
                  children: [
                    Text(
                      '$_countdownSeconds',
                      style: const TextStyle(fontSize: 84, fontWeight: FontWeight.w900, color: Colors.redAccent),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Despachando alerta a WhatsApp y contactos en...',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white24,
                        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      ),
                      onPressed: _cancelPanicCountdown,
                      icon: const Icon(Icons.cancel, color: Colors.white),
                      label: const Text('CANCELAR SOS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                )
              else
                GestureDetector(
                  onTap: _triggerPanicCountdown,
                  child: Container(
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const RadialGradient(
                        colors: [Color(0xFFEF4444), Color(0xFF991B1B)],
                        stops: [0.6, 1.0],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.redAccent.withOpacity(0.5),
                          blurRadius: 40,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.warning_amber_rounded, color: Colors.white, size: 68),
                          SizedBox(height: 8),
                          Text(
                            'BOTÓN SOS',
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 2),
                          ),
                          Text('Tocar para Emergencia', style: TextStyle(color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                ),

              const Spacer(),

              // Insignia de Transparencia y Registro de Consultas Mutuas
              GlassContainer(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: const [
                    Icon(Icons.visibility_outlined, color: Color(0xFF10B981), size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Transparencia Mutua: Carlos (Papá) vio tu ubicación hace 2 min',
                        style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // Tarjeta informativa de reglas activas
              GlassContainer(
                padding: const EdgeInsets.all(14),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, color: Color(0xFF38BDF8), size: 24),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Motor de Reglas 2026: Detección automática de impactos, desvíos (>1.5 km), inactividad y captura de último GPS al apagarse.',
                        style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTelemetryItem(IconData icon, String label, String value, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 6),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
      ],
    );
  }
}
