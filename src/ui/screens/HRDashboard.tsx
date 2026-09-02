import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ArrowRight,
  BriefcaseBusiness,
  ChartColumn,
  FileCheck2,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Upload,
  Zap,
} from "lucide-react"

import KpiStatCard from "@/ui/components/KpiStatCard"
import RevealStagger from "@/ui/components/RevealStagger"

import type { ScreenId } from "@/types/app"
import type { ReportJobRow, ReportSummary } from "@/types/reports"

import type { ReportDateWindow } from "@/services/reportMetrics"

import { reportsApi } from "@/api/reportsApi"
import {
  avgScoreColor,
  comparePeriods,
  formatScore,
  formatWindowRange,
  pendingReviewCount,
  trailingDaysWindow,
} from "@/services/reportMetrics"
import { getMatchLabel } from "@/services/matchScore"
import { getCachedResource, getOrFetchResource } from "@/services/resourceCache"

interface HRDashboardProps {
  onNavigate: (screen: ScreenId) => void
}

const hrDashboardCacheKey = (range: ReportDateWindow) =>
  `hr-dashboard:summary:${range.from}:${range.to}`

const statusTone = (status: string) =>
  status === "Published"
    ? "var(--success)"
    : status === "Closed"
      ? "var(--text-muted)"
      : "var(--warning)"

const progressTone = (progress: number | null) => {
  if (progress == null) return "var(--border-strong)"
  if (progress >= 80) return "var(--success)"
  if (progress >= 50) return "var(--accent)"
  return "var(--warning)"
}

/** Jobs with the most unreviewed CVs surface first; idle jobs sink. */
const byReviewUrgency = (a: ReportJobRow, b: ReportJobRow) => {
  const pendingA = pendingReviewCount(a.cv_count, a.review_progress)
  const pendingB = pendingReviewCount(b.cv_count, b.review_progress)
  if (pendingA !== pendingB) return pendingB - pendingA
  if (a.cv_count !== b.cv_count) return b.cv_count - a.cv_count
  return a.title.localeCompare(b.title)
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function HRDashboard({ onNavigate }: HRDashboardProps) {
  const defaultRange = trailingDaysWindow(30)
  const cachedSummary = getCachedResource<ReportSummary>(
    hrDashboardCacheKey(defaultRange),
  )
  const [summary, setSummary] = useState<ReportSummary | null>(
    cachedSummary ?? null,
  )
  const [loadError, setLoadError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const load = useCallback(async (force = false) => {
    const range = trailingDaysWindow(30)
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
        cause instanceof Error
          ? cause.message
          : "Could not load the dashboard.",
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = summary?.kpis ?? null
  const loading = summary == null
  const empty =
    summary != null &&
    summary.jobs.length === 0 &&
    kpis?.total_cvs_reviewed === 0

  const windowRange = summary?.window ?? null
  const subtitle = windowRange
    ? `Last 30 days · ${formatWindowRange(windowRange)}`
    : "Last 30 days"

  const departments = useMemo(() => {
    const set = new Set<string>()
    summary?.jobs.forEach((job) => {
      if (job.department) set.add(job.department)
    })
    return Array.from(set)
  }, [summary])

  const sortedJobs = useMemo(() => {
    let list = [...(summary?.jobs ?? [])].sort(byReviewUrgency)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          job.department?.toLowerCase().includes(q),
      )
    }
    if (departmentFilter !== "all") {
      list = list.filter((job) => job.department === departmentFilter)
    }
    return list
  }, [summary, searchQuery, departmentFilter])

  const pendingReviewTotal = useMemo(() => {
    return (summary?.jobs ?? []).reduce(
      (acc, job) => acc + pendingReviewCount(job.cv_count, job.review_progress),
      0,
    )
  }, [summary])

  const statCards = [
    {
      label: "Active Job Posts",
      value: kpis ? String(kpis.active_job_posts) : "…",
      delta: comparePeriods(
        kpis?.active_job_posts ?? null,
        kpis?.prev?.active_job_posts ?? null,
        { suffix: " job" },
      ),
      icon: <BriefcaseBusiness size={19} aria-hidden="true" />,
      color: "var(--accent)",
    },
    {
      label: "Total CVs Reviewed",
      value: kpis ? String(kpis.total_cvs_reviewed) : "…",
      delta: comparePeriods(
        kpis?.total_cvs_reviewed ?? null,
        kpis?.prev?.total_cvs_reviewed ?? null,
        { suffix: " CVs" },
      ),
      icon: <FileCheck2 size={19} aria-hidden="true" />,
      color: "var(--success)",
    },
    {
      label: "Avg. Candidate Score",
      value: kpis ? formatScore(kpis.avg_candidate_score) : "…",
      delta: comparePeriods(
        kpis?.avg_candidate_score ?? null,
        kpis?.prev?.avg_candidate_score ?? null,
        { suffix: " pts" },
      ),
      icon: <Sparkles size={19} aria-hidden="true" />,
      color: "var(--warning)",
    },
    {
      label: "Review Progress",
      value: kpis
        ? kpis.review_progress == null
          ? "—"
          : `${Math.round(kpis.review_progress)}%`
        : "…",
      delta: comparePeriods(
        kpis?.review_progress ?? null,
        kpis?.prev?.review_progress ?? null,
        { suffix: "%" },
      ),
      icon: <TrendingUp size={19} aria-hidden="true" />,
      color: "var(--text-secondary)",
    },
  ]

  const greeting = getTimeOfDayGreeting()

  return (
    <div className="fc-stagger hr-dashboard">
      {/* Inspiring Hero Banner */}
      <RevealStagger>
        <div className="hr-hero-banner">
          <div className="hr-hero-banner__content">
            <div className="hr-hero-banner__greeting">
              <Sparkles size={14} />
              Talent Intelligence Console
            </div>
            <h1>{greeting} · Ready to discover top talent?</h1>
            <p>
              AI-assisted screening is active across your recruitment cycles.{" "}
              {pendingReviewTotal > 0
                ? `You have ${pendingReviewTotal} candidate CVs awaiting review.`
                : "All candidate CV reviews are currently up to date."}
            </p>
          </div>
        </div>
      </RevealStagger>

      {/* Quick Action Hub */}
      <RevealStagger>
        <div className="hr-quick-actions">
          <button
            type="button"
            className="hr-quick-card"
            onClick={() => onNavigate("cv-ranking")}
          >
            <div
              className="hr-quick-card__icon"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              <Upload size={22} />
            </div>
            <div className="hr-quick-card__info">
              <span className="hr-quick-card__title">Upload &amp; Rank CVs</span>
              <span className="hr-quick-card__desc">
                Score up to 20 external CVs against a JD in seconds
              </span>
            </div>
            <ArrowRight size={16} className="hr-quick-card__arrow" />
          </button>

          <button
            type="button"
            className="hr-quick-card"
            onClick={() => onNavigate("job-posts")}
          >
            <div
              className="hr-quick-card__icon"
              style={{
                background: "var(--success-soft)",
                color: "var(--success)",
              }}
            >
              <Plus size={22} />
            </div>
            <div className="hr-quick-card__info">
              <span className="hr-quick-card__title">Create AI Job Post</span>
              <span className="hr-quick-card__desc">
                Paste raw JD or select 1-click popular role templates
              </span>
            </div>
            <ArrowRight size={16} className="hr-quick-card__arrow" />
          </button>

          <button
            type="button"
            className="hr-quick-card"
            onClick={() => onNavigate("pipeline")}
          >
            <div
              className="hr-quick-card__icon"
              style={{
                background: "var(--warning-soft)",
                color: "#92400e",
              }}
            >
              <Layers size={22} />
            </div>
            <div className="hr-quick-card__info">
              <span className="hr-quick-card__title">Candidate Pipeline</span>
              <span className="hr-quick-card__desc">
                Drag-and-drop candidates across screening to offer
              </span>
            </div>
            <ArrowRight size={16} className="hr-quick-card__arrow" />
          </button>
        </div>
      </RevealStagger>

      {empty && !loadError ? (
        <RevealStagger>
          <div className="fc-card hr-getting-started">
            <div className="hr-getting-started__head">
              <span className="hr-getting-started__badge">Start here</span>
              <div>
                <h2>Your hiring workspace is ready</h2>
                <p>
                  Follow these steps to post a role, review candidates, and run
                  your first hiring cycle.
                </p>
              </div>
            </div>
            <ol className="hr-getting-started__steps">
              <li>
                <span className="hr-getting-started__num">1</span>
                <div>
                  <strong>Create a job post</strong>
                  <span>Publish the role you are hiring for.</span>
                </div>
                <button
                  className="fc-btn fc-btn--primary hr-getting-started__cta"
                  onClick={() => onNavigate("job-posts")}
                >
                  <Plus size={15} /> Create Job Post
                </button>
              </li>
              <li>
                <span className="hr-getting-started__num">2</span>
                <div>
                  <strong>Review candidates</strong>
                  <span>
                    Upload externally-sourced CVs or score applicants to your
                    posts.
                  </span>
                </div>
                <button
                  className="fc-btn fc-btn--secondary hr-getting-started__cta"
                  onClick={() => onNavigate("cv-ranking")}
                >
                  <Upload size={15} /> Go to CV Ranking
                </button>
              </li>
              <li>
                <span className="hr-getting-started__num">3</span>
                <div>
                  <strong>Move matches to Pipeline</strong>
                  <span>Track shortlisted candidates through hiring stages.</span>
                </div>
                <button
                  className="fc-btn fc-btn--secondary hr-getting-started__cta"
                  onClick={() => onNavigate("pipeline")}
                >
                  Open Pipeline
                </button>
              </li>
              <li>
                <span className="hr-getting-started__num">4</span>
                <div>
                  <strong>Email shortlisted candidates</strong>
                  <span>Send stage-aware messages from one place.</span>
                </div>
                <button
                  className="fc-btn fc-btn--secondary hr-getting-started__cta"
                  onClick={() => onNavigate("auto-email")}
                >
                  Open Auto Email
                </button>
              </li>
            </ol>
          </div>
        </RevealStagger>
      ) : null}

      {loadError ? (
        <RevealStagger>
          <div className="fc-card hr-dashboard__jobs-card">
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
                <TriangleAlert
                  size={24}
                  color="var(--danger)"
                  aria-hidden="true"
                />
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
              <button
                className="fc-btn fc-btn--primary"
                onClick={() => void load(true)}
              >
                <RefreshCw size={15} aria-hidden="true" /> Retry
              </button>
            </div>
          </div>
        </RevealStagger>
      ) : (
        <>
          {/* Stat cards */}
          <div className="hr-dashboard__stats">
            {statCards.map((s, i) => (
              <RevealStagger key={s.label} delay={i * 0.08}>
                <KpiStatCard
                  label={s.label}
                  value={s.value}
                  icon={s.icon}
                  iconColor={s.color}
                  delta={kpis ? s.delta : undefined}
                  loading={loading}
                />
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
                  <ChartColumn
                    size={17}
                    color="var(--accent)"
                    aria-hidden="true"
                  />
                  <h3>Job Posts by Review Load</h3>
                </div>

                {/* Search & Department Filters */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div className="fc-search" style={{ maxWidth: 220, padding: "6px 12px" }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: 13,
                        width: "100%",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  {departments.length > 0 && (
                    <select
                      className="fc-input"
                      style={{ padding: "6px 10px", fontSize: 13, width: "auto" }}
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {departments.map((dep) => (
                        <option key={dep} value={dep}>
                          {dep}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => onNavigate("job-posts")}
                    className="fc-chip"
                    style={{ cursor: "pointer", border: "none" }}
                  >
                    View all <ArrowRight size={13} />
                  </button>
                </div>
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
                  <strong
                    style={{ fontSize: 15, color: "var(--text-primary)" }}
                  >
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
              ) : loading ? (
                <div className="hr-dashboard__table-skeleton">
                  {[0, 1, 2, 3].map((row) => (
                    <div
                      key={row}
                      className="fc-skeleton"
                      style={{ height: 38, borderRadius: 10 }}
                    />
                  ))}
                </div>
              ) : sortedJobs.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No job posts matched your search filters.
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
                      {sortedJobs.map((job: ReportJobRow) => {
                        const pending = pendingReviewCount(
                          job.cv_count,
                          job.review_progress,
                        )

                        return (
                          <tr key={job.job_id}>
                            <td>
                              <div className="hr-dashboard__job-title">
                                {job.title}
                              </div>
                              <div className="hr-dashboard__job-sub">
                                <span
                                  className="hr-dashboard__status-dot"
                                  style={{ background: statusTone(job.status) }}
                                />
                                {job.status}
                              </div>
                            </td>
                            <td>
                              <span className="fc-badge fc-badge--blue">
                                {job.department ?? "—"}
                              </span>
                            </td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
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
                                  style={{
                                    fontSize: 12,
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  CVs
                                </span>
                              </div>
                              {pending > 0 ? (
                                <div className="hr-dashboard__job-sub hr-dashboard__pending">
                                  {pending} to review
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  fontFamily: "var(--font-display)",
                                  color: avgScoreColor(job.avg_score),
                                }}
                              >
                                {formatScore(job.avg_score)}
                              </span>
                              {job.avg_score != null ? (
                                <div className="hr-dashboard__job-sub">
                                  {getMatchLabel(job.avg_score)}
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 9,
                                }}
                              >
                                <div
                                  className="fc-progress"
                                  style={{ flex: 1 }}
                                >
                                  <div
                                    style={{
                                      width: `${job.review_progress ?? 0}%`,
                                      background: progressTone(
                                        job.review_progress,
                                      ),
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
                        )
                      })}
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
