import CountUp from "./CountUp"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface IntakeStat {
  label: string
  value: number
  tone?: "ok" | "warn"
}

const STATS: IntakeStat[] = [
  { label: "Processed", value: 24 },
  { label: "Strong ≥ 80", value: 7, tone: "ok" },
  { label: "Moderate", value: 11 },
  { label: "Below bar", value: 6, tone: "warn" },
]

const STAT_START_MS = 3500
const STAT_STEP_MS = 130

/* Beat 1 the batch lands · beat 2 the upload fills · beat 3 the status flips
   from queued to ranked · beat 4 the pool breaks into score bands. */

export default function HrIntakeScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-hr-intake">
      <div className="lpd-drop">
        <div className="lpd-file">
          <span className="lpd-file-glyph" aria-hidden="true">
            24
          </span>

          <span className="lpd-file-meta">
            <strong>senior-frontend-pool</strong>
            <span>24 files · 6.1 MB</span>
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
        <span className="lpd-flip lpd-flip-b">parsing 24 CVs</span>
        <span className="lpd-flip lpd-flip-c">ranked</span>
      </div>

      <ul className="lpd-hr-stats">
        {STATS.map((stat, index) => (
          <li
            key={stat.label}
            className={
              stat.tone ? `lpd-hr-stat is-${stat.tone}` : "lpd-hr-stat"
            }
            style={cssVars({ "--i": index })}
          >
            <span className="lpd-hr-stat-value">
              <CountUp
                to={stat.value}
                delay={STAT_START_MS + index * STAT_STEP_MS}
                duration={760}
                paused={paused}
              />
            </span>

            <span className="lpd-hr-stat-label">{stat.label}</span>
          </li>
        ))}
      </ul>

      <p className="lpd-hr-note">
        Every CV in the batch is scored on the same four categories — no keyword
        triage on the first pass.
      </p>

      <div className="lpd-hr-cv-files" aria-hidden="true">
        <span className="lpd-hr-cv-file-head">Parsing status</span>
        {[
          { name: "mai-tran-cv.pdf", status: "Parsed" },
          { name: "le-quang-cv.docx", status: "Parsing" },
          { name: "pham-an-cv.pdf", status: "Queued" },
        ].map((file, index) => (
          <span
            key={file.name}
            className="lpd-hr-cv-file"
            style={cssVars({ "--i": index })}
          >
            <span className="lpd-hr-cv-file-icon">📄</span>
            <span className="lpd-hr-cv-file-name">{file.name}</span>
            <span
              className={
                file.status === "Parsed"
                  ? "lpd-hr-cv-status is-done"
                  : file.status === "Parsing"
                    ? "lpd-hr-cv-status is-active"
                    : "lpd-hr-cv-status"
              }
            >
              {file.status}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
