import { cssVars } from "./vars"

const COLUMNS = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]

/* Beat 1 the board fades up · beat 2 the application card appears under Applied
   · beats 3-4 it travels one column at a time, with the stage chip and column
   header keeping pace · beat 5 a second application queues up behind it. */

export default function TrackScene() {
  return (
    <div className="lpd-scene lpd-track">
      <div className="lpd-board">
        {COLUMNS.map((column, index) => (
          <div
            key={column}
            className="lpd-col"
            style={cssVars({ "--i": index })}
          >
            <span className="lpd-col-head">
              <i className="lpd-col-dot" aria-hidden="true" />
              {column}
            </span>

            <span className="lpd-col-slot" aria-hidden="true" />
          </div>
        ))}

        <article className="lpd-app-card" aria-hidden="true">
          <strong>Senior Frontend</strong>

          <span className="lpd-app-meta">
            Acme · sent <code>v3</code>
          </span>

          <span className="lpd-app-stages">
            <span className="lpd-flip lpd-flip-a">applied</span>
            <span className="lpd-flip lpd-flip-b">in review</span>
            <span className="lpd-flip lpd-flip-c">scheduled</span>
          </span>

          <span className="lpd-app-history">
            Stage history: 3 moves
          </span>
        </article>

        <article className="lpd-app-card is-queued" aria-hidden="true">
          <strong>Platform Engineer</strong>

          <span className="lpd-app-meta">
            Northwind · sent <code>v3</code>
          </span>

          <span className="lpd-app-history">
            Stage history: 1 move
          </span>
        </article>

        <article className="lpd-app-card is-queued is-delayed" aria-hidden="true">
          <strong>DevOps Lead</strong>

          <span className="lpd-app-meta">
            Starter Inc · sent <code>v2</code>
          </span>
        </article>
      </div>
    </div>
  )
}
