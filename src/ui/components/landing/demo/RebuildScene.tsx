import CountUp from "./CountUp"
import Tick from "./Tick"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

const SECTIONS = [
  { name: "Summary", detail: "1 paragraph" },
  { name: "Experience", detail: "4 roles" },
  { name: "Skills", detail: "18 items" },
  { name: "Education", detail: "2 entries" },
]

const VERSIONS = ["v1", "v2", "v3"]

/* Beat 1 file lands · beat 2 upload fills · beat 3 status flips · beat 4
   sections stack in · beat 5 the rebuild becomes v3. */

export default function RebuildScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-rebuild">
      <div className="lpd-drop">
        <div className="lpd-file">
          <span className="lpd-file-glyph" aria-hidden="true">
            PDF
          </span>

          <span className="lpd-file-meta">
            <strong>engineer-cv.pdf</strong>
            <span>248 KB</span>
          </span>

          <span className="lpd-file-pct">
            <CountUp
              to={100}
              delay={760}
              duration={1180}
              suffix="%"
              paused={paused}
            />
          </span>
        </div>

        <span className="lpd-bar" aria-hidden="true">
          <i className="lpd-bar-fill" />
        </span>
      </div>

      <div className="lpd-flips" aria-hidden="true">
        <span className="lpd-flip lpd-flip-a">queued</span>
        <span className="lpd-flip lpd-flip-b">parsing</span>
        <span className="lpd-flip lpd-flip-c">parsed</span>
      </div>

      <ul className="lpd-sections">
        {SECTIONS.map((section, index) => (
          <li
            key={section.name}
            className="lpd-section"
            style={cssVars({ "--i": index })}
          >
            <Tick />

            <span className="lpd-section-name">{section.name}</span>
            <span className="lpd-section-detail">{section.detail}</span>
          </li>
        ))}
      </ul>

      <div className="lpd-versions" aria-hidden="true">
        {VERSIONS.map((version, index) => (
          <span
            key={version}
            className={version === "v3" ? "lpd-version is-new" : "lpd-version"}
            style={cssVars({ "--i": index })}
          >
            {version}
          </span>
        ))}

        <span className="lpd-version-tag">latest</span>
      </div>

      <div className="lpd-preview" aria-hidden="true">
        <div className="lpd-preview-card">
          <span className="lpd-preview-head">CV Preview</span>
          <div className="lpd-preview-body">
            <span className="lpd-preview-name">Nguyen Van A</span>
            <span className="lpd-preview-line" />
            <span className="lpd-preview-line lpd-preview-line--short" />
            <span className="lpd-preview-section">Experience</span>
            <span className="lpd-preview-line" />
            <span className="lpd-preview-line lpd-preview-line--mid" />
            <span className="lpd-preview-section">Skills</span>
            <span className="lpd-preview-chips">
              <span className="lpd-preview-chip" />
              <span className="lpd-preview-chip" />
              <span className="lpd-preview-chip lpd-preview-chip--short" />
            </span>
          </div>
        </div>
        <div className="lpd-preview-actions">
          <span className="lpd-hr-btn is-primary lpd-preview-download">
            Download PDF
          </span>
          <span className="lpd-hr-btn lpd-preview-save">Save to History</span>
        </div>
      </div>
    </div>
  )
}
