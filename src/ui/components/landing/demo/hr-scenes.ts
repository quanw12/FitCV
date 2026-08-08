import type { DemoScene } from "./scenes"

/* Script for the recruiter-side reel. Same contract as demo/scenes.ts: one
   entry per scene in play order, `duration` covering the whole choreography in
   hr-demo-scenes.css plus a beat of hold before the rail advances. */

export const HR_DEMO_SCENES: DemoScene[] = [
  {
    key: "job-post",
    label: "Create a job post",
    copy: "Paste a raw job description and the AI extracts structured fields. Review, tweak, and publish — then copy the public link for candidates.",
    path: "job-posts",
    status: "Sr Frontend · Published · link copied",
    duration: 7500,
  },
  {
    key: "intake",
    label: "Screen a batch",
    copy: "Drop a folder of CVs and the same parser runs across all of them, so twenty-four applicants get read against the criteria you would have used for one.",
    path: "cv-ranking",
    status: "24 CVs parsed · 7 above the bar",
    duration: 7000,
  },
  {
    key: "rank",
    label: "Rank the pool",
    copy: "The pool sorts itself by match score. Move the threshold and the shortlist redraws, so a cut-off is a decision you can change rather than a morning of re-reading.",
    path: "cv-ranking",
    status: "threshold 80 · 2 shortlisted",
    duration: 7800,
  },
  {
    key: "pipeline",
    label: "Move the pipeline",
    copy: "Candidates move through stages as a group, and every move is written to their stage history, so the board still explains itself a month later.",
    path: "pipeline",
    status: "3 moved · applied 24 → 21",
    duration: 7200,
  },
  {
    key: "outreach",
    label: "Send the follow-up",
    copy: "AI drafts a personalised email per candidate. HR reviews and edits, then approves the batch — nothing sends without a human pair of eyes.",
    path: "auto-email",
    status: "interview invite · 3 approved · sending",
    duration: 7000,
  },
]
