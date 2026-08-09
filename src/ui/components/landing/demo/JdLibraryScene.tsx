import CountUp from "./CountUp"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface SavedJd {
  title: string
  company: string
  skills: string[]
  score: number
  label: string
}

const SAVED_JDS: SavedJd[] = [
  {
    title: "Senior Frontend",
    company: "Acme",
    skills: ["React", "TypeScript", "CI/CD"],
    score: 71,
    label: "Moderate",
  },
  {
    title: "Backend Lead",
    company: "Northwind",
    skills: ["Node", "PostgreSQL", "AWS"],
    score: 88,
    label: "Strong",
  },
  {
    title: "Full-Stack Dev",
    company: "Starter Inc",
    skills: ["React", "Node", "MongoDB"],
    score: 54,
    label: "Moderate",
  },
]
const AVG_SCORE = Math.round(
  SAVED_JDS.reduce((sum, jd) => sum + jd.score, 0) / SAVED_JDS.length,
)

/* Beat 1 the library header and search rise · beat 2 the insights card
   appears · beat 3 JD cards stack in · beat 4 the first card highlights
   with two actions. */

export default function JdLibraryScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-jd-lib">
      <span className="lpd-jd-lib-head">
        Saved JDs
        <span className="lpd-jd-lib-count">{SAVED_JDS.length} saved</span>
      </span>

      <div className="lpd-jd-search">
        <span className="lpd-jd-search-icon" aria-hidden="true" />
        <span className="lpd-jd-search-placeholder">Search by title, company, or skill...</span>
      </div>

      <div className="lpd-jd-insights">
        <div className="lpd-jd-insight">
          <span className="lpd-jd-insight-value">
            <CountUp to={SAVED_JDS.length} delay={900} duration={600} paused={paused} />
          </span>
          <span className="lpd-jd-insight-label">Active opportunities</span>
        </div>
        <div className="lpd-jd-insight">
          <span className="lpd-jd-insight-value">
            <CountUp to={AVG_SCORE} delay={1050} duration={800} paused={paused} />
          </span>
          <span className="lpd-jd-insight-label">Avg match score</span>
        </div>
      </div>

      <div className="lpd-jd-cards">
        {SAVED_JDS.map((jd, cardIndex) => (
          <div
            key={jd.title}
            className={
              cardIndex === 0
                ? "lpd-jd-card is-picked"
                : "lpd-jd-card"
            }
            style={cssVars({ "--i": cardIndex })}
          >
            <span className="lpd-jd-card-head">
              <span className="lpd-jd-card-title">
                {cardIndex === 0 ? "★ " : ""}
                {jd.title} · {jd.company}
              </span>
              <span
                className={
                  jd.score >= 80
                    ? "lpd-jd-score is-strong"
                    : "lpd-jd-score"
                }
              >
                {jd.score}
              </span>
            </span>

            <span className="lpd-jd-chips">
              {jd.skills.map((skill, skillIndex) => (
                <span
                  key={skill}
                  className="lpd-jd-chip"
                  style={cssVars({
                    "--i": cardIndex * 3 + skillIndex,
                  })}
                >
                  {skill}
                </span>
              ))}
            </span>

            <span className="lpd-jd-card-meta">
              Last score: {jd.score} · {jd.label} Match
            </span>

            {cardIndex === 0 && (
              <span className="lpd-jd-actions">
                <span
                  className="lpd-hr-btn is-primary lpd-jd-analyze-btn"
                  aria-hidden="true"
                >
                  Analyze this JD
                </span>
                <span
                  className="lpd-hr-btn lpd-jd-apply-btn"
                  aria-hidden="true"
                >
                  View &amp; apply
                </span>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="lpd-jd-loaded">
        <span className="lpd-jd-loaded-label">loaded into analyzer</span>
        <span className="lpd-jd-loaded-title">
          "Senior Frontend at Acme"
        </span>
      </div>
    </div>
  )
}
