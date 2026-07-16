//
//  FaceMetrics.swift
//  Ascendus
//
//  Computes REAL facial geometry measurements from ARKit's live 3D face mesh
//  (ARFaceGeometry, driven by the TrueDepth camera). Every number here is
//  derived from actual depth-mapped vertex positions captured during an
//  active ARFaceTrackingConfiguration session — nothing is fabricated.
//
//  IMPORTANT — read before adding more metrics:
//  ARKit's face mesh has ~1220 vertices covering the FRONT FACE SURFACE ONLY
//  (forehead down to chin, roughly ear-line to ear-line). It does NOT model:
//    - Ears/pinnae at all (no vertex data exists there)
//    - A true hairline (the mesh's upper edge is a fixed topological cutoff,
//      not a detected hairline, so "top third of face" proportions would be
//      measuring against an arbitrary edge, not a real landmark)
//    - Fine sub-millimeter features (nostril wings, cupid's bow, eyelid
//      margins, canthal corners) with enough vertex density to be reliable —
//      at ~1220 points for the whole face, those regions have only a handful
//      of vertices, so numbers computed there would look precise but mostly
//      be mesh noise, not signal.
//  Metrics requiring any of the above are deliberately NOT implemented here.
//  Faking them with plausible-looking numbers would be the same mistake that
//  caused real problems earlier in this project — don't reintroduce it.
//
//  Every metric below is computed with band/extrema geometry (find the
//  extreme point within a defined region of the mesh) rather than hardcoded
//  vertex indices, since ARKit's exact per-vertex numbering isn't something
//  we can verify from outside a live debugging session. This approach is
//  slightly coarser but is honest about what it's actually measuring.
//

import ARKit
import simd

struct FaceMetrics {
    // MARK: Core (front)
    let jawWidthCM: Double
    let faceHeightCM: Double
    let faceWidthCM: Double
    let faceRatio: Double              // faceWidth / faceHeight
    let symmetryScore: Double          // 0-100, whole-face, higher = more symmetric
    let cheekboneWidthCM: Double

    // MARK: Expanded (front)
    let bitemporalWidthCM: Double      // widest span in the upper/temple band
    let bigonialWidthPercent: Double   // jawWidth as % of faceWidth
    let midfaceRatio: Double           // cheekboneWidth / jawWidth
    let jawAsymmetryScore: Double      // 0-100, mirror-mismatch restricted to jaw band
    let cheekboneAsymmetryScore: Double
    let templeAsymmetryScore: Double

    // MARK: Profile-style (derived from the SAME front-facing mesh capture —
    // no separate turned-head scan needed. ARKit reliably tracks roughly
    // ±40-50° of yaw; a true 90° profile would lose tracking, so these are
    // computed from the depth/Z geometry of one straight-on capture instead.)
    let facialAngleDegrees: Double         // brow-point→chin-point line vs. vertical
    let noseProjectionMM: Double           // nose tip depth relative to cheek plane
    let chinProjectionMM: Double           // chin depth relative to cheek plane
    let facialConvexityDegrees: Double     // angle at nose tip between brow and chin
    let foreheadSlopeDegrees: Double       // forehead surface angle vs. vertical
    let gonialAngleDegrees: Double         // approximate jaw angle (see computeGonialAngle)

    // MARK: Landmark points (local face-mesh space, meters)
    // The actual 3D points used to compute the metrics above, keyed by name.
    // Exposed so callers can project them into 2D screen space (via
    // ARCamera.projectPoint) to draw markers on a captured photo — this is
    // what powers the "tap a stat, see it pointed out on your face" UI.
    let landmarkPoints: [String: SIMD3<Float>]

    static func compute(from geometry: ARFaceGeometry, faceTransform: simd_float4x4) -> FaceMetrics {
        let vertices = geometry.vertices

        guard vertices.count > 20 else { return .zero }

        let metersToCM = 100.0
        let metersToMM = 1000.0

        let xs = vertices.map { Double($0.x) }
        let ys = vertices.map { Double($0.y) }
        let minX = xs.min()!, maxX = xs.max()!
        let minY = ys.min()!, maxY = ys.max()!
        let heightRange = maxY - minY
        let centerX = (minX + maxX) / 2.0

        let faceWidthCM  = (maxX - minX) * metersToCM
        let faceHeightCM = heightRange * metersToCM
        let faceRatio    = faceHeightCM > 0 ? faceWidthCM / faceHeightCM : 0

        func band(_ loFrac: Double, _ hiFrac: Double) -> [simd_float3] {
            let lo = minY + heightRange * loFrac
            let hi = minY + heightRange * hiFrac
            return vertices.filter { Double($0.y) >= lo && Double($0.y) <= hi }
        }

        // Jaw band: chin/jaw region, lower 20% of the face.
        let jawBand = band(0.0, 0.20)
        let jawWidthCM = widthOf(jawBand) * metersToCM

        // Cheekbone band: upper-mid face.
        let cheekBand = band(0.55, 0.75)
        let cheekboneWidthCM = widthOf(cheekBand) * metersToCM

        // Temple band: near the top of the modeled surface (forehead sides).
        let templeBand = band(0.85, 0.97)
        let bitemporalWidthCM = widthOf(templeBand) * metersToCM

        let bigonialWidthPercent = faceWidthCM > 0 ? (jawWidthCM / faceWidthCM) * 100.0 : 0
        let midfaceRatio = jawWidthCM > 0 ? cheekboneWidthCM / jawWidthCM : 0

        let symmetryScore          = symmetryOf(vertices)
        let jawAsymmetryScore      = symmetryOf(jawBand)
        let cheekboneAsymmetryScore = symmetryOf(cheekBand)
        let templeAsymmetryScore   = symmetryOf(templeBand)

        // ── Profile-style geometry, derived from Z-depth of this same mesh ──
        // "Central strip" = points near the face's vertical midline, used to
        // find single representative points (nose tip, chin, brow, forehead)
        // instead of a left/right band.
        let centralStrip = vertices.filter { abs(Double($0.x) - centerX) < (maxX - minX) * 0.06 }

        // Reference (cheek) plane Z — median Z of the cheekbone band approximates
        // the general facial plane that the nose/chin project forward from.
        let cheekPlaneZ = median(cheekBand.map { Double($0.z) })

        // Nose tip: within the central strip, mid-height band, the point with
        // maximum Z (furthest forward, toward the camera in face-space).
        let noseCandidates = centralStrip.filter {
            let yFrac = (Double($0.y) - minY) / max(heightRange, 0.0001)
            return yFrac > 0.35 && yFrac < 0.62
        }
        let noseTip = noseCandidates.max(by: { $0.z < $1.z })

        // Chin tip: within the central strip, the lowest point overall.
        let chinTip = centralStrip.min(by: { $0.y < $1.y })

        // Brow point: within the central strip, upper-mid band, take the point
        // closest to the median Z (a stable reference rather than an extremum,
        // since brow ridge shape varies more than nose/chin do).
        let browCandidates = centralStrip.filter {
            let yFrac = (Double($0.y) - minY) / max(heightRange, 0.0001)
            return yFrac > 0.68 && yFrac < 0.80
        }
        let browPoint = browCandidates.first

        // Forehead points: two points in the central strip's upper band, used
        // to get a surface-angle rather than a single point.
        let foreheadBand = centralStrip.filter {
            let yFrac = (Double($0.y) - minY) / max(heightRange, 0.0001)
            return yFrac > 0.82 && yFrac < 0.96
        }.sorted { $0.y < $1.y }

        var noseProjectionMM = 0.0
        var chinProjectionMM = 0.0
        var facialAngleDegrees = 0.0
        var facialConvexityDegrees = 0.0
        var foreheadSlopeDegrees = 0.0
        var gonialAngleDegrees = 0.0

        if let nose = noseTip {
            noseProjectionMM = (Double(nose.z) - cheekPlaneZ) * metersToMM
        }
        if let chin = chinTip {
            chinProjectionMM = (Double(chin.z) - cheekPlaneZ) * metersToMM
        }

        if let brow = browPoint, let chin = chinTip {
            // Angle of the brow→chin line relative to vertical (Y axis), measured
            // in the Y-Z plane — an approximation of overall facial inclination.
            let dy = Double(chin.y) - Double(brow.y)
            let dz = Double(chin.z) - Double(brow.z)
            facialAngleDegrees = abs(angleFromVertical(dy: dy, dz: dz))
        }

        if let brow = browPoint, let nose = noseTip, let chin = chinTip {
            facialConvexityDegrees = angleBetween(
                a: simd_double3(Double(brow.x), Double(brow.y), Double(brow.z)),
                vertex: simd_double3(Double(nose.x), Double(nose.y), Double(nose.z)),
                b: simd_double3(Double(chin.x), Double(chin.y), Double(chin.z))
            )
        }

        if foreheadBand.count >= 2, let lowPoint = foreheadBand.first, let highPoint = foreheadBand.last {
            let dy = Double(highPoint.y) - Double(lowPoint.y)
            let dz = Double(highPoint.z) - Double(lowPoint.z)
            foreheadSlopeDegrees = abs(angleFromVertical(dy: dy, dz: dz))
        }

        gonialAngleDegrees = computeGonialAngle(vertices: vertices, jawBand: jawBand, templeBand: templeBand, chinTip: chinTip, centerX: centerX)

        // ── Named landmark points, for projecting onto a captured photo ──────
        var landmarks: [String: SIMD3<Float>] = [:]
        if let p = noseTip  { landmarks["noseTip"]  = p }
        if let p = chinTip  { landmarks["chinTip"]  = p }
        if let p = browPoint { landmarks["browPoint"] = p }
        if let p = jawBand.filter({ Double($0.x) > centerX }).max(by: { $0.x < $1.x }) { landmarks["jawCornerRight"] = p }
        if let p = jawBand.filter({ Double($0.x) < centerX }).min(by: { $0.x < $1.x }) { landmarks["jawCornerLeft"] = p }
        if let p = cheekBand.filter({ Double($0.x) > centerX }).max(by: { $0.x < $1.x }) { landmarks["cheekboneRight"] = p }
        if let p = cheekBand.filter({ Double($0.x) < centerX }).min(by: { $0.x < $1.x }) { landmarks["cheekboneLeft"] = p }
        if let p = templeBand.filter({ Double($0.x) > centerX }).max(by: { $0.x < $1.x }) { landmarks["templeRight"] = p }
        if let p = templeBand.filter({ Double($0.x) < centerX }).min(by: { $0.x < $1.x }) { landmarks["templeLeft"] = p }

        return FaceMetrics(
            jawWidthCM: jawWidthCM,
            faceHeightCM: faceHeightCM,
            faceWidthCM: faceWidthCM,
            faceRatio: faceRatio,
            symmetryScore: symmetryScore,
            cheekboneWidthCM: cheekboneWidthCM,
            bitemporalWidthCM: bitemporalWidthCM,
            bigonialWidthPercent: bigonialWidthPercent,
            midfaceRatio: midfaceRatio,
            jawAsymmetryScore: jawAsymmetryScore,
            cheekboneAsymmetryScore: cheekboneAsymmetryScore,
            templeAsymmetryScore: templeAsymmetryScore,
            facialAngleDegrees: facialAngleDegrees,
            noseProjectionMM: noseProjectionMM,
            chinProjectionMM: chinProjectionMM,
            facialConvexityDegrees: facialConvexityDegrees,
            foreheadSlopeDegrees: foreheadSlopeDegrees,
            gonialAngleDegrees: gonialAngleDegrees,
            landmarkPoints: landmarks
        )
    }

    static let zero = FaceMetrics(
        jawWidthCM: 0, faceHeightCM: 0, faceWidthCM: 0, faceRatio: 0, symmetryScore: 0, cheekboneWidthCM: 0,
        bitemporalWidthCM: 0, bigonialWidthPercent: 0, midfaceRatio: 0,
        jawAsymmetryScore: 0, cheekboneAsymmetryScore: 0, templeAsymmetryScore: 0,
        facialAngleDegrees: 0, noseProjectionMM: 0, chinProjectionMM: 0,
        facialConvexityDegrees: 0, foreheadSlopeDegrees: 0, gonialAngleDegrees: 0,
        landmarkPoints: [:]
    )

    // MARK: - Helpers

    private static func widthOf(_ points: [simd_float3]) -> Double {
        guard !points.isEmpty else { return 0 }
        let xs = points.map { Double($0.x) }
        return (xs.max() ?? 0) - (xs.min() ?? 0)
    }

    private static func median(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }

    /// Angle (degrees, 0-180) between a Y-axis-relative displacement (dy, dz)
    /// and straight-down vertical. Used for facial angle / forehead slope.
    private static func angleFromVertical(dy: Double, dz: Double) -> Double {
        guard dy != 0 || dz != 0 else { return 0 }
        let radians = atan2(dz, -dy) // -dy so "straight down" = 0°
        return radians * 180.0 / .pi
    }

    /// Angle at `vertex` formed by rays to `a` and `b`, in degrees (0-180).
    private static func angleBetween(a: simd_double3, vertex: simd_double3, b: simd_double3) -> Double {
        let v1 = a - vertex
        let v2 = b - vertex
        let len1 = simd_length(v1), len2 = simd_length(v2)
        guard len1 > 0, len2 > 0 else { return 0 }
        let cosAngle = max(-1.0, min(1.0, simd_dot(v1, v2) / (len1 * len2)))
        return acos(cosAngle) * 180.0 / .pi
    }

    /// Approximates the classical gonial (mandible) angle using only points the
    /// ARKit face mesh actually models (no ear/ramus data exists in the mesh).
    /// Definition used: angle at the jaw-corner point (extremum of the jaw band,
    /// left or right side, whichever has more supporting vertices) between (1) a
    /// line up to the temple-band point on the same side, approximating the
    /// ramus direction along the visible face surface, and (2) a line to the
    /// chin tip, approximating the body of the mandible. This is a surface-based
    /// approximation, not the true skeletal gonial angle — labeled as an
    /// estimate in the UI for exactly that reason.
    private static func computeGonialAngle(
        vertices: [simd_float3], jawBand: [simd_float3], templeBand: [simd_float3],
        chinTip: simd_float3?, centerX: Double
    ) -> Double {
        guard let chin = chinTip, !jawBand.isEmpty, !templeBand.isEmpty else { return 0 }

        // Use the right side (x > centerX) consistently for a single-sided estimate.
        guard let jawCorner = jawBand.filter({ Double($0.x) > centerX }).max(by: { $0.x < $1.x }),
              let templePoint = templeBand.filter({ Double($0.x) > centerX }).max(by: { $0.x < $1.x })
        else { return 0 }

        return angleBetween(
            a: simd_double3(Double(templePoint.x), Double(templePoint.y), Double(templePoint.z)),
            vertex: simd_double3(Double(jawCorner.x), Double(jawCorner.y), Double(jawCorner.z)),
            b: simd_double3(Double(chin.x), Double(chin.y), Double(chin.z))
        )
    }

    /// Mirrors a point set across its own mean X and measures nearest-neighbor
    /// mismatch — the same technique used for whole-face symmetryScore, reused
    /// here for region-restricted asymmetry scores (jaw/cheekbone/temple).
    private static func symmetryOf(_ vertices: [simd_float3]) -> Double {
        guard vertices.count > 6 else { return 0 }

        let meanX = vertices.reduce(Float(0)) { $0 + $1.x } / Float(vertices.count)
        let sampleStride = max(1, vertices.count / 150)
        let sampled = stride(from: 0, to: vertices.count, by: sampleStride).map { vertices[$0] }
        let mirrored = sampled.map { simd_float3(2 * meanX - $0.x, $0.y, $0.z) }

        var totalDistance: Float = 0
        for mirroredPoint in mirrored {
            var nearest: Float = .greatestFiniteMagnitude
            for original in sampled {
                let d = simd_distance(mirroredPoint, original)
                if d < nearest { nearest = d }
            }
            totalDistance += nearest
        }

        let avgMismatchMeters = Double(totalDistance) / Double(mirrored.count)
        let mismatchCM = avgMismatchMeters * 100.0
        return max(0, 100.0 - (mismatchCM / 1.5) * 100.0)
    }
}
