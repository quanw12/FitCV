import CountUp from "./CountUp"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface JobHit {
  title: string
  company: string
  location: string
  date: string
  seniority: string
  source: "LinkedIn" | "freehire"
  keywords: string[]
}

const QUERY = "React · TypeScript"
const SEARCH_LOCATION = "Remote"
const DERIVED_LEVEL = "Senior"
const RESULTS: JobHit[] = [
  {
    title: "Senior Frontend Engineer",
    company: "Vercel",
    location: "Remote",
    date: "2d ago",
    seniority: "Senior",
    source: "LinkedIn",
    keywords: ["React", "Next.js", "TypeScript"],
  },
  {
    title: "Frontend Developer",
    company: "Shopify",
    location: "Remote",
    date: "1w ago",
    seniority: "Mid-level",
    source: "freehire",
    keywords: ["React", "GraphQL"],
  },
  {
    title: "UI Engineer",
    company: "Stripe",
    location: "San Francisco",
    date: "3d ago",
    seniority: "Senior",
    source: "LinkedIn",
    keywords: ["React", "CSS", "Design Systems"],
  },
]

/* Beat 1 the search card rises and its six filters stagger in · beat 2 the CV
   selector resolves to the latest parsed version · beat 3 the keyword and level
   fields type themselves in from that CV · beat 4 the button is pressed and
   holds a Searching state · beat 5 the result header counts up next to its
   derived-level and AI badges · beat 6 job cards stack in, each unpacking
   source, seniority, company, location, date, matched keywords and View job. */

export default function JobSearchScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-job-search">
      <div className="lpd-js-form">
        <span className="lpd-js-form-head">
          Scan CV &amp; search
          <span className="lpd-js-form-sub">
            freehire.me + LinkedIn · tech-focused · best-effort
          </span>
        </span>

        <div className="lpd-js-grid">
          <span className="lpd-js-field" style={cssVars({ "--i": 0 })}>
            <span className="lpd-js-label">CV to scan</span>
            <span className="lpd-js-select lpd-js-cv">
              <span className="lpd-js-cv-a">Select a CV…</span>
              <span className="lpd-js-cv-b">my-cv-latest.pdf (v3)</span>
            </span>
          </span>

          <span className="lpd-js-field" style={cssVars({ "--i": 1 })}>
            <span className="lpd-js-label">
              Keywords <em className="lpd-js-hint">auto-derive</em>
            </span>
            <span className="lpd-js-input lpd-js-ai-fill" style={cssVars({ "--i": 0 })}>
              {QUERY}
              <i className="lpd-js-caret" aria-hidden="true" />
            </span>
          </span>

          <span className="lpd-js-field" style={cssVars({ "--i": 2 })}>
            <span className="lpd-js-label">Location</span>
            <span className="lpd-js-input">{SEARCH_LOCATION}</span>
          </span>

          <span className="lpd-js-field" style={cssVars({ "--i": 3 })}>
            <span className="lpd-js-label">Workplace type</span>
            <span className="lpd-js-select">Remote</span>
          </span>

          <span className="lpd-js-field" style={cssVars({ "--i": 4 })}>
            <span className="lpd-js-label">Posted within</span>
            <span className="lpd-js-select">Last 14 days</span>
          </span>

          <span className="lpd-js-field" style={cssVars({ "--i": 5 })}>
            <span className="lpd-js-label">
              Level <em className="lpd-js-hint">auto-detect</em>
            </span>
            <span className="lpd-js-select lpd-js-ai-fill" style={cssVars({ "--i": 1 })}>
              {DERIVED_LEVEL}
              <i className="lpd-js-caret" aria-hidden="true" />
            </span>
          </span>
        </div>

        <span className="lpd-hr-btn is-primary lpd-js-btn" aria-hidden="true">
          <i className="lpd-js-spin" />
          <span className="lpd-js-btn-a">Find matching jobs</span>
          <span className="lpd-js-btn-b">Searching…</span>
        </span>
      </div>

      <span className="lpd-js-results-head">
        <span className="lpd-js-results-count">
          <CountUp to={RESULTS.length} delay={3400} duration={520} paused={paused} />
          {` jobs for “${QUERY}” in ${SEARCH_LOCATION}`}
        </span>

        <span className="lpd-js-badge is-level">Level: {DERIVED_LEVEL}</span>
        <span className="lpd-js-badge is-ai">AI-derived from CV</span>
      </span>

      <div className="lpd-js-cards">
        {RESULTS.map((job, index) => (
          <article
            key={job.title}
            className={index === 0 ? "lpd-js-card is-picked" : "lpd-js-card"}
            style={cssVars({ "--i": index })}
          >
            <span className="lpd-js-card-title">{job.title}</span>

            <span className="lpd-js-tags">
              <span
                className={
                  job.source === "LinkedIn"
                    ? "lpd-js-source is-linkedin"
                    : "lpd-js-source is-freehire"
                }
              >
                {job.source}
              </span>
              <span className="lpd-js-seniority">{job.seniority}</span>
            </span>

            <span className="lpd-js-meta">
              <span className="lpd-js-meta-row" style={cssVars({ "--i": index * 3 })}>
                <i className="lpd-js-ico is-org" aria-hidden="true" />
                {job.company}
              </span>
              <span className="lpd-js-meta-row" style={cssVars({ "--i": index * 3 + 1 })}>
                <i className="lpd-js-ico is-pin" aria-hidden="true" />
                {job.location}
              </span>
              <span className="lpd-js-meta-row" style={cssVars({ "--i": index * 3 + 2 })}>
                <i className="lpd-js-ico is-cal" aria-hidden="true" />
                {job.date}
              </span>
            </span>

            <span className="lpd-js-keywords">
              {job.keywords.map((kw, ki) => (
                <span
                  key={kw}
                  className="lpd-js-kw"
                  style={cssVars({ "--ki": index * 3 + ki })}
                >
                  {kw}
                </span>
              ))}
            </span>

            <span className="lpd-js-view" aria-hidden="true">
              View job
              <i className="lpd-js-out" />
            </span>
          </article>
        ))}
      </div>
    </div>
  )
}
