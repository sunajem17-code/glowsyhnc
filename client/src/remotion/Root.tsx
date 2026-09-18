import { Composition } from "remotion";
import { ScoreReveal } from "./ScoreReveal";

export const RemotionRoot = () => {
  return (
    <Composition
      id="ScoreReveal"
      component={ScoreReveal}
      durationInFrames={210}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        score: 82,
        potential: 7.9,
        photoUrl: "https://i.pravatar.cc/400",
      }}
    />
  );
};
