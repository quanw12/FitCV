import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ArrowClockwise,
  Calendar,
  ChartBar,
  ChartPie as PieIcon,
  Download,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react"

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

import BezelCard from "@/ui/components/BezelCard"

import type { ReportSummary } from "@/types/reports"

import { reportsApi } from "@/api/reportsApi"

const pad = (n: number) => String(n).padStart(2, "0")
const dateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 13,
  color: "var(--text-primary)",
  boxShadow: "var(--shadow-md)",
}

const scoreFill = (range: string) => {
  if (range.startsWith("9") || range.startsWith("8")) return "var(--success)"
  if (range.startsWith("7") || range.startsWith("6")) return "var(--accent)"
  return "var(--danger)"
}

const deltaText = (
  current: number | null,
  prev: number | null,
  suffix: string,
) => {
  if (current == null) return "—"
  if (prev == null) return "n/a"
  const diff = current - prev
  const sign = diff > 0 ? "+" : ""
  return `${sign}${Math.round(diff * 10) / 10}${suffix} vs prev. month`
}

export default function ReportsScreen() {
  const now = new Date()
  const currentMonth = { year: now.getFullYear(), month: now.getMonth() }
  const minMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [month, setMonth] = useState(currentMonth)
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loadError, setLoadError] = useState("")

  const windowRange = useMemo(() => {
    const first = new Date(month.year, month.month, 1)
    const last = new Date(month.year, month.month + 1, 0)
    return { from: dateInput(first), to: dateInput(last) }
  }, [month])

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  )

  const monthIndex = month.year * 12 + month.month
  const currentIndex = currentMonth.year * 12 + currentMonth.month
  const minIndex = minMonth.getFullYear() * 12 + minMonth.getMonth()
  const canGoBack = monthIndex > minIndex
  const canGoForward = monthIndex < currentIndex

  const load = useCallback(async () => {
    setLoadError("")
    try {
      setSummary(await reportsApi.summary(windowRange))
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Could not load reports.",
      )
    }
  }, [windowRange.from, windowRange.to])

  useEffect(() => {
    void load()
  }, [load])

  const moveMonth = (direction: -1 | 1) => {
    setMonth((current) => {
      const index = current.year * 12 + current.month + direction
      const year = Math.floor(index / 12)
      const monthIndex = index % 12
      return { year, month: monthIndex < 0 ? 11 : monthIndex }
    })
  }

  const exportCsv = () => {
    if (!summary) return
    const kpi = summary.kpis
    const kpiLines = [
      `Active Job Posts,${kpi.active_job_posts}`,
      `Total CVs Reviewed,${kpi.total_cvs_reviewed}`,
      `Avg Candidate Score,${kpi.avg_candidate_score ?? ""}`,
      `Review Progress %,${kpi.review_progress ?? ""}`,
      `Time to Shortlist (days),${kpi.time_to_shortlist_days ?? ""}`,
      `Time to Hire (days),${kpi.time_to_hire_days ?? ""}`,
      `Offer Acceptance Rate %,${kpi.offer_acceptance_rate ?? ""}`,
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
    anchor.download = `fitcv-reports-${summary.window.from}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const kpis = summary?.kpis ?? null
  const empty =
    summary != null &&
    summary.jobs.length === 0 &&
    kpis?.total_cvs_reviewed === 0

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

  const kpiCards = [
    {
      label: "Avg. Time-to-Shortlist",
      value:
        kpis?.time_to_shortlist_days == null
          ? "—"
          : `${kpis.time_to_shortlist_days} days`,
      delta: kpis
        ? deltaText(
            kpis.time_to_shortlist_days,
            kpis.prev?.time_to_shortlist_days ?? null,
            " days",
          )
        : "…",
      icon: "⚡",
      color: "#4F46E5",
      bg: "#EEF2FF",
    },
    {
      label: "Avg. Time-to-Hire",
      value:
        kpis?.time_to_hire_days == null
          ? "—"
          : `${kpis.time_to_hire_days} days`,
      delta: kpis
        ? deltaText(kpis.time_to_hire_days, kpis.prev?.time_to_hire_days ?? null, " days")
        : "…",
      icon: "📅",
      color: "#10B981",
      bg: "#D1FAE5",
    },
    {
      label: "Offer Acceptance Rate",
      value:
        kpis?.offer_acceptance_rate == null
          ? "—"
          : `${Math.round(kpis.offer_acceptance_rate)}%`,
      delta: kpis
        ? deltaText(
            kpis.offer_acceptance_rate,
            kpis.prev?.offer_acceptance_rate ?? null,
            "%",
          )
        : "…",
      icon: "🤝",
      color: "#F59E0B",
      bg: "#FEF3C7",
    },
    {
      label: "Active Job Posts",
      value: kpis ? String(kpis.active_job_posts) : "…",
      delta: kpis
        ? deltaText(kpis.active_job_posts, kpis.prev?.active_job_posts ?? null, " job")
        : "…",
      icon: "📋",
      color: "#6B7280",
      bg: "#F3F4F6",
    },
    {
      label: "Total CVs Reviewed",
      value: kpis ? String(kpis.total_cvs_reviewed) : "…",
      delta: kpis
        ? deltaText(kpis.total_cvs_reviewed, kpis.prev?.total_cvs_reviewed ?? null, " CVs")
        : "…",
      icon: "📄",
      color: "#16A34A",
      bg: "#DCFCE7",
    },
  ]

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            HR · Performance
          </div>
          <h1>Reports &amp; Analytics</h1>
          <p>Recruitment performance overview for TechViet Solutions.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              className="fc-btn fc-btn--secondary"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => moveMonth(-1)}
              style={canGoBack ? undefined : { opacity: 0.4, cursor: "not-allowed" }}
            >
              ‹
            </button>
            <button
              className="fc-btn fc-btn--secondary"
              style={{ cursor: "default" }}
            >
              <Calendar size={15} /> {monthLabel}
            </button>
            <button
              className="fc-btn fc-btn--secondary"
              aria-label="Next month"
              disabled={!canGoForward}
              onClick={() => moveMonth(1)}
              style={canGoForward ? undefined : { opacity: 0.4, cursor: "not-allowed" }}
            >
              ›
            </button>
          </div>
          <button className="fc-btn fc-btn--primary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {loadError ? (
        <BezelCard>
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
              <WarningCircle size={24} weight="light" color="var(--danger)" />
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
            <button className="fc-btn fc-btn--primary" onClick={() => void load()}>
              <ArrowClockwise size={15} /> Retry
            </button>
          </div>
        </BezelCard>
      ) : empty ? (
        <BezelCard>
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
              <ChartBar size={24} weight="light" color="var(--accent)" />
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
        </BezelCard>
      ) : (
        <>
          {/* KPI strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 16,
              marginBottom: 20,
            }}
          >
            {kpiCards.map((k) => (
              <div key={k.label} className="fc-stat">
                <div
                  className="fc-stat__icon"
                  style={{ background: k.bg, color: k.color, fontSize: 18 }}
                >
                  {k.icon}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="fc-stat__value">{k.value}</div>
                  <div className="fc-stat__label">{k.label}</div>
                  <div
                    className="fc-stat__delta"
                    style={{ color: k.color, marginTop: 8 }}
                  >
                    {k.delta}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 2x2 chart grid */}
          <div
            className="fc-stagger"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {/* Line — applications over time */}
            <div className="fc-card fc-card--pad">
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <TrendUp size={17} color="var(--accent)" />
                <h3>Applications Over Time</h3>
                <span>{monthLabel}</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={summary?.charts.applications_over_time ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
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
            </div>

            {/* Donut — pass rate */}
            <div
              className="fc-card fc-card--pad"
              style={{ display: "flex", flexDirection: "column" }}
            >
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <PieIcon size={17} color="var(--accent)" />
                <h3>Screening Pass Rate</h3>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                }}
              >
                <div style={{ position: "relative" }}>
                  <PieChart width={160} height={160}>
                    <Pie
                      data={[
                        {
                          name: "Passed Screening",
                          value:
                            summary?.charts.screening_pass_rate.passed_count ?? 0,
                          color: "#10B981",
                        },
                        {
                          name: "Not Passed",
                          value:
                            summary?.charts.screening_pass_rate.not_passed_count ??
                            0,
                          color: "#F3F4F6",
                        },
                      ]}
                      cx={75}
                      cy={75}
                      innerRadius={48}
                      outerRadius={68}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    >
                      {[
                        {
                          name: "Passed Screening",
                          value:
                            summary?.charts.screening_pass_rate.passed_count ?? 0,
                          color: "#10B981",
                        },
                        {
                          name: "Not Passed",
                          value:
                            summary?.charts.screening_pass_rate.not_passed_count ??
                            0,
                          color: "#F3F4F6",
                        },
                      ].map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: "var(--success)",
                        fontFamily: "var(--font-display)",
                        lineHeight: 1,
                      }}
                    >
                      {passPercent == null ? "—" : `${passPercent}%`}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Pass Rate
                    </span>
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "var(--success)",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Passed —{" "}
                      <strong style={{ color: "var(--text-primary)" }}>
                        {summary?.charts.screening_pass_rate.passed_count ?? 0}
                      </strong>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "var(--gray-soft)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Not Passed —{" "}
                      <strong style={{ color: "var(--text-primary)" }}>
                        {summary?.charts.screening_pass_rate.not_passed_count ?? 0}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bar — score distribution */}
            <div className="fc-card fc-card--pad">
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <ChartBar size={17} color="var(--accent)" />
                <h3>Score Distribution</h3>
              </div>
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
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--accent-soft)" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={28}>
                    {(summary?.charts.score_distribution ?? []).map((entry, i) => (
                      <Cell key={i} fill={scoreFill(entry.range)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
