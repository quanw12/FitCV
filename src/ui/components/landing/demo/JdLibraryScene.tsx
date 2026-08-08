import Tick from "./Tick"
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

const SKILL_STEP_MS = 100
const CARD_STEP_MS = 200

/* Beat 1 the library header rises · beat 2 JD cards stack in one by one ·
   beat 3 skill chips appear on each card · beat 4 the first card highlights
   and "Analyze this JD" is pressed · beat 5 the JD loads into the analyzer
   context and a mini score appears. */

export default function JdLibraryScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-jd-lib">
      <span className="lpd-jd-lib-head">
        Saved JDs
        <span className="lpd-jd-lib-count">3 analyses</span>
      </span>

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
              <span
                className="lpd-hr-btn is-primary lpd-jd-analyze-btn"
                aria-hidden="true"
              >
                Analyze this JD
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
