import Capacitor
import Foundation

/// Small bridge from the React app to Firebase Analytics in the iOS target.
/// The Firebase SDK stays in the app target; this plugin only forwards
/// allowlisted, non-identifying events through NotificationCenter.
@objc(NativeAnalyticsPlugin)
public class NativeAnalyticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAnalyticsPlugin"
    public let jsName = "NativeAnalytics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setCollectionEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logEvent", returnType: CAPPluginReturnPromise)
    ]

    private let allowedEvents: Set<String> = [
        "screen_reached",
        "screen_view",
        "app_session_start",
        "app_session_end"
    ]

    @objc func setCollectionEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        NotificationCenter.default.post(
            name: Notification.Name("com.ascendus.analytics.collection"),
            object: nil,
            userInfo: ["enabled": enabled]
        )
        call.resolve()
    }

    @objc func logEvent(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), allowedEvents.contains(name) else {
            call.reject("Unsupported analytics event")
            return
        }

        let parameters = call.getObject("parameters") ?? [:]
        NotificationCenter.default.post(
            name: Notification.Name("com.ascendus.analytics.event"),
            object: nil,
            userInfo: ["name": name, "parameters": parameters]
        )
        call.resolve()
    }
}
