import {
  useCallback,
  useEffect,
  useState,
} from "react"

import {
  ArrowRight,
  ArrowClockwise,
  Briefcase,
  ChartBar,
  FileText,
  Plus,
  Star,
  TrendUp,
  Upload,
  WarningCircle,
} from "@phosphor-icons/react"

import BezelCard from "@/ui/components/BezelCard"
import RevealStagger from "@/ui/components/RevealStagger"

import type { ScreenId } from "@/types/app"
import type { ReportJobRow, ReportSummary } from "@/types/reports"

import { reportsApi } from "@/api/reportsApi"

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

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values) || 1

  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 34 }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: `${(v / max) * 100}%`,
            borderRadius: 3,
            background: color,
            opacity: 0.45 + (i / values.length) * 0.55,
          }}
        />
      ))}
    </div>
  )
}

const scoreColor = (score: number | null) =>
  score == null
    ? "var(--text-muted)"
    : score >= 70
      ? "#16A34A"
      : score >= 60
        ? "#2563EB"
        : "#D97706"

const statusBadge = (status: string) => {
  if (status === "Published") return "fc-badge--green"
  if (status === "Closed") return "fc-badge--gray"
  return "fc-badge--amber"
}

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
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      setSummary(await reportsApi.summary(trailing30Days()))
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Could not load the dashboard.",
      )
    } finally {
      setLoading(false)
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
      icon: <Briefcase size={18} />,
      color: "#2563EB",
      soft: "var(--accent-soft)",
      spark: [2, 3, 3, 4],
    },
    {
      label: "Total CVs Reviewed",
      value: kpis ? String(kpis.total_cvs_reviewed) : "…",
      delta: kpis
        ? deltaText(kpis.total_cvs_reviewed, kpis.prev?.total_cvs_reviewed ?? null, " CVs")
        : "…",
      icon: <FileText size={18} />,
      color: "#16A34A",
      soft: "var(--success-soft)",
      spark: [60, 78, 91, 119],
    },
    {
      label: "Avg. Candidate Score",
      value: kpis ? scoreDisplay(kpis.avg_candidate_score) : "…",
      delta: kpis
        ? deltaText(kpis.avg_candidate_score, kpis.prev?.avg_candidate_score ?? null, "pts")
        : "…",
      icon: <Star size={18} />,
      color: "#D97706",
      soft: "var(--warning-soft)",
      spark: [60, 62, 65, 68],
    },
    {
      label: "Review Progress",
      value: kpis ? (kpis.review_progress == null ? "—" : `${Math.round(kpis.review_progress)}%`) : "…",
      delta: kpis
        ? deltaText(kpis.review_progress, kpis.prev?.review_progress ?? null, "%")
        : "…",
      icon: <TrendUp size={18} />,
      color: "#64748B",
      soft: "var(--gray-soft)",
      spark: [30, 42, 51, 58],
    },
  ]

  return (
    <div className="fc-stagger">
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
                <WarningCircle size={24} weight="light" color="var(--danger)" />
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
              <button className="fc-btn fc-btn--primary" onClick={() => void load()}>
                <ArrowClockwise size={15} /> Retry
              </button>
            </div>
          </BezelCard>
        </RevealStagger>
      ) : (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {statCards.map((s, i) => (
              <RevealStagger key={s.label} delay={i * 0.08}>
                <BezelCard>
                  <div
                    className="fc-stat"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        className="fc-stat__icon"
                        style={{ background: s.soft, color: s.color }}
                      >
                        {s.icon}
                      </div>
                      <MiniBars values={s.spark} color={s.color} />
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
            <div className="fc-card" style={{ overflow: "hidden" }}>
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
                  <ChartBar size={17} color="var(--accent)" />
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
                <table className="fc-table">
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
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: "var(--text-primary)",
                            }}
                          >
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
                        <td style={{ minWidth: 170 }}>
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
              )}
            </div>
          </RevealStagger>
        </>
      )}
    </div>
  )
}
