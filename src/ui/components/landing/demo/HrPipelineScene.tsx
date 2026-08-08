import Tick from "./Tick"
import { cssVars } from "./vars"

interface FunnelStage {
  name: string

  /** Headcount before the bulk move, and after it. */
  from: number
  to: number
}

const STAGES: FunnelStage[] = [
  { name: "Applied", from: 24, to: 21 },
  { name: "Screening", from: 7, to: 10 },
  { name: "Interview", from: 3, to: 3 },
  { name: "Offer", from: 1, to: 1 },
  { name: "Hired", from: 1, to: 1 },
  { name: "Rejected", from: 12, to: 12 },
]

/** Floor keeps a count of one visible instead of collapsing the bar to nothing. */
const SCALE_FLOOR = 0.12
const SCALE_PEAK = 24

function scaleFor(count: number): number {
  const ratio = Math.min(1, count / SCALE_PEAK)

  return Number((SCALE_FLOOR + (1 - SCALE_FLOOR) * ratio).toFixed(3))
}

/* Beat 1 the funnel grows to its current shape · beat 2 three screened
   candidates are selected · beat 3 Move to Screening lands and the two affected
   bars trade height · beat 4 the move is written to stage history. */

export default function HrPipelineScene() {
  return (
    <div className="lpd-scene lpd-hr-pipeline">
      <div className="lpd-hr-funnel">
        {STAGES.map((stage, index) => (
          <div
            key={stage.name}
            className="lpd-hr-stage"
            style={cssVars({
              "--i": index,
              "--s1": scaleFor(stage.from),
              "--s2": scaleFor(stage.to),
            })}
          >
            <span className="lpd-hr-stage-count">
              {stage.from === stage.to ? (
                stage.from
              ) : (
                <span className="lpd-hr-swap">
                  <span className="lpd-hr-swap-out">{stage.from}</span>
                  <span className="lpd-hr-swap-in">{stage.to}</span>
                </span>
              )}
            </span>

            <span className="lpd-hr-column" aria-hidden="true">
              <i className="lpd-hr-column-fill" />
            </span>

            <span className="lpd-hr-stage-name">{stage.name}</span>
          </div>
        ))}
      </div>

      <div className="lpd-hr-bulk">
        <span className="lpd-hr-bulk-count">3 selected</span>

        <span className="lpd-hr-btn is-primary lpd-hr-move" aria-hidden="true">
          Move to Screening
        </span>

        <span className="lpd-hr-moved">
          <Tick />
          logged to stage history
        </span>
      </div>

      <p className="lpd-hr-note">
        Stage changes are recorded per candidate, so the board still explains
        how someone got where they are a month later.
      </p>
    </div>
  )
}
