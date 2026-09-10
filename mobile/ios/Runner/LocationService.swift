import Foundation
import CoreLocation
import UIKit

@objc class LocationService: NSObject, CLLocationManagerDelegate {
    @objc static let shared = LocationService()

    private let locationManager = CLLocationManager()
    private var isTrackingActive = false
    private let telemetryEndpoint = "https://api.tudominio.com/v1/telemetry/ping"

    private override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 15.0 // Actualizar cada 15 metros

        // Habilitar actualizaciones en segundo plano permanentes
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true

        configurarMonitoreoBateria()
    }

    @objc func iniciarRastreo() {
        guard !isTrackingActive else { return }
        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()
        isTrackingActive = true
        print("[iOS LocationService] Rastreo en segundo plano iniciado con éxito.")
    }

    @objc func detenerRastreo() {
        locationManager.stopUpdatingLocation()
        locationManager.stopMonitoringSignificantLocationChanges()
        isTrackingActive = false
    }

    private func obtenerPorcentajeBateria() -> Int {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let nivel = UIDevice.current.batteryLevel
        if nivel >= 0.0 {
            return Int(nivel * 100.0)
        }
        return 100 // Default 100% si no está disponible o en simulador
    }

    private func configurarMonitoreoBateria() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(bateriaNivelCambio),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
    }

    @objc private func bateriaNivelCambio() {
        let porcentaje = obtenerPorcentajeBateria()
        print("[iOS BatteryMonitor] Nivel de batería real: \(porcentaje)%")

        if porcentaje <= 5 && porcentaje > 0 {
            print("🚨 [iOS BatteryMonitor] Batería crítica detectada (<= 5%). Despachando paquete de supervivencia.")
            despacharUltimaUbicacion(esApagado: false, bateria: porcentaje)
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        let lat = location.coordinate.latitude
        let lng = location.coordinate.longitude
        let speedKmh = max(0, location.speed * 3.6)
        let batteryPct = obtenerPorcentajeBateria()

        enviarPingHttp(lat: lat, lng: lng, speedKmh: speedKmh, batteryPct: batteryPct, esCritico: false)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            print("[iOS LocationService] Permiso 'Always' concedido.")
            manager.startUpdatingLocation()
        case .authorizedWhenInUse:
            print("[iOS LocationService] Solo 'WhenInUse' concedido. Solicitando 'Always'...")
            manager.requestAlwaysAuthorization()
        default:
            print("[iOS LocationService] Permiso de ubicación denegado o no determinado.")
        }
    }

    private func despacharUltimaUbicacion(esApagado: Bool, bateria: Int) {
        guard let loc = locationManager.location else { return }
        enviarPingHttp(
            lat: loc.coordinate.latitude,
            lng: loc.coordinate.longitude,
            speedKmh: max(0, loc.speed * 3.6),
            batteryPct: bateria,
            esCritico: true
        )
    }

    private func enviarPingHttp(lat: Double, lng: Double, speedKmh: Double, batteryPct: Int, esCritico: Bool) {
        let endpoint = UserDefaults.standard.string(forKey: "telemetry_endpoint") ?? telemetryEndpoint
        guard let url = URL(string: endpoint) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let finalBattery = max(1, min(100, batteryPct))

        let payload: [String: Any] = [
            "userId": UserDefaults.standard.string(forKey: "user_id") ?? "carlos_andrada",
            "latitude": lat,
            "longitude": lng,
            "speedKmh": speedKmh,
            "batteryLevel": finalBattery,
            "battery": finalBattery,
            "isShutdownEvent": esCritico,
            "networkType": "4G/WiFi",
            "timestamp": Int(Date().timeIntervalSince1970 * 1000)
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    print("[iOS LocationService] Error en ping de ubicación: \(error.localizedDescription)")
                }
            }
            task.resume()
        } catch {
            print("[iOS LocationService] Error serializando JSON de telemetría")
        }
    }
}
