import 'package:flutter/services.dart';

class NativeBridge {
  static const MethodChannel _channel = MethodChannel('com.seguridad.familiar/safety_channel');

  /// Inicia el servicio persistente de localización en segundo plano (Foreground Service en Android / Always en iOS)
  static Future<bool> startLocationTracking() async {
    try {
      final bool? success = await _channel.invokeMethod<bool>('startLocationTracking');
      return success ?? false;
    } on PlatformException catch (e) {
      print('Error al iniciar rastreo de localización: ${e.message}');
      return false;
    }
  }

  /// Detiene el servicio de localización en segundo plano
  static Future<bool> stopLocationTracking() async {
    try {
      final bool? success = await _channel.invokeMethod<bool>('stopLocationTracking');
      return success ?? false;
    } on PlatformException catch (e) {
      print('Error al detener rastreo de localización: ${e.message}');
      return false;
    }
  }

  /// Activa el modo Falso Apagado (Ghost Mode) en Android
  static Future<bool> triggerFakeShutdown() async {
    try {
      final bool? success = await _channel.invokeMethod<bool>('triggerFakeShutdown');
      return success ?? false;
    } on PlatformException catch (e) {
      print('Error al activar falso apagado: ${e.message}');
      return false;
    }
  }
}
