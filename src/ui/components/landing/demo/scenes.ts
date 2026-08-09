/* Script for the auto-playing product demo: one entry per scene, in play order.
   `duration` must cover the whole choreography in the matching CSS block plus a
   beat of hold time before the rail advances. */

export interface SceneProps {
  /** True while the demo is paused, so scene-driven counters hold their value. */
  paused: boolean
}

export interface DemoScene {
  key: string
  label: string
  copy: string

  /** Breadcrumb shown in the mock window chrome. */
  path: string

  /** Mono status line under the window, describing what the scene just did. */
  status: string

  /** Full play time in milliseconds, including the closing hold. */
  duration: number
}

export const DEMO_SCENES: DemoScene[] = [
  {
    key: "rebuild",
    label: "Rebuild a CV",
    copy: "Drop in a PDF or DOCX. The parser extracts sections and versions every rebuild, so drafts stack up instead of overwriting each other.",
    path: "cv-rebuild",
    status: "parsed 4 sections · saved as v3",
    duration: 7200,
  },
  {
    key: "score",
    label: "Score against a JD",
    copy: "Paste a job description and the analyzer returns a score per category, plus the exact keywords it matched and the ones it could not find.",
    path: "analyzer / senior-frontend",
    status: "4 categories scored · 71 overall",
    duration: 7600,
  },
  {
    key: "improve",
    label: "Apply improvements",
    copy: "Every weakness the analyzer reports comes back as a suggestion you can accept, so the next rebuild closes the gap instead of restating it.",
    path: "improvement",
    status: "4 report sections · handed to CV Rebuild",
    duration: 9600,
  },
  {
    key: "jd-library",
    label: "Analyze or apply from JD Library",
    copy: "Saved job descriptions live here with parsed requirements and score history. Analyze your CV against one or apply directly.",
    path: "jd-library",
    status: "3 saved JDs · analyze or apply",
    duration: 7500,
  },
  {
    key: "track",
    label: "Track applications",
    copy: "Applications carry their job description, the CV version you sent and their current stage, so nothing has to live in a spreadsheet on the side.",
    path: "app-tracker",
    status: "senior frontend · v3 · interview",
    duration: 7400,
  },
  {
    key: "job-search",
    label: "Find matching jobs",
    copy: "Select a parsed CV and FitCV scans freehire.me and LinkedIn for jobs that match your skills, experience and location — no manual searching needed.",
    path: "job-search",
    status: "3 jobs found · AI-derived keywords",
    duration: 7600,
  },
]
