import CountUp from "./CountUp"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface CategoryBar {
  label: string
  score: number
}

const CATEGORIES: CategoryBar[] = [
  { label: "Skills", score: 82 },
  { label: "Experience", score: 68 },
  { label: "Education", score: 91 },
  { label: "Soft skills", score: 44 },
]

const MATCHED = ["React", "TypeScript", "CI/CD", "Testing"]
const MISSING = ["GraphQL", "Mentoring"]
const BAR_STEP_MS = 150
const BAR_START_MS = 1580

/* Beat 1 the JD types itself in · beat 2 an analysing sweep crosses the panel ·
   beat 3 bars fill while their numbers count · beat 4 keyword evidence lands. */

export default function ScoreScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-score">
      <div className="lpd-jd">
        <span className="lpd-jd-head" aria-hidden="true">
          job description
        </span>

        {[0, 1, 2, 3].map((line) => (
          <span
            key={line}
            className="lpd-jd-line"
            style={cssVars({ "--i": line })}
          />
        ))}

        <span className="lpd-sweep" aria-hidden="true" />
      </div>

      <div className="lpd-bars">
        {CATEGORIES.map((category, index) => (
          <div
            key={category.label}
            className="lpd-bar-row"
            style={cssVars({ "--i": index })}
          >
            <span className="lpd-bar-label">{category.label}</span>

            <span className="lpd-bar-track" aria-hidden="true">
              <i
                className="lpd-bar-value"
                style={cssVars({ "--score": `${category.score}%` })}
              />
            </span>

            <span className="lpd-bar-score">
              <CountUp
                to={category.score}
                delay={BAR_START_MS + index * BAR_STEP_MS}
                duration={880}
                paused={paused}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="lpd-evidence">
        {MATCHED.map((keyword, index) => (
          <span
            key={keyword}
            className="lpd-key is-ok"
            style={cssVars({ "--i": index })}
          >
            {keyword}
          </span>
        ))}

        {MISSING.map((keyword, index) => (
          <span
            key={keyword}
            className="lpd-key is-missing"
            style={cssVars({ "--i": MATCHED.length + index })}
          >
            {keyword}
          </span>
        ))}
      </div>

      <div className="lpd-overall">
        <span className="lpd-overall-label">Overall match</span>

        <span className="lpd-overall-value">
          <CountUp to={71} delay={4400} duration={980} paused={paused} />
        </span>

        <span className="lpd-overall-tag">Moderate Match</span>
      </div>

      <div className="lpd-pass-prob">
        <span className="lpd-pass-head">
          <span className="lpd-pass-icon" aria-hidden="true" />
          <span className="lpd-pass-title">
            Estimated screening alignment:{" "}
            <strong>
              <CountUp to={64} delay={5400} duration={780} paused={paused} />%
            </strong>
          </span>
        </span>

        <span className="lpd-pass-bar" aria-hidden="true">
          <i className="lpd-pass-fill" />
          <i className="lpd-pass-marker" />
        </span>

        <span className="lpd-pass-disclaimer">
          Based on keyword density and category weights — not a hiring decision.
        </span>
      </div>
    </div>
  )
}
