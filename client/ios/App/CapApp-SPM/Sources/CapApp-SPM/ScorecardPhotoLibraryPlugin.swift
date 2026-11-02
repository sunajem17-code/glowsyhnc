import Capacitor
import Foundation
import Photos
import UIKit

@objc(ScorecardPhotoLibraryPlugin)
public class ScorecardPhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScorecardPhotoLibraryPlugin"
    public let jsName = "ScorecardPhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveImage(_ call: CAPPluginCall) {
        guard let encoded = call.getString("base64"),
              let imageData = Data(base64Encoded: encoded, options: [.ignoreUnknownCharacters]),
              UIImage(data: imageData) != nil else {
            call.reject("The scorecard image could not be read")
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized else {
                call.reject("Photo library permission is required to save the scorecard")
                return
            }

            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, data: imageData, options: nil)
            }) { success, error in
                if success {
                    call.resolve(["saved": true])
                } else {
                    call.reject("The scorecard could not be saved to Photos", nil, error)
                }
            }
        }
    }
}
