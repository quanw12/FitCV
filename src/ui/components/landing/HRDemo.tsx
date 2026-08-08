import DemoReel, { type SceneViews } from "./demo/DemoReel"
import HrIntakeScene from "./demo/HrIntakeScene"
import HrOutreachScene from "./demo/HrOutreachScene"
import HrPipelineScene from "./demo/HrPipelineScene"
import HrRankScene from "./demo/HrRankScene"
import JobPostScene from "./demo/JobPostScene"
import { HR_DEMO_SCENES } from "./demo/hr-scenes"

import "./interactive-demo.css"
import "./hr-demo-scenes.css"

const SCENE_VIEWS: SceneViews = {
  "job-post": JobPostScene,
  intake: HrIntakeScene,
  rank: HrRankScene,
  pipeline: HrPipelineScene,
  outreach: HrOutreachScene,
}

/* Recruiter side of the reel: job post, batch intake, ranking, pipeline, outreach. */
export default function HRDemo() {
  return (
    <DemoReel
      scenes={HR_DEMO_SCENES}
      views={SCENE_VIEWS}
      label="Recruiter preview"
    />
  )
}
