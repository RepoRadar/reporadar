import { Composition } from "remotion";
import { RepoRadarExplainer, EXPLAINER_DURATION, FPS } from "./RepoRadarExplainer";
import { HeroFilm, HERO_DURATION } from "./HeroFilm";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RepoRadarExplainer"
        component={RepoRadarExplainer}
        durationInFrames={EXPLAINER_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="HeroFilm"
        component={HeroFilm}
        durationInFrames={HERO_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
