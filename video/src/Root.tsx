import { Composition } from "remotion";
import { RepoRadarExplainer, EXPLAINER_DURATION, FPS } from "./RepoRadarExplainer";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="RepoRadarExplainer"
      component={RepoRadarExplainer}
      durationInFrames={EXPLAINER_DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
