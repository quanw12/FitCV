import CountUp from "./CountUp"
import Tick from "./Tick"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

const NAV = ["Skill Gap Report", "Section Feedback", "Rewrite Suggestions", "Quick Wins"]
const OVERALL_SCORE = 71
/* scoreLabel() in services/improvementReport.ts: >=80 Strong, >=50 Moderate. */
const OVERALL_LABEL = "Moderate Match"
const SKILL_GAPS = [
  { skill: "GraphQL", priority: "High", reason: "Named in the JD, absent from your CV" },
  { skill: "Mentoring", priority: "Medium", reason: "Listed under responsibilities" },
]
const JD_EVIDENCE = "Experience with GraphQL federation across service teams."
const FEEDBACK = [
  { section: "Summary", issue: "No measurable outcomes", priority: "High" },
  { section: "Work Experience", issue: "Duties listed, not results", priority: "High" },
  { section: "Skills", issue: "Unordered, no proficiency", priority: "Medium" },
]
const FEEDBACK_ACTION = "Open with a metric-backed positioning line."
const REWRITE = {
  section: "Summary",
  framework: "STAR",
  issue: "Reads as a job title, not an outcome",
  before: "Experienced frontend developer with 5 years building web apps.",
  after: "Senior Frontend Engineer — 5 yrs on React SPAs, cut bundle size 38%, raised Lighthouse to 96.",
}
const QUICK_WINS = [
  { title: "Add metrics to experience", meta: "Experience · High priority" },
  { title: "List React certifications", meta: "Skills · Medium priority" },
]

function itemCount(n: number): string {
  return n === 1 ? "1 item" : `${n} items`
}

/* Beat 1 the header rises and Overall Match counts up · beat 2 the sidebar
   walks its four anchors, swapping one section in per stop: skill gaps with
   their JD evidence, section feedback expanding a recommended action, the
   rewrite original/suggestion with Copy, then quick wins checking off and
   filling the progress bar · beat 3 the rebuild CTA arms, is pressed, and
   hands the accepted rewrites to CV Rebuild. */

export default function ImproveScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-improve">
      <div className="lpd-imp-header">
        <span className="lpd-imp-title">AI Improvement Suggestions</span>
        <span className="lpd-imp-regen" aria-hidden="true">Regenerate</span>
      </div>

      <div className="lpd-imp-layout">
        <div className="lpd-imp-sidebar">
          {NAV.map((item, i) => (
            <span
              key={item}
              className={i === NAV.length - 1 ? "lpd-imp-nav is-last" : "lpd-imp-nav"}
              style={cssVars({ "--i": i })}
            >
              {item}
            </span>
          ))}

          <span className="lpd-imp-overall">
            <span className="lpd-imp-overall-label">Overall Match</span>
            <strong className="lpd-imp-overall-value">
              <CountUp to={OVERALL_SCORE} delay={400} duration={1100} suffix="%" paused={paused} />
            </strong>
            <span className="lpd-imp-overall-word">{OVERALL_LABEL}</span>
          </span>
        </div>

        <div className="lpd-imp-stack">
          <section className="lpd-imp-sec" style={cssVars({ "--s": 0 })}>
            <span className="lpd-imp-sec-head">
              Skill Gap Report
              <span className="lpd-imp-sec-count">{itemCount(SKILL_GAPS.length)}</span>
            </span>

            {SKILL_GAPS.map((gap, i) => (
              <div key={gap.skill} className="lpd-imp-gap" style={cssVars({ "--i": i })}>
                <span className="lpd-imp-gap-skill">{gap.skill}</span>
                <span className={`lpd-imp-priority is-${gap.priority.toLowerCase()}`}>
                  {gap.priority} priority
                </span>
                <span className="lpd-imp-gap-reason">{gap.reason}</span>
              </div>
            ))}

            <span className="lpd-imp-evidence">
              <strong>JD evidence:</strong> {JD_EVIDENCE}
            </span>
          </section>

          <section className="lpd-imp-sec" style={cssVars({ "--s": 1 })}>
            <span className="lpd-imp-sec-head">
              Section-by-section Feedback
              <span className="lpd-imp-sec-count">{itemCount(FEEDBACK.length)}</span>
            </span>

            {FEEDBACK.map((fb, i) => (
              <div
                key={fb.section}
                className={i === 0 ? "lpd-imp-fb is-open" : "lpd-imp-fb"}
                style={cssVars({ "--i": i })}
              >
                <span className="lpd-imp-fb-row">
                  <span className="lpd-imp-fb-sec">{fb.section}</span>
                  <span className="lpd-imp-fb-issue">— {fb.issue}</span>
                  <span className={`lpd-imp-priority is-${fb.priority.toLowerCase()}`}>
                    {fb.priority}
                  </span>
                  <i className="lpd-imp-fb-caret" aria-hidden="true" />
                </span>

                {i === 0 && (
                  <span className="lpd-imp-fb-detail">
                    <strong>Recommended action</strong> {FEEDBACK_ACTION}
                  </span>
                )}
              </div>
            ))}
          </section>

          <section className="lpd-imp-sec" style={cssVars({ "--s": 2 })}>
            <span className="lpd-imp-sec-head">
              Rewrite Suggestions
              <span className="lpd-imp-sec-count">{itemCount(1)}</span>
            </span>

            <span className="lpd-imp-rw-head">
              <span className="lpd-imp-rw-section">{REWRITE.section}</span>
              <span className="lpd-imp-rw-fw">{REWRITE.framework}</span>
            </span>

            <span className="lpd-imp-rw-issue">Issue: {REWRITE.issue}</span>

            <div className="lpd-imp-rw-pair">
              <span className="lpd-imp-rw-col" style={cssVars({ "--i": 0 })}>
                <span className="lpd-imp-rw-tag">Original</span>
                <span className="lpd-imp-rw-text">{REWRITE.before}</span>
              </span>

              <span className="lpd-imp-rw-col" style={cssVars({ "--i": 1 })}>
                <span className="lpd-imp-rw-tag lpd-imp-rw-tag--new">Suggested rewrite</span>
                <span className="lpd-imp-rw-text lpd-imp-rw-text--new">
                  {REWRITE.after}
                  <i className="lpd-imp-rw-sweep" aria-hidden="true" />
                </span>
              </span>
            </div>

            <span className="lpd-imp-rw-foot">
              <span className="lpd-hr-btn lpd-imp-rw-copy" aria-hidden="true">Copy rewrite</span>
              <span className="lpd-imp-rw-copied" aria-hidden="true">
                <Tick />
                Copied
              </span>
            </span>
          </section>

          <section className="lpd-imp-sec is-last" style={cssVars({ "--s": 3 })}>
            <span className="lpd-imp-sec-head">
              Quick Wins Checklist
              <span className="lpd-imp-sec-count">{itemCount(QUICK_WINS.length)}</span>
            </span>

            {QUICK_WINS.map((qw, i) => (
              <div key={qw.title} className="lpd-imp-qw" style={cssVars({ "--i": i })}>
                <span className="lpd-imp-qw-box">
                  <Tick />
                </span>
                <span className="lpd-imp-qw-title">{qw.title}</span>
                <span className="lpd-imp-qw-meta">{qw.meta}</span>
              </div>
            ))}

            <span className="lpd-imp-qw-bar" aria-hidden="true">
              <i className="lpd-imp-qw-fill" />
            </span>

            <span className="lpd-imp-qw-flips" aria-hidden="true">
              <span className="lpd-imp-qw-a">1/2 completed</span>
              <span className="lpd-imp-qw-b">2/2 completed</span>
            </span>
          </section>
        </div>
      </div>

      <div className="lpd-imp-rebuild">
        <span className="lpd-hr-btn is-primary lpd-imp-rebuild-btn" aria-hidden="true">
          Apply all &amp; rebuild CV
        </span>

        <span className="lpd-imp-handoff" aria-hidden="true">
          <Tick />
          CV Rebuild · prefilled
        </span>

        <span className="lpd-imp-rebuild-note">
          Carries the accepted rewrites into CV Rebuild, so the next version
          starts from the improved text.
        </span>
      </div>

      <p className="lpd-hr-note" style={{ animationDelay: "7700ms" }}>
        AI suggestions support your review and do not guarantee a hiring outcome.
      </p>
    </div>
  )
}
