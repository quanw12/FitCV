import {
  useCallback,
  useEffect,
  useState,
} from "react"

import {
  ArrowRight,
  BriefcaseBusiness,
  ChartColumn,
  FileCheck2,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Upload,
} from "lucide-react"

import BezelCard from "@/ui/components/BezelCard"
import RevealStagger from "@/ui/components/RevealStagger"

import type { ScreenId } from "@/types/app"
import type { ReportJobRow, ReportSummary } from "@/types/reports"

import { reportsApi } from "@/api/reportsApi"
import {
  getCachedResource,
  getOrFetchResource,
} from "@/services/resourceCache"

interface HRDashboardProps {
  onNavigate: (screen: ScreenId) => void
}

const pad = (n: number) => String(n).padStart(2, "0")
const dateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const trailing30Days = () => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from: dateInput(from), to: dateInput(to) }
}

const hrDashboardCacheKey = (range: { from: string; to: string }) =>
  `hr-dashboard:summary:${range.from}:${range.to}`

const scoreColor = (score: number | null) =>
  score == null
    ? "var(--text-muted)"
    : score >= 70
      ? "#16A34A"
      : score >= 60
        ? "#2563EB"
        : "#D97706"

const deltaText = (current: number | null, prev: number | null, suffix: string) => {
  if (current == null) return "—"
  if (prev == null) return "n/a"
  const diff = current - prev
  const sign = diff > 0 ? "+" : ""
  return `${sign}${Math.round(diff * 10) / 10}${suffix} vs prev. period`
}

const scoreDisplay = (score: number | null) =>
  score == null ? "—" : `${Math.round(score)}%`

export default function HRDashboard({ onNavigate }: HRDashboardProps) {
  const defaultRange = trailing30Days()
  const cachedSummary = getCachedResource<ReportSummary>(
    hrDashboardCacheKey(defaultRange),
  )
  const [summary, setSummary] = useState<ReportSummary | null>(
    cachedSummary ?? null,
  )
  const [loadError, setLoadError] = useState("")

  const load = useCallback(async (force = false) => {
    const range = trailing30Days()
    const key = hrDashboardCacheKey(range)

    setLoadError("")
    try {
      setSummary(
        await getOrFetchResource(key, () => reportsApi.summary(range), {
          force,
        }),
      )
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Could not load the dashboard.",
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = summary?.kpis ?? null
  const empty = summary != null && summary.jobs.length === 0 && kpis?.total_cvs_reviewed === 0

  const statCards = [
    {
      label: "Active Job Posts",
      value: kpis ? String(kpis.active_job_posts) : "…",
      delta: kpis
        ? deltaText(kpis.active_job_posts, kpis.prev?.active_job_posts ?? null, " job")
        : "…",
      icon: <BriefcaseBusiness size={19} aria-hidden="true" />,
      color: "#2563EB",
      soft: "var(--accent-soft)",
    },
    {
      label: "Total CVs Reviewed",
      value: kpis ? String(kpis.total_cvs_reviewed) : "…",
      delta: kpis
        ? deltaText(kpis.total_cvs_reviewed, kpis.prev?.total_cvs_reviewed ?? null, " CVs")
        : "…",
      icon: <FileCheck2 size={19} aria-hidden="true" />,
      color: "#16A34A",
      soft: "var(--success-soft)",
    },
    {
      label: "Avg. Candidate Score",
      value: kpis ? scoreDisplay(kpis.avg_candidate_score) : "…",
      delta: kpis
        ? deltaText(kpis.avg_candidate_score, kpis.prev?.avg_candidate_score ?? null, "pts")
        : "…",
      icon: <Sparkles size={19} aria-hidden="true" />,
      color: "#D97706",
      soft: "var(--warning-soft)",
    },
    {
      label: "Review Progress",
      value: kpis ? (kpis.review_progress == null ? "—" : `${Math.round(kpis.review_progress)}%`) : "…",
      delta: kpis
        ? deltaText(kpis.review_progress, kpis.prev?.review_progress ?? null, "%")
        : "…",
      icon: <TrendingUp size={19} aria-hidden="true" />,
      color: "#64748B",
      soft: "var(--gray-soft)",
    },
  ]

  return (
    <div className="fc-stagger hr-dashboard">
      <RevealStagger>
        <div className="fc-page-head">
          <div>
            <h1>HR Dashboard</h1>
            <p>TechViet Solutions · Recruitment overview</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="fc-btn fc-btn--secondary"
              onClick={() => onNavigate("cv-ranking")}
            >
              <Upload size={15} /> Upload CVs
            </button>
            <button
              className="fc-btn fc-btn--primary"
              onClick={() => onNavigate("job-posts")}
            >
              <Plus size={15} /> Create Job Post
            </button>
          </div>
        </div>
      </RevealStagger>

      {loadError ? (
        <RevealStagger>
          <BezelCard>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "40px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "var(--danger-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TriangleAlert size={24} color="var(--danger)" aria-hidden="true" />
              </div>
              <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>
                Could not load the dashboard.
              </strong>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  maxWidth: 300,
                }}
              >
                {loadError}
              </span>
              <button className="fc-btn fc-btn--primary" onClick={() => void load(true)}>
                <RefreshCw size={15} aria-hidden="true" /> Retry
              </button>
            </div>
          </BezelCard>
        </RevealStagger>
      ) : (
        <>
          {/* Stat cards */}
          <div className="hr-dashboard__stats">
            {statCards.map((s, i) => (
              <RevealStagger key={s.label} delay={i * 0.08}>
                <BezelCard className="hr-dashboard__stat-card">
                  <div
                    className="fc-stat"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="hr-dashboard__stat-top">
                      <div
                        className="fc-stat__icon"
                        style={{ background: s.soft, color: s.color }}
                      >
                          {s.icon}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="fc-stat__value" style={{ fontSize: 28 }}>
                        {s.value}
                      </div>
                      <div className="fc-stat__label">{s.label}</div>
                      <div
                        className="fc-stat__delta"
                        style={{ color: s.color, marginTop: 6 }}
                      >
                        {s.delta}
                      </div>
                    </div>
                  </div>
                </BezelCard>
              </RevealStagger>
            ))}
          </div>

          {/* Active job posts table */}
          <RevealStagger>
            <div className="fc-card hr-dashboard__jobs-card">
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div className="fc-section-title">
                  <ChartColumn size={17} color="var(--accent)" aria-hidden="true" />
                  <h3>Active Job Posts</h3>
                </div>
                <button
                  onClick={() => onNavigate("job-posts")}
                  className="fc-chip"
                  style={{ cursor: "pointer", border: "none" }}
                >
                  View all <ArrowRight size={13} />
                </button>
              </div>

              {empty ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    padding: "44px 24px",
                    textAlign: "center",
                  }}
                >
                  <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
                    No recruitment data yet
                  </strong>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      maxWidth: 300,
                    }}
                  >
                    Create a job post and upload or receive CVs to see the
                    overview here.
                  </span>
                </div>
              ) : (
                <div className="hr-dashboard__table-wrap">
                  <table className="fc-table hr-dashboard__table">
                    <colgroup>
                      <col className="hr-dashboard__title-col" />
                      <col className="hr-dashboard__department-col" />
                      <col className="hr-dashboard__count-col" />
                      <col className="hr-dashboard__score-col" />
                      <col className="hr-dashboard__progress-col" />
                      <col className="hr-dashboard__action-col" />
                    </colgroup>
                  <thead>
                    <tr>
                      {[
                        "Job Title",
                        "Department",
                        "CVs",
                        "Avg. Score",
                        "Review Progress",
                        "Action",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.jobs ?? []).map((job: ReportJobRow) => (
                      <tr key={job.job_id}>
                        <td>
                          <div className="hr-dashboard__job-title">
                            {job.title}
                          </div>
                        </td>
                        <td>
                          <span className="fc-badge fc-badge--blue">
                            {job.department ?? "—"}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <span
                              style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                fontFamily: "var(--font-display)",
                              }}
                            >
                              {job.cv_count}
                            </span>
                            <span
                              style={{ fontSize: 12, color: "var(--text-muted)" }}
                            >
                              CVs
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              fontFamily: "var(--font-display)",
                              color: scoreColor(job.avg_score),
                            }}
                          >
                            {scoreDisplay(job.avg_score)}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 9 }}
                          >
                            <div className="fc-progress" style={{ flex: 1 }}>
                              <div
                                style={{
                                  width: `${job.review_progress ?? 0}%`,
                                  background:
                                    (job.review_progress ?? 0) >= 80
                                      ? "var(--success)"
                                      : "var(--accent)",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                width: 38,
                              }}
                            >
                              {job.review_progress == null
                                ? "—"
                                : `${Math.round(job.review_progress)}%`}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => onNavigate("cv-ranking")}
                            className="fc-chip"
                            style={{
                              cursor: "pointer",
                              border: "none",
                              color: "var(--accent-ink)",
                              background: "var(--accent-soft)",
                            }}
                          >
                            View CVs <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
            </div>
          </RevealStagger>
        </>
      )}
    </div>
  )
}
