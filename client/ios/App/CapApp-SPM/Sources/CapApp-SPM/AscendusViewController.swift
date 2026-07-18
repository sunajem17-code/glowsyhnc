import Capacitor

/// CAPBridgeViewController subclass required to register inline CAPBridgedPlugin
/// implementations that live in the CapApp-SPM package. Capacitor 6+ no longer
/// auto-discovers CAPBridgedPlugin conformers via the ObjC runtime — they must
/// be registered explicitly inside capacitorDidLoad().
///
/// IMPORTANT: registerPluginType(_:) is a silent no-op whenever autoRegisterPlugins
/// is enabled (see CapacitorBridge.swift: "if autoRegisterPlugins { return }") — and
/// autoRegisterPlugins has to stay enabled here since it's what wires up all the
/// npm-based plugins (Camera, Device, etc.) via capacitor.config.json. So local
/// CAPBridgedPlugin types must be registered with registerPluginInstance(_:) instead,
/// which has no such guard.
public class AscendusViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FaceScanPlugin())
        bridge?.registerPluginInstance(PhotoGeometryPlugin())
    }
}
