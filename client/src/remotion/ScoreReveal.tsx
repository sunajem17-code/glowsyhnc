import {
  useCurrentFrame,
  interpolate,
  AbsoluteFill,
  Img,
  Sequence,
  spring,
  useVideoConfig,
  staticFile,
} from "remotion";
import { GOLD } from "../utils/theme";

type Pillar = { label: string; value: number };

type ScoreRevealProps = {
  score: number;
  potential: number;
  photoUrl: string;
  rating?: string;
  pillars?: Pillar[];
};

const DEFAULT_PILLARS: Pillar[] = [
  { label: "HARMONY", value: 78 },
  { label: "ANGULARITY", value: 65 },
  { label: "FEATURES", value: 82 },
  { label: "DIMORPHISM", value: 71 },
];

const BG = "#050505";

type Metric = { label: string; value: string; top: number; left: number; appear: number };

const METRICS: Metric[] = [
  { label: "H/W RATIO", value: "1.42", top: 12, left: 8, appear: 15 },
  { label: "EYE SPACING", value: "0.31", top: 30, left: 78, appear: 25 },
  { label: "JAW ANGLE", value: "126°", top: 58, left: 6, appear: 35 },
  { label: "LOWER THIRD", value: "33%", top: 72, left: 76, appear: 45 },
  { label: "CANTHAL TILT", value: "+4.2°", top: 40, left: 6, appear: 55 },
  { label: "GONIAL ANGLE", value: "118°", top: 85, left: 8, appear: 65 },
];

const Logo = ({ size = 56 }: { size?: number }) => (
  <Img
    src={staticFile("favicon-512.png")}
    style={{ width: size, height: size, borderRadius: size * 0.22 }}
  />
);

const FaceScan = ({ photoUrl }: { photoUrl: string }) => {
  const frame = useCurrentFrame();

  const gridOpacity = interpolate(frame, [0, 15], [0, 0.45], { extrapolateRight: "clamp" });
  const scanLineY = interpolate(frame, [10, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bracketOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const analyzingPulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const exitFade = interpolate(frame, [60, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoomScale = interpolate(frame, [0, 90], [1.35, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, opacity: exitFade }}>
      <div style={{ position: "absolute", top: 50, left: 40, display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={64} />
        <span style={{ color: "white", fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 900, fontSize: 42, letterSpacing: 1, textShadow: `0 0 20px ${GOLD}66` }}>
          Ascendus
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 50,
          right: 40,
          background: "rgba(212,168,83,0.12)",
          border: `1px solid ${GOLD}55`,
          borderRadius: 24,
          padding: "10px 20px",
          color: GOLD,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        Available on the App Store
      </div>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "relative", width: 750, height: 750, borderRadius: 16, overflow: "hidden" }}>
          <Img src={photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoomScale})` }} />

          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: gridOpacity,
              backgroundImage: `linear-gradient(${GOLD}55 1px, transparent 1px), linear-gradient(90deg, ${GOLD}55 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanLineY * 100}%`,
              height: 4,
              background: GOLD,
              boxShadow: `0 0 30px 6px ${GOLD}`,
            }}
          />

          {[
            { top: 12, left: 12, borderTop: 3, borderLeft: 3 },
            { top: 12, right: 12, borderTop: 3, borderRight: 3 },
            { bottom: 12, left: 12, borderBottom: 3, borderLeft: 3 },
            { bottom: 12, right: 12, borderBottom: 3, borderRight: 3 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 36,
                height: 36,
                borderColor: GOLD,
                borderStyle: "solid",
                opacity: bracketOpacity,
                ...pos,
              }}
            />
          ))}

          {METRICS.map((m) => {
            const op = interpolate(frame, [m.appear, m.appear + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={m.label}
                style={{
                  position: "absolute",
                  top: `${m.top}%`,
                  left: `${m.left}%`,
                  opacity: op,
                  color: GOLD,
                  fontFamily: "Menlo, Consolas, monospace",
                  fontSize: 15,
                  textShadow: `0 0 8px ${GOLD}`,
                  background: "rgba(0,0,0,0.45)",
                  padding: "3px 7px",
                  borderRadius: 4,
                  border: `1px solid ${GOLD}66`,
                }}
              >
                {m.label} {m.value}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 36,
            color: GOLD,
            fontFamily: "Helvetica, Arial, sans-serif",
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: 5,
            opacity: 0.4 + 0.6 * analyzingPulse,
          }}
        >
          SCANNING
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ScoreCard = ({
  score,
  potential,
  photoUrl,
  rating,
  pillars,
}: {
  score: number;
  potential: number;
  photoUrl: string;
  rating: string;
  pillars: Pillar[];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const cardY = interpolate(cardIn, [0, 1], [60, 0]);
  const cardOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });

  const displayedScore = interpolate(frame, [15, 55], [0, score], { extrapolateRight: "clamp" }).toFixed(1);
  const displayedPotential = interpolate(frame, [20, 60], [0, potential], { extrapolateRight: "clamp" }).toFixed(1);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: "absolute", top: 50, left: 40, display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={64} />
        <span style={{ color: "white", fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 900, fontSize: 42, letterSpacing: 1, textShadow: `0 0 20px ${GOLD}66` }}>
          Ascendus
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 50,
          right: 40,
          background: "rgba(212,168,83,0.12)",
          border: `1px solid ${GOLD}55`,
          borderRadius: 24,
          padding: "10px 20px",
          color: GOLD,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        Available on the App Store
      </div>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: 60 }}>
        <div
          style={{
            transform: `translateY(${cardY}px)`,
            opacity: cardOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 950,
          }}
        >
          <div style={{ color: GOLD, fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 800, fontSize: 56, marginBottom: 16, textShadow: `0 0 24px ${GOLD}` }}>{rating}</div>

          <Img
            src={photoUrl}
            style={{
              width: 480,
              height: 480,
              borderRadius: 20,
              objectFit: "cover",
              boxShadow: `0 0 40px ${GOLD}55`,
              marginBottom: 32,
              border: `2px solid ${GOLD}`,
            }}
          />

          <div style={{ display: "flex", gap: 20, width: "100%", marginBottom: 40 }}>
            <div style={{ flex: 1, border: `1px solid ${GOLD}55`, borderRadius: 14, padding: "20px 24px", background: "rgba(212,168,83,0.05)" }}>
              <div style={{ color: GOLD, fontFamily: "Helvetica, Arial, sans-serif", fontSize: 18, letterSpacing: 3 }}>
                OVERALL
              </div>
              <div style={{ color: "white", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 72, fontWeight: 800 }}>
                {displayedScore}<span style={{ fontSize: 28, color: "#999", marginLeft: 4 }}>/10</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "#181818", overflow: "hidden", marginTop: 10 }}>
                <div style={{ height: "100%", width: `${(score / 10) * 100}%`, background: GOLD, boxShadow: `0 0 10px ${GOLD}` }} />
              </div>
            </div>
            <div style={{ flex: 1, border: `1px solid ${GOLD}55`, borderRadius: 14, padding: "20px 24px", background: "rgba(212,168,83,0.05)" }}>
              <div style={{ color: GOLD, fontFamily: "Helvetica, Arial, sans-serif", fontSize: 18, letterSpacing: 3 }}>
                POTENTIAL
              </div>
              <div style={{ color: "white", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 72, fontWeight: 800 }}>
                {displayedPotential}<span style={{ fontSize: 28, color: "#999", marginLeft: 4 }}>/10</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "#181818", overflow: "hidden", marginTop: 10 }}>
                <div style={{ height: "100%", width: `${(potential / 10) * 100}%`, background: GOLD, boxShadow: `0 0 10px ${GOLD}` }} />
              </div>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            {pillars.map((p, i) => {
              const barStart = 65 + i * 10;
              const barFill = interpolate(frame, [barStart, barStart + 18], [0, p.value], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div key={p.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#D9D9D9", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 6 }}>
                    <span>{p.label}</span>
                    <span>{Math.round(barFill)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: "#181818", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barFill}%`, background: GOLD, boxShadow: `0 0 10px ${GOLD}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ScoreReveal = ({ score, potential, photoUrl, rating, pillars }: ScoreRevealProps) => {
  const activePillars = pillars ?? DEFAULT_PILLARS;
  const activeRating = rating ?? "Chadlite";

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence
        from={0}
        durationInFrames={95}
        style={{
          rotate: "-1deg"
        }}>
        <FaceScan photoUrl={photoUrl} />
      </Sequence>
      <Sequence from={70} durationInFrames={150}>
        <ScoreCard score={score} potential={potential} photoUrl={photoUrl} rating={activeRating} pillars={activePillars} />
      </Sequence>
    </AbsoluteFill>
  );
};
