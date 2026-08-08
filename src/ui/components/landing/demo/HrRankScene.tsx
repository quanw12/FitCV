import CountUp from "./CountUp"
import Tick from "./Tick"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface Candidate {
  name: string
  meta: string
  score: number
  skills: string[]
}

const CANDIDATES: Candidate[] = [
  { name: "Mai Tran", meta: "6 yrs · React, TypeScript", score: 92, skills: ["React", "TypeScript", "CI/CD"] },
  { name: "Le Quang", meta: "5 yrs · React, Node", score: 84, skills: ["React", "Node", "Testing"] },
  { name: "Pham An", meta: "3 yrs · Vue, TypeScript", score: 66, skills: ["Vue"] },
  { name: "Vo Linh", meta: "2 yrs · jQuery, PHP", score: 41, skills: [] },
]

const SHORTLIST_SIZE = 2
const BAR_START_MS = 700
const BAR_STEP_MS = 150

/* Beat 1 the ranked pool draws itself · beat 2 the threshold slides 50 → 80 ·
   beat 3 the selection lands on everyone above the bar · beat 4 the shortlist
   is confirmed into the pipeline. */

export default function HrRankScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-hr-rank">
      <ul className="lpd-hr-rows">
        {CANDIDATES.map((candidate, index) => {
          const isPicked = index < SHORTLIST_SIZE

          return (
            <li
              key={candidate.name}
              className={isPicked ? "lpd-hr-row is-picked" : "lpd-hr-row"}
              style={cssVars({ "--i": index })}
            >
              <span className="lpd-hr-rank-no" aria-hidden="true">
                #{index + 1}
              </span>

              <span className="lpd-hr-who">
                <strong>{candidate.name}</strong>
                <span>{candidate.meta}</span>
                {candidate.skills.length > 0 && (
                  <span className="lpd-hr-who-skills">
                    {candidate.skills.map((skill) => (
                      <span key={skill} className="lpd-hr-who-chip">
                        {skill}
                      </span>
                    ))}
                  </span>
                )}
              </span>

              <span className="lpd-bar-track" aria-hidden="true">
                <i
                  className="lpd-bar-value"
                  style={cssVars({ "--score": `${candidate.score}%` })}
                />
              </span>

              <span className="lpd-hr-score">
                <CountUp
                  to={candidate.score}
                  delay={BAR_START_MS + index * BAR_STEP_MS}
                  duration={880}
                  paused={paused}
                />
              </span>

              <span className="lpd-hr-row-mark" aria-hidden="true">
                {isPicked ? <Tick /> : null}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="lpd-hr-threshold">
        <span className="lpd-hr-threshold-label">Score threshold</span>

        <span className="lpd-hr-slider" aria-hidden="true">
          <i className="lpd-hr-slider-fill" />

          <i className="lpd-hr-slider-carrier">
            <i className="lpd-hr-slider-knob" />
          </i>
        </span>

        <span className="lpd-flips lpd-hr-threshold-value" aria-hidden="true">
          <span className="lpd-flip lpd-flip-a">50</span>
          <span className="lpd-flip lpd-flip-c">80</span>
        </span>
      </div>

      <div className="lpd-hr-actions">
        <span className="lpd-hr-btn lpd-hr-select" aria-hidden="true">
          Select score ≥ 80
        </span>

        <span
          className="lpd-hr-btn is-primary lpd-hr-confirm"
          aria-hidden="true"
        >
          Confirm 2 selected
        </span>
      </div>
    </div>
  )
}
