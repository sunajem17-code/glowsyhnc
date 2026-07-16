//
//  FaceScanARView.swift
//  Ascendus
//
//  Live ARKit face-tracking capture screen. Requires a device with a TrueDepth
//  camera (iPhone X or later). Renders a glowing cyan wireframe mesh over the
//  tracked face in real time, then lets the user "lock in" a scan, which snapshots
//  the current ARFaceGeometry and hands it to FaceMetrics for real computation.
//
//  Wire this into SwiftUI via the FaceScanARViewRepresentable at the bottom of
//  this file.
//

import ARKit
import SceneKit
import SwiftUI

/// Bundles the computed metrics with a captured photo and the 2D screen
/// position of each landmark within that photo — this is what lets the
/// results UI point at a specific spot on the user's face when they tap a
/// stat. `landmarks2D` values are normalized 0-1 (fraction of image width/height).
///
/// NOTE: front-camera image orientation/mirroring for ARKit's TrueDepth feed
/// is one of those things that's easy to get subtly wrong without a physical
/// device in hand — the .leftMirrored orientation used below matches the
/// standard convention for portrait front-camera capture, but verify the
/// captured photo looks right-side-up and un-mirrored on an actual device
/// before shipping, and adjust if not.
struct FaceScanCapture {
    let metrics: FaceMetrics
    let image: UIImage?
    let landmarks2D: [String: CGPoint]
}

protocol FaceScanARViewControllerDelegate: AnyObject {
    func faceScan(_ controller: FaceScanARViewController, didCapture capture: FaceScanCapture)
    func faceScanTrackingUnavailable(_ controller: FaceScanARViewController)
}

final class FaceScanARViewController: UIViewController, ARSCNViewDelegate, ARSessionDelegate {

    weak var delegate: FaceScanARViewControllerDelegate?

    private let sceneView = ARSCNView()
    private var faceNode: SCNNode?
    private var latestGeometry: ARFaceGeometry?
    private var latestTransform: simd_float4x4?

    override func viewDidLoad() {
        super.viewDidLoad()

        guard ARFaceTrackingConfiguration.isSupported else {
            delegate?.faceScanTrackingUnavailable(self)
            return
        }

        sceneView.frame = view.bounds
        sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        sceneView.delegate = self
        sceneView.session.delegate = self
        sceneView.automaticallyUpdatesLighting = true
        view.addSubview(sceneView)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        guard ARFaceTrackingConfiguration.isSupported else { return }

        let configuration = ARFaceTrackingConfiguration()
        configuration.isLightEstimationEnabled = true
        sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sceneView.session.pause()
    }

    /// Call this from a "Scan" / capture button in your UI to lock in the current frame.
    func captureCurrentScan() {
        guard let geometry = latestGeometry, let transform = latestTransform else { return }
        let metrics = FaceMetrics.compute(from: geometry, faceTransform: transform)
        let (image, landmarks2D) = captureImageAndProjectLandmarks(metrics: metrics, transform: transform)
        delegate?.faceScan(self, didCapture: FaceScanCapture(metrics: metrics, image: image, landmarks2D: landmarks2D))
    }

    /// Grabs the current camera frame as a UIImage and projects each named
    /// landmark point (from FaceMetrics.landmarkPoints, local face-mesh space)
    /// into that image's 2D coordinate space via ARKit's camera projection —
    /// this is real math (a projection matrix multiply), not an estimate.
    ///
    /// FIXED: this used to project into `view.bounds.size` (the on-screen AR
    /// view, which SceneKit fills/crops the camera feed into) and then treat
    /// those fractions as if they applied to `frame.capturedImage` (the full,
    /// UNCROPPED sensor buffer — a different aspect ratio/resolution than the
    /// screen). Since the full buffer shows more vertical content than the
    /// cropped on-screen view, every landmark came out shifted toward the top
    /// once applied to the real photo — jaw dots landing near the mouth,
    /// cheekbone dots landing near the eyebrows, that kind of thing. Fix:
    /// project into the pixel buffer's OWN dimensions (rotated to portrait to
    /// match how it's actually oriented/saved below), so the fractions are
    /// computed in the same coordinate space as the image they'll be drawn
    /// on. Also mirrors X to match `.leftMirrored`, the orientation the saved
    /// photo is encoded with — projectPoint's `orientation:` param only
    /// rotates, it doesn't mirror, so left/right landmarks were silently
    /// unflipped relative to the mirrored photo.
    private func captureImageAndProjectLandmarks(
        metrics: FaceMetrics, transform: simd_float4x4
    ) -> (UIImage?, [String: CGPoint]) {
        guard let frame = sceneView.session.currentFrame else { return (nil, [:]) }

        let ciImage = CIImage(cvPixelBuffer: frame.capturedImage)
        let context = CIContext()
        var image: UIImage?
        if let cgImage = context.createCGImage(ciImage, from: ciImage.extent) {
            // Front TrueDepth camera in portrait — .leftMirrored is the standard
            // orientation fix for this combination. Verify on-device.
            image = UIImage(cgImage: cgImage, scale: 1.0, orientation: .leftMirrored)
        }

        // The pixel buffer comes out of the camera in its native landscape
        // orientation; once rotated to portrait (matching .leftMirrored
        // above) width and height swap. This — not view.bounds — is the
        // coordinate space frame.capturedImage actually lives in.
        let bufferWidth  = CVPixelBufferGetWidth(frame.capturedImage)
        let bufferHeight = CVPixelBufferGetHeight(frame.capturedImage)
        let portraitImageSize = CGSize(width: bufferHeight, height: bufferWidth)

        var points2D: [String: CGPoint] = [:]
        guard portraitImageSize.width > 0, portraitImageSize.height > 0 else { return (image, [:]) }
        for (name, localPoint) in metrics.landmarkPoints {
            let local4 = simd_float4(localPoint.x, localPoint.y, localPoint.z, 1)
            let world4 = transform * local4
            guard world4.w != 0 else { continue }
            let worldPoint = simd_float3(world4.x, world4.y, world4.z) / world4.w
            let projected = frame.camera.projectPoint(worldPoint, orientation: .portrait, viewportSize: portraitImageSize)
            let fx = projected.x / portraitImageSize.width
            let fy = projected.y / portraitImageSize.height
            // Mirror X to match the saved image's .leftMirrored orientation.
            points2D[name] = CGPoint(x: 1.0 - fx, y: fy)
        }
        return (image, points2D)
    }

    // MARK: - ARSCNViewDelegate

    func renderer(_ renderer: SCNSceneRenderer, nodeFor anchor: ARAnchor) -> SCNNode? {
        guard let faceAnchor = anchor as? ARFaceAnchor else { return nil }

        let geometry = ARSCNFaceGeometry(device: sceneView.device!)
        let node = SCNNode(geometry: geometry)
        node.geometry?.firstMaterial?.fillMode = .lines
        node.geometry?.firstMaterial?.diffuse.contents = UIColor.cyan
        node.geometry?.firstMaterial?.emission.contents = UIColor.cyan
        node.geometry?.firstMaterial?.transparency = 0.85

        faceNode = node
        latestGeometry = faceAnchor.geometry
        latestTransform = faceAnchor.transform

        return node
    }

    func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        guard let faceAnchor = anchor as? ARFaceAnchor,
              let faceGeometry = node.geometry as? ARSCNFaceGeometry else { return }

        faceGeometry.update(from: faceAnchor.geometry)
        latestGeometry = faceAnchor.geometry
        latestTransform = faceAnchor.transform
    }
}

// MARK: - SwiftUI bridge

/// Holds a live reference to the running AR controller so the "Scan" button can
/// trigger a capture directly, without ever mutating @State/@Binding from inside
/// updateUIViewController (that pattern is what caused the "Modifying state during
/// view update" warnings — SwiftUI flags any state write that originates from a
/// Representable's own update cycle, even when dispatched async).
final class FaceScanController: ObservableObject {
    fileprivate weak var viewController: FaceScanARViewController?

    /// Call this from your "Scan" button's action.
    func capture() {
        DispatchQueue.main.async { [weak self] in
            self?.viewController?.captureCurrentScan()
        }
    }
}

struct FaceScanARViewRepresentable: UIViewControllerRepresentable {
    @ObservedObject var controllerHolder: FaceScanController
    var onCapture: (FaceScanCapture) -> Void
    var onUnavailable: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture, onUnavailable: onUnavailable)
    }

    func makeUIViewController(context: Context) -> FaceScanARViewController {
        let controller = FaceScanARViewController()
        controller.delegate = context.coordinator
        controllerHolder.viewController = controller
        return controller
    }

    func updateUIViewController(_ uiViewController: FaceScanARViewController, context: Context) {
        // Intentionally empty — capture is triggered directly via FaceScanController.capture(),
        // not through SwiftUI state changes, so this never needs to react to updates.
    }

    final class Coordinator: NSObject, FaceScanARViewControllerDelegate {
        let onCapture: (FaceScanCapture) -> Void
        let onUnavailable: () -> Void

        init(onCapture: @escaping (FaceScanCapture) -> Void, onUnavailable: @escaping () -> Void) {
            self.onCapture = onCapture
            self.onUnavailable = onUnavailable
        }

        func faceScan(_ controller: FaceScanARViewController, didCapture capture: FaceScanCapture) {
            onCapture(capture)
        }

        func faceScanTrackingUnavailable(_ controller: FaceScanARViewController) {
            onUnavailable()
        }
    }
}
