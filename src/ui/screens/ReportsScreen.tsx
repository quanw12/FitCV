import { useCallback, useEffect, useMemo, useState } from "react"

import {
  CalendarDays,
  ChartBar,
  ChartColumnBig,
  ChartPie as PieIcon,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  FileCheck2,
  RefreshCw,
  Table,
  TrendingUp,
} from "lucide-react"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import KpiStatCard from "@/ui/components/KpiStatCard"
import RevealStagger from "@/ui/components/RevealStagger"

import type { ReportJobRow, ReportSummary } from "@/types/reports"

import type { ReportDateWindow } from "@/services/reportMetrics"

import { reportsApi } from "@/api/reportsApi"
import {
  avgScoreColor,
  comparePeriods,
  formatDays,
  formatScore,
  monthWindow,
  pendingReviewCount,
  scoreBucketColor,
} from "@/services/reportMetrics"
import { getMatchLabel } from "@/services/matchScore"
import { getCachedResource, getOrFetchResource } from "@/services/resourceCache"

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 13,
  color: "var(--text-primary)",
  boxShadow: "var(--shadow-md)",
}

const reportsCacheKey = (range: ReportDateWindow) =>
  `hr-reports:summary:${range.from}:${range.to}`

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

const byCvVolume = (a: ReportJobRow, b: ReportJobRow) => {
  if (a.cv_count !== b.cv_count) return b.cv_count - a.cv_count
  return a.title.localeCompare(b.title)
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="reports-chart-empty" role="status">
      {message}
    </div>
  )
}

export default function ReportsScreen() {
  const now = new Date()
  const currentMonth = { year: now.getFullYear(), month: now.getMonth() }
  const minMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [month, setMonth] = useState(currentMonth)
  const windowRange = useMemo(
    () => monthWindow(month.year, month.month),
    [month],
  )

  const cachedSummary = getCachedResource<ReportSummary>(
    reportsCacheKey(windowRange),
  )
  const [summary, setSummary] = useState<ReportSummary | null>(
    cachedSummary ?? null,
  )
  const [loadError, setLoadError] = useState("")

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  )

  const monthIndex = month.year * 12 + month.month
  const currentIndex = currentMonth.year * 12 + currentMonth.month
  const minIndex = minMonth.getFullYear() * 12 + minMonth.getMonth()
  const canGoBack = monthIndex > minIndex
  const canGoForward = monthIndex < currentIndex

  const load = useCallback(
    async (force = false) => {
      const key = reportsCacheKey(windowRange)
      const cached = getCachedResource<ReportSummary>(key)

      if (cached && !force) {
        setSummary(cached)

        return
      }

      // Drop the previous month's numbers so they never render under the
      // newly selected month label while the fetch is in flight.
      setSummary(null)
      setLoadError("")
      try {
        setSummary(
          await getOrFetchResource(key, () => reportsApi.summary(windowRange), {
            force,
          }),
        )
      } catch (cause) {
        setLoadError(
          cause instanceof Error ? cause.message : "Could not load reports.",
        )
      }
    },
    [windowRange.from, windowRange.to],
  )

  useEffect(() => {
    void load()
  }, [load])

  const moveMonth = (direction: -1 | 1) => {
    setMonth((current) => {
      const index = current.year * 12 + current.month + direction
      const year = Math.floor(index / 12)
      const monthIdx = index % 12
      return { year, month: monthIdx < 0 ? 11 : monthIdx }
    })
  }

  const exportCsv = () => {
    if (!summary) return
    const kpi = summary.kpis
    const passTotal =
      summary.charts.screening_pass_rate.passed_count +
      summary.charts.screening_pass_rate.not_passed_count
    const passRate =
      passTotal > 0
        ? Math.round(
            (summary.charts.screening_pass_rate.passed_count * 100) / passTotal,
          )
        : null
    const kpiLines = [
      `Window,${summary.window.from} to ${summary.window.to}`,
      `Active Job Posts,${kpi.active_job_posts}`,
      `Total CVs Reviewed,${kpi.total_cvs_reviewed}`,
      `Avg Candidate Score,${kpi.avg_candidate_score ?? ""}`,
      `Review Progress %,${kpi.review_progress ?? ""}`,
      `Time to Shortlist (days),${kpi.time_to_shortlist_days ?? ""}`,
      `Time to Hire (days),${kpi.time_to_hire_days ?? ""}`,
      `Offer Acceptance Rate %,${kpi.offer_acceptance_rate ?? ""}`,
      `Screening Pass Rate %,${passRate ?? ""}`,
    ]
    const header = [
      "job_id",
      "title",
      "department",
      "cv_count",
      "avg_score",
      "review_progress",
      "status",
    ]
    const rows = summary.jobs.map((job) =>
      [
        job.job_id,
        `"${job.title.replace(/"/g, '""')}"`,
        job.department ?? "",
        job.cv_count,
        job.avg_score ?? "",
        job.review_progress ?? "",
        job.status,
      ].join(","),
    )
    const csv = [...kpiLines, "", header.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `fitcv-reports-${summary.window.from}-to-${summary.window.to}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const kpis = summary?.kpis ?? null
  const loading = summary == null
  const empty =
    summary != null &&
    summary.jobs.length === 0 &&
    kpis?.total_cvs_reviewed === 0

  const subtitle = summary?.window.label
    ? `Recruitment performance · ${summary.window.label}`
    : `Recruitment performance · ${monthLabel}`

  const passTotal = summary
    ? summary.charts.screening_pass_rate.passed_count +
      summary.charts.screening_pass_rate.not_passed_count
    : 0
  const passPercent =
    summary && passTotal > 0
      ? Math.round(
          (summary.charts.screening_pass_rate.passed_count * 100) / passTotal,
        )
      : null

  const passSlices = summary
    ? [
        {
          name: "Passed Screening",
          value: summary.charts.screening_pass_rate.passed_count,
        },
        {
          name: "Not Passed",
          value: summary.charts.screening_pass_rate.not_passed_count,
        },
      ]
    : []

  const applicationsTotal = summary
    ? summary.charts.applications_over_time.reduce(
        (sum, bucket) => sum + bucket.count,
        0,
      )
    : 0
  const scoreTotal = summary
    ? summary.charts.score_distribution.reduce(
        (sum, bucket) => sum + bucket.count,
        0,
      )
    : 0

  const sortedJobs = useMemo(
    () => [...(summary?.jobs ?? [])].sort(byCvVolume),
    [summary],
  )

  const kpiCards = [
    {
      label: "Avg. Time-to-Shortlist",
      value: kpis ? formatDays(kpis.time_to_shortlist_days) : "…",
      delta: comparePeriods(
        kpis?.time_to_shortlist_days ?? null,
        kpis?.prev?.time_to_shortlist_days ?? null,
        { suffix: " days", lowerIsBetter: true },
      ),
      icon: <Clock size={19} aria-hidden="true" />,
      color: "var(--accent)",
    },
    {
      label: "Avg. Time-to-Hire",
      value: kpis ? formatDays(kpis.time_to_hire_days) : "…",
      delta: comparePeriods(
        kpis?.time_to_hire_days ?? null,
        kpis?.prev?.time_to_hire_days ?? null,
        { suffix: " days", lowerIsBetter: true },
      ),
      icon: <CalendarDays size={19} aria-hidden="true" />,
      color: "var(--text-secondary)",
    },
    {
      label: "Offer Acceptance Rate",
      value:
        kpis?.offer_acceptance_rate == null
          ? "—"
          : `${Math.round(kpis.offer_acceptance_rate)}%`,
      delta: comparePeriods(
        kpis?.offer_acceptance_rate ?? null,
        kpis?.prev?.offer_acceptance_rate ?? null,
        { suffix: "%" },
      ),
      icon: <TrendingUp size={19} aria-hidden="true" />,
      color: "var(--success)",
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
      color: "#2563EB",
    },
  ]

  return (
    <div className="fc-stagger reports-page">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            HR · Performance
          </div>
          <h1>Reports &amp; Analytics</h1>
          <p>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              className="fc-btn fc-btn--secondary reports-month-nav"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="fc-chip reports-month-chip">
              <CalendarDays size={14} aria-hidden="true" /> {monthLabel}
            </span>
            <button
              className="fc-btn fc-btn--secondary reports-month-nav"
              aria-label="Next month"
              disabled={!canGoForward}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <button
            className="fc-btn fc-btn--primary"
            onClick={exportCsv}
            disabled={loading || empty}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="fc-card reports-panel">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "48px 24px",
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
              <CircleAlert size={24} color="var(--danger)" aria-hidden="true" />
            </div>
            <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>
              Could not load reports.
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
      ) : empty ? (
        <div className="fc-card reports-panel">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChartBar size={24} color="var(--accent)" aria-hidden="true" />
            </div>
            <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>
              No reports yet
            </strong>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                maxWidth: 280,
              }}
            >
              Reports are generated as candidates move through your hiring
              pipeline. Start by creating a job post and reviewing candidates.
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="reports-kpi-grid">
            {kpiCards.map((k, i) => (
              <RevealStagger key={k.label} delay={i * 0.06}>
                <KpiStatCard
                  label={k.label}
                  value={k.value}
                  icon={k.icon}
                  iconColor={k.color}
                  delta={kpis ? k.delta : undefined}
                  loading={loading}
                />
              </RevealStagger>
            ))}
          </div>

          {/* Charts */}
          <div className="fc-stagger reports-chart-grid">
            {/* Line — applications over time */}
            <div className="fc-card fc-card--pad reports-chart-card">
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <TrendingUp
                  size={17}
                  color="var(--accent)"
                  aria-hidden="true"
                />
                <h3>Applications Over Time</h3>
                <span>{monthLabel}</span>
              </div>
              {loading ? (
                <div
                  className="fc-skeleton"
                  style={{ height: 200, borderRadius: 12 }}
                />
              ) : applicationsTotal === 0 ? (
                <ChartEmptyState message="No applications received in this month." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={summary?.charts.applications_over_time ?? []}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ stroke: "var(--border)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Applications"
                      stroke="var(--accent)"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "var(--accent)",
                        stroke: "var(--surface)",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Donut — pass rate */}
            <div className="fc-card fc-card--pad reports-chart-card">
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <PieIcon size={17} color="var(--accent)" aria-hidden="true" />
                <h3>Screening Pass Rate</h3>
              </div>
              <div className="reports-donut">
                {loading ? (
                  <div
                    className="fc-skeleton"
                    style={{ height: 160, borderRadius: 12, flex: 1 }}
                  />
                ) : passTotal === 0 ? (
                  <ChartEmptyState message="No screening decisions recorded yet." />
                ) : (
                  <>
                    <div className="reports-donut__ring">
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={passSlices}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={72}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            stroke="var(--surface)"
                            strokeWidth={2}
                          >
                            <Cell fill="var(--success)" />
                            <Cell
                              fill="var(--gray-soft)"
                              stroke="var(--border)"
                            />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="reports-donut__center">
                        <span className="reports-donut__percent">
                          {passPercent == null ? "—" : `${passPercent}%`}
                        </span>
                        <span className="reports-donut__caption">
                          Pass Rate
                        </span>
                      </div>
                    </div>
                    <div className="reports-donut__legend">
                      <div className="reports-donut__legend-row">
                        <span className="reports-donut__dot reports-donut__dot--passed" />
                        <span className="reports-donut__legend-label">
                          Passed —{" "}
                          <strong>
                            {summary?.charts.screening_pass_rate.passed_count ??
                              0}
                          </strong>
                        </span>
                      </div>
                      <div className="reports-donut__legend-row">
                        <span className="reports-donut__dot reports-donut__dot--failed" />
                        <span className="reports-donut__legend-label">
                          Not Passed —{" "}
                          <strong>
                            {summary?.charts.screening_pass_rate
                              .not_passed_count ?? 0}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bar — score distribution */}
            <div className="fc-card fc-card--pad reports-chart-card">
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <ChartColumnBig
                  size={17}
                  color="var(--accent)"
                  aria-hidden="true"
                />
                <h3>Score Distribution</h3>
              </div>
              {loading ? (
                <div
                  className="fc-skeleton"
                  style={{ height: 200, borderRadius: 12 }}
                />
              ) : scoreTotal === 0 ? (
                <ChartEmptyState message="No match scores recorded yet." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary?.charts.score_distribution ?? []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--accent-soft)" }}
                    />
                    <Bar
                      dataKey="count"
                      name="Candidates"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                    >
                      {(summary?.charts.score_distribution ?? []).map(
                        (entry, i) => (
                          <Cell key={i} fill={scoreBucketColor(entry.range)} />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Per-job performance — the same rows the CSV export writes. */}
          <RevealStagger>
            <div className="fc-card reports-jobs-card">
              <div className="reports-jobs-card__head">
                <div className="fc-section-title">
                  <Table size={17} color="var(--accent)" aria-hidden="true" />
                  <h3>Job Performance</h3>
                  <span>{monthLabel}</span>
                </div>
              </div>
              {loading ? (
                <div className="reports-jobs-card__skeleton">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="fc-skeleton"
                      style={{ height: 38, borderRadius: 10 }}
                    />
                  ))}
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
                          "Status",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedJobs.map((job) => {
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
                              {pending > 0 ? (
                                <div className="hr-dashboard__job-sub hr-dashboard__pending">
                                  {pending} to review
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <span className="fc-badge fc-badge--blue">
                                {job.department ?? "—"}
                              </span>
                            </td>
                            <td>
                              <span className="reports-jobs-card__count">
                                {job.cv_count}
                              </span>
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
                              <span className="hr-dashboard__job-sub">
                                <span
                                  className="hr-dashboard__status-dot"
                                  style={{ background: statusTone(job.status) }}
                                />
                                {job.status}
                              </span>
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
