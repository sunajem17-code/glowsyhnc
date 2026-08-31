//
//  FaceDiagnosticOverlay.swift
//  Ascendus
//
//  High-precision face-scanning diagnostic interface.
//
//  Anchors diagnostic tags directly to the 2D screen projections of real
//  ARKit face-mesh landmarks from `FaceScanCapture.landmarks2D`. Tags are
//  positioned with strict leader-line geometry (no random offsets) and
//  cycle through a chronological diagnostic sequence during the scan window.
//
//  Usage — drop inside any ZStack over the AR camera view:
//
//      FaceDiagnosticOverlay(
//          landmarks2D: capture.landmarks2D,   // normalized 0-1 CGPoints
//          metrics: capture.metrics,
//          isScanning: $isScanning
//      )
//

import SwiftUI

// MARK: - Diagnostic sequence

private struct DiagnosticStep {
    let analyzing: String    // "Analyzing…" line shown while this step runs
    let result:    String    // outcome line revealed when the step completes
    let severity:  Severity

    enum Severity { case neutral, caution, positive }
}

private let DIAGNOSTIC_STEPS: [DiagnosticStep] = [
    DiagnosticStep(
        analyzing: "Analyzing orbital vector support...",
        result:    "Suboptimal orbital depth",
        severity:  .caution
    ),
    DiagnosticStep(
        analyzing: "Evaluating brow ridge projection...",
        result:    "Recessed supraorbital ridge",
        severity:  .caution
    ),
    DiagnosticStep(
        analyzing: "Calculating mandibular symmetry...",
        result:    "High-tier jaw definition",
        severity:  .positive
    ),
    DiagnosticStep(
        analyzing: "Mapping canthal tilt vector...",
        result:    "Neutral canthal alignment",
        severity:  .neutral
    ),
    DiagnosticStep(
        analyzing: "Computing zygomatic projection...",
        result:    "Moderate cheekbone prominence",
        severity:  .neutral
    ),
    DiagnosticStep(
        analyzing: "Evaluating facial convexity angle...",
        result:    "Convexity within target range",
        severity:  .positive
    ),
    DiagnosticStep(
        analyzing: "Measuring nasal bridge alignment...",
        result:    "Rhinion axis deviation: minimal",
        severity:  .neutral
    ),
    DiagnosticStep(
        analyzing: "Assessing gonial angle geometry...",
        result:    "Acute gonial — sharp posterior border",
        severity:  .positive
    ),
]

// MARK: - Landmark anchor config

/// Describes where a diagnostic chip sits relative to a named landmark.
/// `offset` is in view-coordinate points, applied after the landmark is
/// projected to screen space. `alignment` drives the chip's internal text
/// alignment and which side the leader line exits from.
private struct LandmarkAnchor {
    let key:       String      // matches keys in FaceScanCapture.landmarks2D
    let label:     String      // anatomical name shown on the chip
    let offset:    CGPoint     // points, applied to the normalized landmark position
    let side:      ChipSide    // which side of the chip the leader line exits from

    enum ChipSide { case left, right, top, bottom }
}

/// Ordered list of anchors. Only anchors whose landmark key exists in the
/// current capture's `landmarks2D` dict are drawn — missing keys are silent.
private let LANDMARK_ANCHORS: [LandmarkAnchor] = [
    LandmarkAnchor(key: "jawCornerRight",   label: "Mandibular Angle",    offset: CGPoint(x:  80, y:  20), side: .left),
    LandmarkAnchor(key: "jawCornerLeft",    label: "Gonial Border",        offset: CGPoint(x: -80, y:  20), side: .right),
    LandmarkAnchor(key: "cheekboneRight",   label: "Zygomatic Arch",       offset: CGPoint(x:  88, y: -16), side: .left),
    LandmarkAnchor(key: "cheekboneLeft",    label: "Zygomatic Prominence", offset: CGPoint(x: -88, y: -16), side: .right),
    LandmarkAnchor(key: "templeRight",      label: "Bitemporal Width",     offset: CGPoint(x:  72, y: -32), side: .left),
    LandmarkAnchor(key: "templeLeft",       label: "Temporal Ridge",       offset: CGPoint(x: -72, y: -32), side: .right),
    LandmarkAnchor(key: "noseTip",          label: "Rhinion Axis",         offset: CGPoint(x:  76, y:   0), side: .left),
    LandmarkAnchor(key: "chinTip",          label: "Pogonion",             offset: CGPoint(x: -76, y:  28), side: .right),
    LandmarkAnchor(key: "browPoint",        label: "Supraorbital Ridge",   offset: CGPoint(x:  72, y: -40), side: .left),
]

// MARK: - Main overlay

struct FaceDiagnosticOverlay: View {
    /// Normalized (0-1) 2D positions of named landmarks within the camera frame.
    let landmarks2D: [String: CGPoint]
    let metrics: FaceMetrics

    /// Drives the scan animation. Set to `true` when the scan starts;
    /// the overlay auto-advances through steps over ~3 seconds then idles.
    @Binding var isScanning: Bool

    @State private var stepIndex:   Int    = 0
    @State private var showResult:  Bool   = false
    @State private var completedSteps: [Int] = []
    @State private var feedOpacity: Double = 0
    @State private var scanProgress: Double = 0
    @State private var chipScale: Double = 0.85

    private let stepDuration: Double = 1.1   // seconds per diagnostic step
    private let resultDelay:  Double = 0.55  // within each step, when result appears

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // ── Landmark anchor chips ──────────────────────────────────
                ForEach(LANDMARK_ANCHORS.indices, id: \.self) { i in
                    let anchor = LANDMARK_ANCHORS[i]
                    if let norm = landmarks2D[anchor.key] {
                        let screenPt = CGPoint(
                            x: norm.x * geo.size.width,
                            y: norm.y * geo.size.height
                        )
                        AnchoredChip(
                            anchor: anchor,
                            screenPoint: screenPt,
                            containerSize: geo.size,
                            isVisible: isScanning || !completedSteps.isEmpty
                        )
                        .transition(.opacity.combined(with: .scale(scale: 0.9)))
                    }
                }

                // ── Scan sweep line ────────────────────────────────────────
                if isScanning {
                    ScanSweepLine(progress: scanProgress, width: geo.size.width)
                        .frame(width: geo.size.width, height: geo.size.height)
                }

                // ── Diagnostic feed (bottom-anchored) ─────────────────────
                VStack {
                    Spacer()
                    DiagnosticFeed(
                        steps:          DIAGNOSTIC_STEPS,
                        currentIndex:   stepIndex,
                        showResult:     showResult,
                        completedSteps: completedSteps
                    )
                    .opacity(feedOpacity)
                    .padding(.bottom, 140)
                    .padding(.horizontal, 20)
                }

                // ── Corner scan-frame brackets ─────────────────────────────
                ScanFrameBrackets(size: geo.size)
                    .opacity(isScanning ? 1 : 0)
            }
            .onChange(of: isScanning) { scanning in
                if scanning { startSequence(in: geo.size) }
                else        { resetState() }
            }
            .onAppear {
                if isScanning { startSequence(in: geo.size) }
            }
        }
    }

    // MARK: - Sequence driver

    private func startSequence(in size: CGSize) {
        resetState()

        withAnimation(.easeOut(duration: 0.4)) {
            feedOpacity = 1
            chipScale   = 1.0
        }

        withAnimation(.linear(duration: Double(DIAGNOSTIC_STEPS.count) * stepDuration)) {
            scanProgress = 1.0
        }

        for i in 0..<DIAGNOSTIC_STEPS.count {
            let stepStart   = Double(i) * stepDuration
            let resultStart = stepStart + resultDelay

            DispatchQueue.main.asyncAfter(deadline: .now() + stepStart) {
                withAnimation(.easeInOut(duration: 0.25)) { stepIndex = i; showResult = false }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + resultStart) {
                withAnimation(.easeInOut(duration: 0.2)) { showResult = true }
                completedSteps.append(i)
            }
        }
    }

    private func resetState() {
        stepIndex      = 0
        showResult     = false
        completedSteps = []
        scanProgress   = 0
        withAnimation(.easeIn(duration: 0.3)) { feedOpacity = 0 }
    }
}

// MARK: - Anchored chip

private struct AnchoredChip: View {
    let anchor:        LandmarkAnchor
    let screenPoint:   CGPoint
    let containerSize: CGSize
    let isVisible:     Bool

    var body: some View {
        let chipOrigin = CGPoint(
            x: screenPoint.x + anchor.offset.x,
            y: screenPoint.y + anchor.offset.y
        )

        // Clamp so chip stays inside the safe zone (12pt margin)
        let margin: CGFloat = 12
        let chipW: CGFloat  = 148
        let chipH: CGFloat  = 30
        let clampedX = min(max(chipOrigin.x - chipW / 2, margin), containerSize.width  - chipW - margin)
        let clampedY = min(max(chipOrigin.y - chipH / 2, margin), containerSize.height - chipH - margin)
        let finalOrigin = CGPoint(x: clampedX, y: clampedY)
        let chipCenter  = CGPoint(x: clampedX + chipW / 2, y: clampedY + chipH / 2)

        return ZStack(alignment: .topLeading) {
            // Leader line from chip edge to landmark dot
            Canvas { ctx, _ in
                // Dot at the actual landmark
                let dotR: CGFloat = 3
                let dotRect = CGRect(
                    x: screenPoint.x - dotR,
                    y: screenPoint.y - dotR,
                    width:  dotR * 2,
                    height: dotR * 2
                )
                var dotPath = Path(); dotPath.addEllipse(in: dotRect)
                ctx.fill(dotPath, with: .color(.yellow.opacity(0.85)))

                // Line from landmark to chip edge
                let exitX: CGFloat
                switch anchor.side {
                case .left:   exitX = chipCenter.x - chipW / 2
                case .right:  exitX = chipCenter.x + chipW / 2
                case .top, .bottom: exitX = chipCenter.x
                }
                let exitY = chipCenter.y

                var linePath = Path()
                linePath.move(to: screenPoint)
                linePath.addLine(to: CGPoint(x: exitX, y: exitY))
                ctx.stroke(linePath, with: .color(.yellow.opacity(0.35)), lineWidth: 0.75)
            }
            .allowsHitTesting(false)

            // Chip itself
            Text(anchor.label.uppercased())
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundColor(.white)
                .tracking(0.6)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .frame(width: chipW, height: chipH)
                .background(
                    RoundedRectangle(cornerRadius: 5)
                        .fill(Color.black.opacity(0.82))
                        .overlay(
                            RoundedRectangle(cornerRadius: 5)
                                .stroke(Color.yellow.opacity(0.4), lineWidth: 0.75)
                        )
                )
                .position(x: clampedX + chipW / 2, y: clampedY + chipH / 2)
        }
        .opacity(isVisible ? 1 : 0)
        .animation(.easeOut(duration: 0.35), value: isVisible)
    }
}

// MARK: - Diagnostic feed

private struct DiagnosticFeed: View {
    let steps:          [DiagnosticStep]
    let currentIndex:   Int
    let showResult:     Bool
    let completedSteps: [Int]

    private let maxVisible = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Completed steps (up to maxVisible-1 most recent)
            let visibleCompleted = completedSteps
                .filter { $0 < currentIndex }
                .suffix(maxVisible - 1)

            ForEach(Array(visibleCompleted), id: \.self) { i in
                completedRow(step: steps[i])
                    .transition(.opacity)
            }

            // Active step
            if currentIndex < steps.count {
                activeRow(step: steps[currentIndex], resultVisible: showResult)
                    .id(currentIndex)
                    .transition(.asymmetric(
                        insertion:  .opacity.combined(with: .move(edge: .bottom)),
                        removal:    .opacity
                    ))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: currentIndex)
        .animation(.easeInOut(duration: 0.2), value: showResult)
    }

    private func completedRow(step: DiagnosticStep) -> some View {
        HStack(spacing: 6) {
            Text(">")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(.yellow.opacity(0.5))

            Text(step.result)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundColor(resultColor(step.severity).opacity(0.55))
                .lineLimit(1)
        }
    }

    private func activeRow(step: DiagnosticStep, resultVisible: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            // Analyzing line
            HStack(spacing: 5) {
                SpinnerDot()
                Text(step.analyzing)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.75))
                    .lineLimit(1)
            }

            // Result line
            if resultVisible {
                HStack(spacing: 6) {
                    Text("→")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(resultColor(step.severity))

                    Text(step.result)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(resultColor(step.severity))
                        .lineLimit(1)
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.black.opacity(0.72))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.yellow.opacity(0.35), lineWidth: 0.75)
                )
        )
    }

    private func resultColor(_ severity: DiagnosticStep.Severity) -> Color {
        switch severity {
        case .neutral:  return .white.opacity(0.7)
        case .caution:  return Color(red: 1.0, green: 0.75, blue: 0.2)   // amber
        case .positive: return Color(red: 0.3, green: 0.95, blue: 0.55)  // mint green
        }
    }
}

// MARK: - Animated spinner dot

private struct SpinnerDot: View {
    @State private var rotating = false

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.yellow.opacity(0.2), lineWidth: 1.5)
                .frame(width: 10, height: 10)
            Circle()
                .trim(from: 0, to: 0.65)
                .stroke(Color.yellow.opacity(0.85), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                .frame(width: 10, height: 10)
                .rotationEffect(.degrees(rotating ? 360 : 0))
                .animation(.linear(duration: 0.9).repeatForever(autoreverses: false), value: rotating)
        }
        .onAppear { rotating = true }
    }
}

// MARK: - Scan sweep line

private struct ScanSweepLine: View {
    let progress: Double
    let width: CGFloat

    var body: some View {
        GeometryReader { geo in
            let y = geo.size.height * progress
            ZStack(alignment: .top) {
                // Gradient beam
                LinearGradient(
                    colors: [.clear, .yellow.opacity(0.18), .yellow.opacity(0.35), .yellow.opacity(0.18), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 28)
                .frame(maxWidth: .infinity)
                .offset(y: y - 14)

                // Hard leading edge
                Rectangle()
                    .fill(Color.yellow.opacity(0.6))
                    .frame(height: 1)
                    .frame(maxWidth: .infinity)
                    .offset(y: y)
            }
        }
    }
}

// MARK: - Scan frame brackets

private struct ScanFrameBrackets: View {
    let size: CGSize

    private let inset:  CGFloat = 28
    private let length: CGFloat = 28
    private let thick:  CGFloat = 2

    var body: some View {
        Canvas { ctx, sz in
            let corners: [(CGPoint, [CGPoint], [CGPoint])] = [
                // top-left
                (CGPoint(x: inset, y: inset),
                 [CGPoint(x: inset, y: inset), CGPoint(x: inset + length, y: inset)],
                 [CGPoint(x: inset, y: inset), CGPoint(x: inset, y: inset + length)]),
                // top-right
                (CGPoint(x: sz.width - inset, y: inset),
                 [CGPoint(x: sz.width - inset, y: inset), CGPoint(x: sz.width - inset - length, y: inset)],
                 [CGPoint(x: sz.width - inset, y: inset), CGPoint(x: sz.width - inset, y: inset + length)]),
                // bottom-left
                (CGPoint(x: inset, y: sz.height - inset),
                 [CGPoint(x: inset, y: sz.height - inset), CGPoint(x: inset + length, y: sz.height - inset)],
                 [CGPoint(x: inset, y: sz.height - inset), CGPoint(x: inset, y: sz.height - inset - length)]),
                // bottom-right
                (CGPoint(x: sz.width - inset, y: sz.height - inset),
                 [CGPoint(x: sz.width - inset, y: sz.height - inset), CGPoint(x: sz.width - inset - length, y: sz.height - inset)],
                 [CGPoint(x: sz.width - inset, y: sz.height - inset), CGPoint(x: sz.width - inset, y: sz.height - inset - length)]),
            ]

            for (_, hPts, vPts) in corners {
                var h = Path(); h.move(to: hPts[0]); h.addLine(to: hPts[1])
                var v = Path(); v.move(to: vPts[0]); v.addLine(to: vPts[1])
                ctx.stroke(h, with: .color(.yellow.opacity(0.65)), lineWidth: thick)
                ctx.stroke(v, with: .color(.yellow.opacity(0.65)), lineWidth: thick)
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }
}
