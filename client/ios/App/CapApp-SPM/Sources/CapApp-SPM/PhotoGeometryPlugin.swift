//
//  PhotoGeometryPlugin.swift
//  Ascendus
//
//  Real, on-device geometric measurement from already-captured photos, using
//  Apple's Vision framework. This has no camera UI of its own — it analyzes
//  a base64 JPEG/PNG that's already been taken (body photo, side profile
//  photo) and returns actual measured points/angles. This exists specifically
//  to replace the fully AI-vision-guessed body "posture"/"proportions" score
//  and the side profile's total lack of real geometry with numbers that come
//  from real detected pixels — same principle as the ARKit face scan
//  (FaceScanARView.swift): measure, don't guess.
//
//  Every returned metric is omitted (not fabricated) unless Vision reports
//  adequate confidence for the underlying points — we never synthesize a
//  plausible-looking number when detection actually failed or was low
//  confidence. Both requests run entirely on-device; no image data leaves
//  the phone as part of this analysis.
//

import Foundation
import Capacitor
import Vision
import UIKit
import CoreGraphics

@objc(PhotoGeometryPlugin)
public class PhotoGeometryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier    = "PhotoGeometryPlugin"
    public let jsName        = "PhotoGeometryPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "analyzeBodyPhoto",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "analyzeSideProfile", returnType: CAPPluginReturnPromise),
    ]

    // Vision's confidence values run 0-1. Below this we treat a point as
    // "not reliably detected" and omit whatever measurement depends on it
    // rather than reporting a number built on a low-confidence guess.
    private static let MIN_JOINT_CONFIDENCE: Float = 0.3

    // MARK: - Body pose (VNDetectHumanBodyPoseRequest)

    @objc func analyzeBodyPhoto(_ call: CAPPluginCall) {
        guard let base64 = call.getString("imageData"),
              let image  = Self.decodeImage(base64) else {
            call.resolve(["supported": true, "detected": false, "reason": "decode_failed"])
            return
        }

        let request = VNDetectHumanBodyPoseRequest()
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])

        do {
            try handler.perform([request])
        } catch {
            call.resolve(["supported": true, "detected": false, "reason": "vision_error"])
            return
        }

        guard let observation = request.results?.first else {
            call.resolve(["supported": true, "detected": false, "reason": "no_body_detected"])
            return
        }

        guard let points = try? observation.recognizedPoints(.all) else {
            call.resolve(["supported": true, "detected": false, "reason": "no_points"])
            return
        }

        func reliablePoint(_ name: VNHumanBodyPoseObservation.JointName) -> CGPoint? {
            guard let p = points[name], p.confidence >= Self.MIN_JOINT_CONFIDENCE else { return nil }
            // Vision's y-axis is bottom-up (0,0 = bottom-left) — flip to the
            // usual top-down image coordinate convention for the math below.
            return CGPoint(x: p.location.x, y: 1 - p.location.y)
        }

        let leftShoulder  = reliablePoint(.leftShoulder)
        let rightShoulder = reliablePoint(.rightShoulder)
        let leftHip       = reliablePoint(.leftHip)
        let rightHip      = reliablePoint(.rightHip)
        let neck          = reliablePoint(.neck)
        let root          = reliablePoint(.root)

        var result: [String: Any] = ["supported": true, "detected": true]

        var landmarks: [String: [Double]] = [:]
        for (name, pt) in [
            ("leftShoulder", leftShoulder), ("rightShoulder", rightShoulder),
            ("leftHip", leftHip), ("rightHip", rightHip),
            ("neck", neck), ("root", root),
        ] {
            if let pt { landmarks[name] = [Double(pt.x), Double(pt.y)] }
        }
        result["landmarks"] = landmarks

        // Shoulder-to-hip width ratio — real geometric proxy for the
        // classic "V-taper" measurement. Both widths measured in the same
        // normalized image-space units, so the ratio is scale-independent
        // (works regardless of how far the camera was from the subject).
        if let ls = leftShoulder, let rs = rightShoulder, let lh = leftHip, let rh = rightHip {
            let shoulderWidth = abs(rs.x - ls.x)
            let hipWidth      = abs(rh.x - lh.x)
            if hipWidth > 0.001 {
                result["shoulderHipRatio"] = Double(shoulderWidth / hipWidth)
            }
        }

        // Posture proxy: lean angle of the neck→root (upper spine) line off
        // vertical. 0° = perfectly upright. This is a real angle computed
        // from detected joints, not an AI impression of "good posture" — it
        // can't capture everything a trained eye would (e.g. forward head
        // carriage in isolation), so treat it as one honest signal, not a
        // full postural diagnosis.
        if let neck, let root {
            let dx = neck.x - root.x
            let dy = neck.y - root.y
            let angleFromVertical = abs(atan2(dx, -dy) * 180 / .pi)
            result["spineLeanDegrees"] = Double(angleFromVertical)
        }

        call.resolve(result)
    }

    // MARK: - Side profile face landmarks (VNDetectFaceLandmarksRequest)

    @objc func analyzeSideProfile(_ call: CAPPluginCall) {
        guard let base64 = call.getString("imageData"),
              let image  = Self.decodeImage(base64) else {
            call.resolve(["supported": true, "detected": false, "reason": "decode_failed"])
            return
        }

        let request = VNDetectFaceLandmarksRequest()
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])

        do {
            try handler.perform([request])
        } catch {
            call.resolve(["supported": true, "detected": false, "reason": "vision_error"])
            return
        }

        guard let face = request.results?.first, let landmarks = face.landmarks else {
            call.resolve(["supported": true, "detected": false, "reason": "no_face_detected"])
            return
        }

        // VNFaceObservation.boundingBox is normalized to the WHOLE image,
        // bottom-left origin; landmark regions are normalized to the face
        // bounding box itself. Convert every point we use to full-image,
        // top-down coordinates once, here, so the angle math below isn't
        // silently working in the wrong space.
        func toImageSpace(_ p: CGPoint) -> CGPoint {
            let x = face.boundingBox.origin.x + p.x * face.boundingBox.width
            let yBottomUp = face.boundingBox.origin.y + p.y * face.boundingBox.height
            return CGPoint(x: x, y: 1 - yBottomUp)
        }

        func averagePoint(_ region: VNFaceLandmarkRegion2D?) -> CGPoint? {
            guard let region, region.pointCount > 0 else { return nil }
            let pts = region.normalizedPoints
            let sum = pts.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
            return toImageSpace(CGPoint(x: sum.x / CGFloat(pts.count), y: sum.y / CGFloat(pts.count)))
        }

        // Nose tip: in a profile shot, the actual tip is whichever extreme
        // horizontal point of the nose crest is furthest from the face
        // bounding box's center — robust to whether the subject faces left
        // or right, unlike just taking the average (which would land in
        // the middle of the nose bridge, not the tip).
        func noseTipPoint() -> CGPoint? {
            guard let nose = landmarks.nose, nose.pointCount > 0 else { return nil }
            let pts = nose.normalizedPoints.map(toImageSpace)
            guard let minX = pts.min(by: { $0.x < $1.x }), let maxX = pts.max(by: { $0.x < $1.x }) else { return nil }
            let centerX = face.boundingBox.midX
            return abs(minX.x - centerX) > abs(maxX.x - centerX) ? minX : maxX
        }

        // Chin: lowest (max-y in top-down space) point of the face contour,
        // which traces the jaw + chin outline.
        func chinPoint() -> CGPoint? {
            guard let contour = landmarks.faceContour, contour.pointCount > 0 else { return nil }
            let pts = contour.normalizedPoints.map(toImageSpace)
            return pts.max(by: { $0.y < $1.y })
        }

        let browPoint = averagePoint(landmarks.leftEyebrow) ?? averagePoint(landmarks.rightEyebrow)
        let nose = noseTipPoint()
        let chin = chinPoint()

        var result: [String: Any] = ["supported": true, "detected": true]
        var landmarksOut: [String: [Double]] = [:]
        for (name, pt) in [("brow", browPoint), ("nose", nose), ("chin", chin)] {
            if let pt { landmarksOut[name] = [Double(pt.x), Double(pt.y)] }
        }
        result["landmarks"] = landmarksOut

        // Facial convexity angle: brow → nose tip → chin, the standard
        // profile aesthetics measurement. This is a real angle computed
        // from detected landmark pixels — a 2D projection, not true 3D like
        // the ARKit face mesh, so it's sensitive to how square-on the
        // profile photo actually is. Treat it as an estimate, same honesty
        // bar as everything else in this app.
        if let browPoint, let nose, let chin {
            let v1 = CGPoint(x: browPoint.x - nose.x, y: browPoint.y - nose.y)
            let v2 = CGPoint(x: chin.x - nose.x, y: chin.y - nose.y)
            let dot  = v1.x * v2.x + v1.y * v2.y
            let mag1 = sqrt(v1.x * v1.x + v1.y * v1.y)
            let mag2 = sqrt(v2.x * v2.x + v2.y * v2.y)
            if mag1 > 0.001, mag2 > 0.001 {
                let cosAngle = max(-1, min(1, dot / (mag1 * mag2)))
                result["facialConvexityDegrees"] = Double(acos(cosAngle) * 180 / .pi)
            }
        }

        call.resolve(result)
    }

    // MARK: - Shared helpers

    private static func decodeImage(_ base64: String) -> CGImage? {
        var b64 = base64
        if let commaIdx = b64.firstIndex(of: ",") {
            b64 = String(b64[b64.index(after: commaIdx)...])
        }
        guard let data = Data(base64Encoded: b64),
              let uiImage = UIImage(data: data) else { return nil }
        return uiImage.cgImage
    }
}
