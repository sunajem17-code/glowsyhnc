//
//  FaceScanView.swift
//  Ascendus
//
//  Top-level SwiftUI screen: live AR camera + capture button, then a results
//  card showing REAL numbers from FaceMetrics.
//
//  onComplete / onCancel — set by FaceScanPlugin when presenting modally.
//  When nil (standalone), the results card offers "Scan Again" instead of "Done".
//

import SwiftUI

struct FaceScanView: View {
    // Plugin callbacks — nil when used standalone
    var onComplete: ((FaceScanCapture) -> Void)? = nil
    var onCancel:   (() -> Void)?                = nil

    @StateObject private var scanController = FaceScanController()
    @State private var capturedResult: FaceScanCapture?
    @State private var trackingUnavailable = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if trackingUnavailable {
                unavailableState
            } else if let result = capturedResult {
                ScrollView {
                    FaceScanResultsCard(
                        metrics: result.metrics,
                        buttonLabel: onComplete != nil ? "Done" : "Scan Again"
                    ) {
                        if let onComplete {
                            onComplete(result)
                        } else {
                            capturedResult = nil
                        }
                    }
                }
            } else {
                scanningState
            }

            // Close / cancel button — only shown in plugin mode
            if onCancel != nil && capturedResult == nil && !trackingUnavailable {
                VStack {
                    HStack {
                        Button(action: { onCancel?() }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(10)
                                .background(Color.white.opacity(0.15))
                                .clipShape(Circle())
                        }
                        .padding(.leading, 20)
                        .padding(.top, 56)
                        Spacer()
                    }
                    Spacer()
                }
                .ignoresSafeArea()
            }
        }
    }

    private var scanningState: some View {
        ZStack(alignment: .bottom) {
            FaceScanARViewRepresentable(
                controllerHolder: scanController,
                onCapture: { result in capturedResult = result },
                onUnavailable: { trackingUnavailable = true }
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                Text("Center your face in frame")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.cyan)

                Button(action: { scanController.capture() }) {
                    Text("SCAN")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.black)
                        .frame(width: 140, height: 48)
                        .background(Color.cyan)
                        .clipShape(Capsule())
                }
            }
            .padding(.bottom, 48)
        }
    }

    private var unavailableState: some View {
        VStack(spacing: 16) {
            Image(systemName: "faceid")
                .font(.system(size: 48))
                .foregroundColor(.gray)
            Text("Face scan needs a TrueDepth camera")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.white)
            Text("This feature requires iPhone X or later.")
                .font(.system(size: 14))
                .foregroundColor(.gray)
            if onCancel != nil {
                Button("Close", action: { onCancel?() })
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.cyan)
                    .padding(.top, 8)
            }
        }
        .padding()
    }
}

// MARK: - Results card

struct FaceScanResultsCard: View {
    let metrics:     FaceMetrics
    let buttonLabel: String
    let onAction:    () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("FACE SCAN")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.cyan)
                .tracking(1.5)

            VStack(alignment: .leading, spacing: 14) {
                metricRow(label: "Jaw Width",       value: String(format: "%.1f cm", metrics.jawWidthCM))
                metricRow(label: "Cheekbone Width", value: String(format: "%.1f cm", metrics.cheekboneWidthCM))
                metricRow(label: "Bitemporal Width", value: String(format: "%.1f cm", metrics.bitemporalWidthCM))
                metricRow(label: "Face Width",      value: String(format: "%.1f cm", metrics.faceWidthCM))
                metricRow(label: "Face Height",     value: String(format: "%.1f cm", metrics.faceHeightCM))
                metricRow(label: "Face Ratio",      value: String(format: "%.2f",    metrics.faceRatio))
                metricRow(label: "Bigonial Width",  value: String(format: "%.1f%%",  metrics.bigonialWidthPercent))
                metricRow(label: "Midface Ratio",   value: String(format: "%.2fx",   metrics.midfaceRatio))
            }
            .padding(20)
            .background(Color.white.opacity(0.05))
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.cyan.opacity(0.3), lineWidth: 1))

            VStack(alignment: .leading, spacing: 4) {
                Text("PROFILE GEOMETRY")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.cyan)
                    .tracking(1.5)
                Text("Derived from this same scan — no separate profile capture needed.")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
            .padding(.top, 4)

            VStack(alignment: .leading, spacing: 14) {
                metricRow(label: "Facial Angle",     value: String(format: "%.1f°", metrics.facialAngleDegrees))
                metricRow(label: "Facial Convexity", value: String(format: "%.1f°", metrics.facialConvexityDegrees))
                metricRow(label: "Gonial Angle",     value: String(format: "%.1f°", metrics.gonialAngleDegrees))
                metricRow(label: "Forehead Slope",   value: String(format: "%.1f°", metrics.foreheadSlopeDegrees))
                metricRow(label: "Nose Projection",  value: String(format: "%.1f mm", metrics.noseProjectionMM))
                metricRow(label: "Chin Projection",  value: String(format: "%.1f mm", metrics.chinProjectionMM))
            }
            .padding(20)
            .background(Color.white.opacity(0.05))
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.cyan.opacity(0.3), lineWidth: 1))

            VStack(alignment: .leading, spacing: 14) {
                Text("ASYMMETRY BY REGION")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.cyan)
                    .tracking(1.5)
                metricRow(label: "Jaw",       value: String(format: "%.1f%%", metrics.jawAsymmetryScore))
                metricRow(label: "Cheekbone", value: String(format: "%.1f%%", metrics.cheekboneAsymmetryScore))
                metricRow(label: "Temple",    value: String(format: "%.1f%%", metrics.templeAsymmetryScore))
            }
            .padding(20)
            .background(Color.white.opacity(0.05))
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.cyan.opacity(0.3), lineWidth: 1))

            VStack(spacing: 8) {
                ZStack {
                    Circle().stroke(Color.white.opacity(0.1), lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: CGFloat(metrics.symmetryScore / 100))
                        .stroke(Color.cyan, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text(String(format: "%.1f%%", metrics.symmetryScore))
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                }
                .frame(width: 120, height: 120)

                Text("SYMMETRY SCORE")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.gray)
                    .tracking(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 8)

            Text("Estimates derived from live 3D depth capture. Not a medical measurement.")
                .font(.system(size: 11))
                .foregroundColor(.gray)
                .padding(.top, 4)

            Button(action: onAction) {
                Text(buttonLabel)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.cyan)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cyan, lineWidth: 1))
            }
        }
        .padding(24)
    }

    private func metricRow(label: String, value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 14)).foregroundColor(.gray)
            Spacer()
            Text(value).font(.system(size: 14, weight: .semibold)).foregroundColor(.white)
        }
    }
}
