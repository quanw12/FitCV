import Tick from "./Tick"
import { cssVars } from "./vars"

const TEMPLATES = ["Interview invite", "Request info", "Rejection", "Offer"]
const BODY_LINES = [0, 1, 2]
const RECIPIENTS = ["Mai Tran", "Le Quang", "Pham An"]

const WORKFLOW_STEPS = ["AI Draft", "HR Review", "Approve & Send"]

/* Beat 1 the templates land and one is picked · beat 2 the draft fills in from
   the role · beat 3 the subject types itself · beat 4 the workflow advances to
   HR Review · beat 5 the batch sends and each delivery reports back. */

export default function HrOutreachScene() {
  return (
    <div className="lpd-scene lpd-hr-outreach">
      <div className="lpd-hr-workflow" aria-hidden="true">
        {WORKFLOW_STEPS.map((step, index) => (
          <span key={step} className="lpd-hr-wf-step" style={cssVars({ "--i": index })}>
            <span className={index === 0 ? "lpd-hr-wf-dot is-done" : "lpd-hr-wf-dot"} />
            <span className="lpd-hr-wf-label">{step}</span>
            {index < WORKFLOW_STEPS.length - 1 && <span className="lpd-hr-wf-line" />}
          </span>
        ))}
      </div>

      <div className="lpd-hr-templates">
        {TEMPLATES.map((template, index) => (
          <span
            key={template}
            className={
              index === 0 ? "lpd-hr-template is-picked" : "lpd-hr-template"
            }
            style={cssVars({ "--i": index })}
          >
            {template}
          </span>
        ))}
      </div>

      <div className="lpd-hr-draft">
        <span className="lpd-hr-draft-head">
          <span className="lpd-hr-draft-to">
            to <code>3 candidates</code>
          </span>

          <span className="lpd-hr-draft-tag">AI draft</span>
        </span>

        <span className="lpd-hr-subject">
          Interview — Senior Frontend at Acme
        </span>

        {BODY_LINES.map((line) => (
          <span
            key={line}
            className="lpd-hr-body-line"
            style={cssVars({ "--i": line })}
            aria-hidden="true"
          />
        ))}

        <span className="lpd-hr-btn is-primary lpd-hr-approve" aria-hidden="true">
          Approve draft
        </span>

        <span className="lpd-hr-btn is-primary lpd-hr-send" aria-hidden="true">
          Approve & Send 3
        </span>
      </div>

      <ul className="lpd-hr-sends">
        {RECIPIENTS.map((name, index) => (
          <li
            key={name}
            className="lpd-hr-send-row"
            style={cssVars({ "--i": index })}
          >
            <Tick />

            <span className="lpd-hr-send-name">{name}</span>
            <span className="lpd-hr-send-state">delivered</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
