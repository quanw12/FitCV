import Tick from "./Tick"
import { cssVars } from "./vars"

const JD_LINES = [0, 1, 2, 3]
const EXTRACTED_FIELDS = [
  "About the job",
  "Responsibilities",
  "Requirements",
  "We offer",
]
/* The four weights the job editor actually exposes, at their default split.
   The editor refuses to publish unless they add up to 100. */

const SCORING_WEIGHTS = [
  { label: "Skills", pct: 45 },
  { label: "Experience", pct: 30 },
  { label: "Education", pct: 15 },
  { label: "Soft skills", pct: 10 },
]
const WEIGHT_TOTAL = SCORING_WEIGHTS.reduce((sum, w) => sum + w.pct, 0)

/* Beat 1 the editor rises · beat 2 JD text types in · beat 3 Extract with AI
   is pressed · beat 4 form fields auto-fill with ticks · beat 5 scoring
   weights appear · beat 6 location/type fields fill · beat 7 the status
   badge flips from Draft to Published. */

export default function JobPostScene() {
  return (
    <div className="lpd-scene lpd-hr-job-post">
      <div className="lpd-hr-editor">
        <span className="lpd-hr-editor-head" aria-hidden="true">
          Job Editor
        </span>

        <div className="lpd-hr-field-row">
          <span className="lpd-hr-field-label">Title</span>
          <span className="lpd-hr-field-value lpd-hr-field-type">
            Senior Frontend Engineer
          </span>
        </div>

        <div className="lpd-hr-field-row">
          <span className="lpd-hr-field-label">Location</span>
          <span className="lpd-hr-field-value">Ho Chi Minh City · On-site</span>
        </div>

        <div className="lpd-hr-field-row">
          <span className="lpd-hr-field-label">Type</span>
          <span className="lpd-hr-field-value">Full-time · 3 openings</span>
        </div>

        <div className="lpd-hr-jd-box">
          <span className="lpd-hr-jd-label">Full job description</span>

          {JD_LINES.map((line) => (
            <span
              key={line}
              className="lpd-hr-jd-line"
              style={cssVars({ "--i": line })}
              aria-hidden="true"
            />
          ))}

          <span className="lpd-hr-jd-sweep" aria-hidden="true" />
        </div>

        <span
          className="lpd-hr-btn is-primary lpd-hr-extract"
          aria-hidden="true"
        >
          Extract with AI
        </span>
      </div>

      <div className="lpd-hr-extracted">
        {EXTRACTED_FIELDS.map((field, index) => (
          <span
            key={field}
            className="lpd-hr-extracted-row"
            style={cssVars({ "--i": index })}
          >
            <Tick />
            <span className="lpd-hr-extracted-name">{field}</span>
          </span>
        ))}
      </div>

      <div className="lpd-hr-weights">
        <span className="lpd-hr-weights-head">
          Scoring weights
          <span className="lpd-hr-weights-total" aria-hidden="true">
            <Tick />
            {WEIGHT_TOTAL}% allocated
          </span>
        </span>
        {SCORING_WEIGHTS.map((w, i) => (
          <div key={w.label} className="lpd-hr-weight-row" style={cssVars({ "--i": i })}>
            <span className="lpd-hr-weight-label">{w.label}</span>
            <span className="lpd-hr-weight-bar">
              <i className="lpd-hr-weight-fill" style={cssVars({ "--w": `${w.pct}%`, "--i": i })} />
            </span>
            <span className="lpd-hr-weight-pct">{w.pct}%</span>
          </div>
        ))}
      </div>

      <div className="lpd-hr-pub-row">
        <span className="lpd-hr-status-badge">
          <span className="lpd-hr-status-flip">
            <span className="lpd-hr-status-a">Draft</span>
            <span className="lpd-hr-status-b">Published</span>
          </span>
        </span>

        <span
          className="lpd-hr-btn is-primary lpd-hr-copy-link"
          aria-hidden="true"
        >
          Copy public link
        </span>

        <span className="lpd-hr-copied" aria-hidden="true">
          <Tick />
          Copied
        </span>
      </div>
    </div>
  )
}
