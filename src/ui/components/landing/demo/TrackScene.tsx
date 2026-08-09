import { cssVars } from "./vars"

const COLUMNS = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
]

/* Beat 1 the board rises and four applications land in Applied · beat 2 Card A
   (Senior Frontend) moves to Screening, then Interview · beat 3 Card B (Backend)
   moves to Screening · beat 4 Card D (DevOps) is rejected · Card C (Product
   Designer) stays in Applied. The board rests as a realistic pipeline snapshot. */

export default function TrackScene() {
  return (
    <div className="lpd-scene lpd-track">
      <div className="lpd-track-head">
        <strong>Application pipeline</strong>
        <span>4 applications · 6 stages</span>
      </div>

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

        {/* Card A: Applied → Screening → Interview (Senior Frontend @ Northwind, v3) */}
        <article className="lpd-app-card lpd-app-card--a" aria-hidden="true">
          <strong>Senior Frontend</strong>
          <span className="lpd-app-meta">Northwind</span>
          <span className="lpd-app-foot">
            <span className="lpd-app-cv">v3</span>
            <span className="lpd-app-stage lpd-app-stage--interview">
              Interview
            </span>
          </span>
        </article>

        {/* Card B: Applied → Screening (Backend Engineer @ Globex, v2) */}
        <article className="lpd-app-card lpd-app-card--b" aria-hidden="true">
          <strong>Backend Engineer</strong>
          <span className="lpd-app-meta">Globex</span>
          <span className="lpd-app-foot">
            <span className="lpd-app-cv">v2</span>
            <span className="lpd-app-stage lpd-app-stage--screening">
              Screening
            </span>
          </span>
        </article>

        {/* Card C: stays in Applied (Product Designer @ Initech, v3) */}
        <article className="lpd-app-card lpd-app-card--c" aria-hidden="true">
          <strong>Product Designer</strong>
          <span className="lpd-app-meta">Initech</span>
          <span className="lpd-app-foot">
            <span className="lpd-app-cv">v3</span>
            <span className="lpd-app-stage lpd-app-stage--applied">Applied</span>
          </span>
        </article>

        {/* Card D: Applied → Rejected (DevOps Engineer @ Umbrella, v1) */}
        <article className="lpd-app-card lpd-app-card--d" aria-hidden="true">
          <strong>DevOps Engineer</strong>
          <span className="lpd-app-meta">Umbrella</span>
          <span className="lpd-app-foot">
            <span className="lpd-app-cv">v1</span>
            <span className="lpd-app-stage lpd-app-stage--rejected">
              Rejected
            </span>
          </span>
        </article>
      </div>
    </div>
  )
}
