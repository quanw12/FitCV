import CountUp from "./CountUp"
import Tick from "./Tick"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface Suggestion {
  label: string
  hint: string
  delta: string
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Quantify impact in Experience",
    hint: "add metrics to 2 roles",
    delta: "+6",
  },
  {
    label: "Add GraphQL to Skills",
    hint: "found in the job description",
    delta: "+3",
  },
  {
    label: "Rewrite the summary",
    hint: "lead with the target role",
    delta: "+2",
  },
]

/* Beat 1 suggestions land · beat 2 a pointer crosses to the first Apply and
   presses it · beat 3 the same for the second · beat 4 the match total catches
   up and the rebuild button arms itself. */

export default function ImproveScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-improve">
      <ul className="lpd-sugs">
        {SUGGESTIONS.map((suggestion, index) => (
          <li
            key={suggestion.label}
            className={index < 2 ? "lpd-sug is-applied" : "lpd-sug"}
            style={cssVars({ "--i": index })}
          >
            <Tick />

            <span className="lpd-sug-text">
              <strong>{suggestion.label}</strong>
              <span>{suggestion.hint}</span>
            </span>

            <span className="lpd-sug-delta" aria-hidden="true">
              {suggestion.delta}
            </span>

            <span className="lpd-sug-apply" aria-hidden="true">
              Apply
            </span>
          </li>
        ))}

        <span className="lpd-pointer" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="M4 2.5 15.5 9.4 10.2 10.6 8.9 16z" />
          </svg>
        </span>
      </ul>

      <div className="lpd-tally">
        <span className="lpd-tally-label">Match after rebuild</span>

        <span className="lpd-tally-from" aria-hidden="true">
          71
        </span>

        <span className="lpd-tally-arrow" aria-hidden="true">
          →
        </span>

        <span className="lpd-tally-to">
          <CountUp
            from={71}
            to={80}
            delay={4500}
            duration={1050}
            paused={paused}
          />
        </span>

        <span className="lpd-tally-cta">Rebuild v4</span>
      </div>

      <div className="lpd-rewrite" aria-hidden="true">
        <span className="lpd-rewrite-head">Rewrite preview</span>
        <div className="lpd-rewrite-pair">
          <div className="lpd-rewrite-col">
            <span className="lpd-rewrite-tag">Before</span>
            <span className="lpd-rewrite-text">
              Worked at Acme as a frontend developer
            </span>
          </div>
          <div className="lpd-rewrite-col">
            <span className="lpd-rewrite-tag lpd-rewrite-tag--new">After</span>
            <span className="lpd-rewrite-text lpd-rewrite-text--new">
              Led 3 React projects at Acme, improving page load by 40%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
