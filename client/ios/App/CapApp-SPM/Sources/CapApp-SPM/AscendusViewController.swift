import Capacitor

/// CAPBridgeViewController subclass required to register inline CAPBridgedPlugin
/// implementations that live in the CapApp-SPM package. Capacitor 6+ no longer
/// auto-discovers CAPBridgedPlugin conformers via the ObjC runtime — they must
/// be registered explicitly inside capacitorDidLoad().
public class AscendusViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPlugin(FaceScanPlugin.self)
    }
}
