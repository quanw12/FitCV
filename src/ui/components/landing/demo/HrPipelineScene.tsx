import Tick from "./Tick"
import { cssVars } from "./vars"

/* Applied starts with 4 candidates. After "Move to Screening" is pressed,
   An, Minh, Linh leave Applied and appear in Screening.
   Final: Applied=1 (Hai), Screening=4 (Tuan + An, Minh, Linh). */

export default function HrPipelineScene() {
  return (
    <div className="lpd-scene lpd-hr-pipeline">
      <div className="lpd-hr-kanban">
        {/* ── Applied ── */}
        <div className="lpd-hr-col" style={cssVars({ "--ci": 0 })}>
          <span className="lpd-hr-col-head">
            <span className="lpd-hr-col-name">Applied</span>
            <span className="lpd-hr-col-count" aria-hidden="true">
              <span className="lpd-hr-count-swap">
                <span className="lpd-hr-count-out">4</span>
                <span className="lpd-hr-count-in">1</span>
              </span>
            </span>
          </span>

          <div className="lpd-hr-col-body">
            {/* stays */}
            <div className="lpd-hr-card" style={cssVars({ "--col": 0, "--card": 0 })}>
              <span className="lpd-hr-card-name">Hai Le</span>
              <span className="lpd-hr-card-meta">DevOps · 71</span>
            </div>
            {/* leaves */}
            <div className="lpd-hr-card lpd-hr-card--leave lpd-hr-card--l1" style={cssVars({ "--col": 0, "--card": 1 })}>
              <span className="lpd-hr-card-name">An Nguyen</span>
              <span className="lpd-hr-card-meta">Frontend · 82</span>
            </div>
            <div className="lpd-hr-card lpd-hr-card--leave lpd-hr-card--l2" style={cssVars({ "--col": 0, "--card": 2 })}>
              <span className="lpd-hr-card-name">Minh Tran</span>
              <span className="lpd-hr-card-meta">Backend · 74</span>
            </div>
            <div className="lpd-hr-card lpd-hr-card--leave lpd-hr-card--l3" style={cssVars({ "--col": 0, "--card": 3 })}>
              <span className="lpd-hr-card-name">Linh Pham</span>
              <span className="lpd-hr-card-meta">Full-stack · 68</span>
            </div>
          </div>
        </div>

        {/* ── Screening ── */}
        <div className="lpd-hr-col" style={cssVars({ "--ci": 1 })}>
          <span className="lpd-hr-col-head">
            <span className="lpd-hr-col-name">Screening</span>
            <span className="lpd-hr-col-count" aria-hidden="true">
              <span className="lpd-hr-count-swap">
                <span className="lpd-hr-count-out">1</span>
                <span className="lpd-hr-count-in">4</span>
              </span>
            </span>
          </span>

          <div className="lpd-hr-col-body">
            {/* already here */}
            <div className="lpd-hr-card" style={cssVars({ "--col": 1, "--card": 0 })}>
              <span className="lpd-hr-card-name">Tuan Vo</span>
              <span className="lpd-hr-card-meta">Frontend · 88</span>
            </div>
            {/* entering — hidden until move */}
            <div className="lpd-hr-card lpd-hr-card--enter lpd-hr-card--e1" style={cssVars({ "--col": 1, "--card": 1 })}>
              <span className="lpd-hr-card-name">An Nguyen</span>
              <span className="lpd-hr-card-meta">Frontend · 82</span>
            </div>
            <div className="lpd-hr-card lpd-hr-card--enter lpd-hr-card--e2" style={cssVars({ "--col": 1, "--card": 2 })}>
              <span className="lpd-hr-card-name">Minh Tran</span>
              <span className="lpd-hr-card-meta">Backend · 74</span>
            </div>
            <div className="lpd-hr-card lpd-hr-card--enter lpd-hr-card--e3" style={cssVars({ "--col": 1, "--card": 3 })}>
              <span className="lpd-hr-card-name">Linh Pham</span>
              <span className="lpd-hr-card-meta">Full-stack · 68</span>
            </div>
          </div>
        </div>

        {/* ── Interview ── */}
        <div className="lpd-hr-col" style={cssVars({ "--ci": 2 })}>
          <span className="lpd-hr-col-head">
            <span className="lpd-hr-col-name">Interview</span>
            <span className="lpd-hr-col-count" aria-hidden="true">1</span>
          </span>
          <div className="lpd-hr-col-body">
            <div className="lpd-hr-card" style={cssVars({ "--col": 2, "--card": 0 })}>
              <span className="lpd-hr-card-name">Mai Hoang</span>
              <span className="lpd-hr-card-meta">Backend · 91</span>
            </div>
          </div>
        </div>

        {/* ── Offer ── */}
        <div className="lpd-hr-col" style={cssVars({ "--ci": 3 })}>
          <span className="lpd-hr-col-head">
            <span className="lpd-hr-col-name">Offer</span>
            <span className="lpd-hr-col-count" aria-hidden="true">0</span>
          </span>
          <div className="lpd-hr-col-body" />
        </div>

        {/* ── Hired ── */}
        <div className="lpd-hr-col" style={cssVars({ "--ci": 4 })}>
          <span className="lpd-hr-col-head">
            <span className="lpd-hr-col-name">Hired</span>
            <span className="lpd-hr-col-count" aria-hidden="true">0</span>
          </span>
          <div className="lpd-hr-col-body" />
        </div>

        {/* ── Rejected ── */}
        <div className="lpd-hr-col" style={cssVars({ "--ci": 5 })}>
          <span className="lpd-hr-col-head">
            <span className="lpd-hr-col-name">Rejected</span>
            <span className="lpd-hr-col-count" aria-hidden="true">0</span>
          </span>
          <div className="lpd-hr-col-body" />
        </div>
      </div>

      <div className="lpd-hr-pipeline-actions">
        <span className="lpd-hr-bulk-count">3 selected</span>

        <span className="lpd-hr-btn is-primary lpd-hr-move" aria-hidden="true">
          Move to Screening
        </span>

        <span className="lpd-hr-moved">
          <Tick />
          logged
        </span>
      </div>
    </div>
  )
}
