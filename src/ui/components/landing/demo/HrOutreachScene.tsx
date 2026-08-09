import { cssVars } from "./vars"

const THREAD = [
  { from: "HR", label: "You", text: "Hi Alex, we'd love to invite you for an interview for the Frontend Developer role.", status: "sent", time: "2d ago" },
  { from: "Candidate", label: "Alex Nguyen", text: "Thanks! I'm available Thursday afternoon.", status: "received", time: "1d ago" },
]

const STATUS_STEPS = ["AI Draft", "HR Review", "Approve & Send"]

/* Beat 1 the thread appears · beat 2 the AI draft populates · beat 3 the
   subject line types · beat 4 approve, then Send is pressed · beat 5 the
   workflow reaches its last step and the header badge flips to Sent. */

export default function HrOutreachScene() {
  return (
    <div className="lpd-scene lpd-hr-outreach">
      <div className="lpd-hr-mail-head">
        <span className="lpd-hr-mail-candidate">Alex Nguyen</span>
        <span className="lpd-hr-mail-status">
          <span className="lpd-hr-mail-flip">
            <span className="lpd-hr-mail-a">Draft</span>
            <span className="lpd-hr-mail-b">Sent</span>
          </span>
        </span>
      </div>

      <div className="lpd-hr-workflow" aria-hidden="true">
        {STATUS_STEPS.map((step, i) => (
          <span key={step} className="lpd-hr-wf-step" style={cssVars({ "--i": i })}>
            <span className={i === 0 ? "lpd-hr-wf-dot is-done" : "lpd-hr-wf-dot"} />
            <span className="lpd-hr-wf-label">{step}</span>
            {i < STATUS_STEPS.length - 1 && <span className="lpd-hr-wf-line" />}
          </span>
        ))}
      </div>

      <div className="lpd-hr-thread">
        {THREAD.map((msg, i) => (
          <div key={i} className={`lpd-hr-msg lpd-hr-msg--${msg.from.toLowerCase()}`} style={cssVars({ "--i": i })}>
            <div className="lpd-hr-msg-top">
              <span className="lpd-hr-msg-label">{msg.label}</span>
              <span className="lpd-hr-msg-time">{msg.time}</span>
            </div>
            <span className="lpd-hr-msg-text">{msg.text}</span>
          </div>
        ))}
      </div>

      <div className="lpd-hr-draft">
        <div className="lpd-hr-draft-head">
          <span className="lpd-hr-draft-to">to <code>Alex Nguyen</code></span>
          <span className="lpd-hr-draft-tag">AI draft</span>
        </div>
        <span className="lpd-hr-subject">
          Re: Frontend Developer — Interview scheduling
        </span>
        <div className="lpd-hr-body">
          <span className="lpd-hr-body-line" style={cssVars({ "--i": 0 })} aria-hidden="true" />
          <span className="lpd-hr-body-line" style={cssVars({ "--i": 1 })} aria-hidden="true" />
          <span className="lpd-hr-body-line" style={cssVars({ "--i": 2 })} aria-hidden="true" />
        </div>
        <div className="lpd-hr-draft-actions">
          <span className="lpd-hr-btn lpd-hr-approve-btn" aria-hidden="true">Approve draft</span>
          <span className="lpd-hr-btn is-primary lpd-hr-send-btn" aria-hidden="true">Send</span>
        </div>
      </div>

      <p className="lpd-hr-note" style={{ animationDelay: "3200ms" }}>
        Each application has its own thread. Inbound replies are verified against
        the candidate's email. AI never sends without HR approval.
      </p>
    </div>
  )
}
