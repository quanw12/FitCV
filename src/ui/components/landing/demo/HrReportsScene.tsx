import CountUp from "./CountUp"
import type { SceneProps } from "./scenes"
import { cssVars } from "./vars"

interface Kpi {
  label: string
  value: number
  suffix?: string
  tone?: "ok" | "warn"
}

const KPIS: Kpi[] = [
  { label: "Active jobs", value: 4 },
  { label: "Avg score", value: 72, suffix: "" },
  { label: "Shortlist time", value: 3.2, suffix: "d" },
  { label: "Offer acceptance", value: 87, suffix: "%", tone: "ok" },
]

const SCREENING = { passed: 32, total: 47 }

const SCORE_DIST = [
  { range: "0-49", count: 8 },
  { range: "50-79", count: 18 },
  { range: "80-100", count: 12 },
]

const SOURCES = [
  { name: "FitCV Jobs", count: 18, pct: 38 },
  { name: "LinkedIn", count: 14, pct: 30 },
  { name: "Referrals", count: 9, pct: 19 },
  { name: "External upload", count: 6, pct: 13 },
]

const ACTIVITY = [
  { action: "Alex Nguyen moved to Interview", time: "2h ago" },
  { action: "3 CVs screened for Frontend Dev", time: "5h ago" },
  { action: "Ana Garcia received offer", time: "1d ago" },
  { action: "New job posted: Backend Lead", time: "2d ago" },
]

const KPI_START_MS = 1200
const KPI_STEP_MS = 140

/* Beat 1 the header rises · beat 2 KPI cards count up · beat 3 screening
   rate fills · beat 4 source breakdown bars fill · beat 5 activity feed
   slides in. */

export default function HrReportsScene({ paused }: SceneProps) {
  return (
    <div className="lpd-scene lpd-hr-reports">
      <div className="lpd-hr-rep-head">
        <span className="lpd-hr-rep-title">Hiring Dashboard</span>
        <span className="lpd-hr-rep-period">Last 30 days</span>
      </div>

      <ul className="lpd-hr-rep-metrics">
        {KPIS.map((m, i) => (
          <li
            key={m.label}
            className={m.tone ? `lpd-hr-rep-metric is-${m.tone}` : "lpd-hr-rep-metric"}
            style={cssVars({ "--i": i })}
          >
            <span className="lpd-hr-rep-metric-value">
              <CountUp
                to={m.value}
                delay={KPI_START_MS + i * KPI_STEP_MS}
                duration={800}
                suffix={m.suffix ?? ""}
                paused={paused}
              />
            </span>
            <span className="lpd-hr-rep-metric-label">{m.label}</span>
          </li>
        ))}
      </ul>

      <div className="lpd-hr-rep-row">
        <div className="lpd-hr-rep-card">
          <span className="lpd-hr-rep-card-head">Screening pass rate</span>
          <div className="lpd-hr-rep-pass">
            <span className="lpd-hr-rep-pass-score">
              <CountUp to={Math.round((SCREENING.passed / SCREENING.total) * 100)} delay={2200} duration={800} paused={paused} />%
            </span>
            <span className="lpd-hr-rep-pass-detail">{SCREENING.passed} of {SCREENING.total} candidates passed</span>
          </div>
          <div className="lpd-hr-rep-pass-bar">
            <i className="lpd-hr-rep-pass-fill" style={cssVars({ "--w": `${(SCREENING.passed / SCREENING.total) * 100}%` })} />
          </div>
        </div>

        <div className="lpd-hr-rep-card">
          <span className="lpd-hr-rep-card-head">Score distribution</span>
          <div className="lpd-hr-rep-bars">
            {SCORE_DIST.map((s, i) => (
              <div key={s.range} className="lpd-hr-rep-bar-row" style={cssVars({ "--i": i })}>
                <span className="lpd-hr-rep-bar-label">{s.range}</span>
                <span className="lpd-hr-rep-bar-track">
                  <i className="lpd-hr-rep-bar-fill" style={cssVars({ "--w": `${(s.count / 20) * 100}%`, "--i": i })} />
                </span>
                <span className="lpd-hr-rep-bar-count">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lpd-hr-rep-row">
        <div className="lpd-hr-rep-card">
          <span className="lpd-hr-rep-card-head">Source breakdown</span>
          <div className="lpd-hr-rep-sources">
            {SOURCES.map((src, i) => (
              <div key={src.name} className="lpd-hr-rep-src-row" style={cssVars({ "--i": i })}>
                <span className="lpd-hr-rep-src-name">{src.name}</span>
                <span className="lpd-hr-rep-src-bar">
                  <i className="lpd-hr-rep-src-fill" style={cssVars({ "--w": `${src.pct}%`, "--i": i })} />
                </span>
                <span className="lpd-hr-rep-src-count">{src.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lpd-hr-rep-card">
          <span className="lpd-hr-rep-card-head">Recent activity</span>
          <div className="lpd-hr-rep-activity">
            {ACTIVITY.map((a, i) => (
              <div key={a.action} className="lpd-hr-rep-act-row" style={cssVars({ "--i": i })}>
                <span className="lpd-hr-rep-act-dot" />
                <span className="lpd-hr-rep-act-text">{a.action}</span>
                <span className="lpd-hr-rep-act-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
