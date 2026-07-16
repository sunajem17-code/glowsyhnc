//
//  FaceScanPlugin.swift
//  Ascendus
//
//  Capacitor 8 plugin — presents FaceScanView as a fullscreen native modal
//  and resolves the JS promise with face geometry metrics.
//
//  JS usage:
//    import { registerPlugin } from '@capacitor/core'
//    const FaceScanPlugin = registerPlugin('FaceScanPlugin')
//    const result = await FaceScanPlugin.startFaceScan()
//    // result: { supported, cancelled?, jawWidthCM, faceHeightCM, faceWidthCM,
//    //           faceRatio, symmetryScore, cheekboneWidthCM }
//

import Foundation
import Capacitor
import ARKit
import SwiftUI

@objc(FaceScanPlugin)
public class FaceScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier    = "FaceScanPlugin"
    public let jsName        = "FaceScanPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startFaceScan", returnType: CAPPluginReturnPromise),
    ]

    @objc func startFaceScan(_ call: CAPPluginCall) {
        guard ARFaceTrackingConfiguration.isSupported else {
            call.resolve(["supported": false])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let rootVC = self.bridge?.viewController else {
                call.reject("No root view controller available")
                return
            }

            // Box holds the hosting controller reference so the closures can dismiss it
            // without a retain cycle — the hosting VC captures the box, not itself.
            final class VCBox { var vc: UIViewController? }
            let box = VCBox()

            let view = FaceScanView(
                onComplete: { result in
                    DispatchQueue.main.async { box.vc?.dismiss(animated: true) }
                    let metrics = result.metrics

                    // JPEG-encode the captured photo so the JS side can display it —
                    // quality 0.85 matches the compression used elsewhere in the app.
                    var imageBase64: String? = nil
                    if let image = result.image, let jpegData = image.jpegData(compressionQuality: 0.85) {
                        imageBase64 = "data:image/jpeg;base64," + jpegData.base64EncodedString()
                    }

                    // landmarks2D values are CGPoint — flatten to [x, y] arrays since
                    // Capacitor's plugin call bridge only accepts JSON-safe types.
                    let landmarks2D: [String: [Double]] = result.landmarks2D.mapValues {
                        [Double($0.x), Double($0.y)]
                    }

                    call.resolve([
                        "supported":       true,
                        "cancelled":       false,
                        "jawWidthCM":      metrics.jawWidthCM,
                        "faceHeightCM":    metrics.faceHeightCM,
                        "faceWidthCM":     metrics.faceWidthCM,
                        "faceRatio":       metrics.faceRatio,
                        "symmetryScore":   metrics.symmetryScore,
                        "cheekboneWidthCM": metrics.cheekboneWidthCM,
                        "bitemporalWidthCM":     metrics.bitemporalWidthCM,
                        "bigonialWidthPercent":  metrics.bigonialWidthPercent,
                        "midfaceRatio":          metrics.midfaceRatio,
                        "jawAsymmetryScore":     metrics.jawAsymmetryScore,
                        "cheekboneAsymmetryScore": metrics.cheekboneAsymmetryScore,
                        "templeAsymmetryScore":  metrics.templeAsymmetryScore,
                        "facialAngleDegrees":    metrics.facialAngleDegrees,
                        "noseProjectionMM":      metrics.noseProjectionMM,
                        "chinProjectionMM":      metrics.chinProjectionMM,
                        "facialConvexityDegrees": metrics.facialConvexityDegrees,
                        "foreheadSlopeDegrees":  metrics.foreheadSlopeDegrees,
                        "gonialAngleDegrees":    metrics.gonialAngleDegrees,
                        // Photo + normalized (0-1) 2D landmark positions within it —
                        // powers the "tap a stat, see it pointed out on your face" UI.
                        "capturedImage":   imageBase64 as Any,
                        "landmarks2D":     landmarks2D,
                    ])
                },
                onCancel: {
                    DispatchQueue.main.async { box.vc?.dismiss(animated: true) }
                    call.resolve(["supported": true, "cancelled": true])
                }
            )

            let hostingVC = UIHostingController(rootView: view)
            hostingVC.modalPresentationStyle = .fullScreen
            box.vc = hostingVC
            rootVC.present(hostingVC, animated: true)
        }
    }
}
