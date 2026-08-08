import DemoReel, { type SceneViews } from "./demo/DemoReel"
import ImproveScene from "./demo/ImproveScene"
import JdLibraryScene from "./demo/JdLibraryScene"
import RebuildScene from "./demo/RebuildScene"
import ScoreScene from "./demo/ScoreScene"
import TrackScene from "./demo/TrackScene"
import { DEMO_SCENES } from "./demo/scenes"

import "./interactive-demo.css"

const SCENE_VIEWS: SceneViews = {
  rebuild: RebuildScene,
  score: ScoreScene,
  "jd-library": JdLibraryScene,
  improve: ImproveScene,
  track: TrackScene,
}

/* Job-seeker side of the reel: upload, score, jd library, improve, track. */
export default function InteractiveDemo() {
  return (
    <DemoReel
      scenes={DEMO_SCENES}
      views={SCENE_VIEWS}
      label="Product preview"
    />
  )
}
