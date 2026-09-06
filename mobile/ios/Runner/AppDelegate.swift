import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {

    private let CHANNEL = "com.seguridad.familiar/safety_channel"

    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
        let safetyChannel = FlutterMethodChannel(name: CHANNEL, binaryMessenger: controller.binaryMessenger)

        safetyChannel.setMethodCallHandler({
            (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
            switch call.method {
            case "startLocationTracking":
                LocationService.shared.iniciarRastreo()
                result(true)
            case "stopLocationTracking":
                LocationService.shared.detenerRastreo()
                result(true)
            case "triggerPanic":
                LocationService.shared.despacharUltimaUbicacion(esApagado: false, bateria: 100)
                result(true)
            default:
                result(FlutterMethodNotImplemented)
            }
        })

        GeneratedPluginRegistrant.register(with: self)
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}
