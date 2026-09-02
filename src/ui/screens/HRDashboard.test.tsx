import { fireEvent, render, screen } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ReportSummary } from "@/types/reports"

import { setCachedResource } from "@/services/resourceCache"
import { trailingDaysWindow } from "@/services/reportMetrics"

const reportsMocks = vi.hoisted(() => ({ summary: vi.fn() }))

vi.mock("@/api/reportsApi", () => ({ reportsApi: reportsMocks }))

import HRDashboard from "./HRDashboard"

const summary: ReportSummary = {
  window: { from: "2026-07-03", to: "2026-08-01", label: "Jul 2026" },

  kpis: {
    active_job_posts: 4,

    total_cvs_reviewed: 119,

    avg_candidate_score: 68.4,

    review_progress: 58,

    time_to_shortlist_days: 3.2,

    time_to_hire_days: 18,

    offer_acceptance_rate: 87,

    prev: {
      active_job_posts: 3,

      total_cvs_reviewed: 96,

      avg_candidate_score: 64.1,

      review_progress: 51,

      time_to_shortlist_days: 3.8,

      time_to_hire_days: 20,

      offer_acceptance_rate: 82,
    },
  },

  charts: {
    applications_over_time: [
      { period: "2026-W27", label: "Jul 5", count: 12 },

      { period: "2026-W28", label: "Jul 12", count: 18 },
    ],

    screening_pass_rate: { passed_count: 68, not_passed_count: 32 },

    score_distribution: [
      { range: "90-100%", count: 8 },

      { range: "80-89%", count: 19 },
    ],
  },

  jobs: [
    {
      job_id: 1,

      title: "Senior Backend Developer",

      department: "Engineering",

      cv_count: 47,

      avg_score: 72.1,

      review_progress: 63,

      status: "Published",
    },

    {
      job_id: 2,

      title: "Product Designer",

      department: "Design",

      cv_count: 23,

      avg_score: null,

      review_progress: null,

      status: "Draft",
    },
  ],
}

const emptySummary: ReportSummary = {
  ...summary,

  kpis: {
    ...summary.kpis,

    active_job_posts: 0,

    total_cvs_reviewed: 0,

    avg_candidate_score: null,

    review_progress: null,

    prev: null,
  },

  jobs: [],
}

const onNavigate = vi.fn()

describe("HRDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    reportsMocks.summary.mockResolvedValue(summary)
  })

  it("renders the hero immediately before data arrives", () => {
    // Synchronous render — data has not resolved yet.
    const unresolved = vi.fn().mockImplementation(
      () => new Promise(() => {}),
    )
    reportsMocks.summary.mockImplementation(unresolved)

    render(<HRDashboard onNavigate={onNavigate} />)

    // Hero title and description must be visible immediately, not hidden
    // behind a full-page skeleton.
    expect(
      screen.getByRole("heading", {
        name: /Ready to discover top talent\?/,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/AI-assisted screening is active/),
    ).toBeInTheDocument()
  })

  it("renders real KPI values and job rows", async () => {
    render(<HRDashboard onNavigate={onNavigate} />)

    expect(await screen.findByText("119")).toBeInTheDocument()

    expect(screen.getByText("68%")).toBeInTheDocument()

    expect(screen.getByText("63%")).toBeInTheDocument()

    expect(screen.getByText("Senior Backend Developer")).toBeInTheDocument()

    expect(screen.getByText("Product Designer")).toBeInTheDocument()

    expect(screen.getByText("72%")).toBeInTheDocument()

    expect(reportsMocks.summary).toHaveBeenCalledTimes(1)
  })

  it("shows job status and pending-review context, most urgent first", async () => {
    render(<HRDashboard onNavigate={onNavigate} />)

    expect(
      await screen.findByText("Senior Backend Developer"),
    ).toBeInTheDocument()

    expect(screen.getByText("Published")).toBeInTheDocument()

    expect(screen.getByText("Draft")).toBeInTheDocument()

    expect(screen.getByText("17 to review")).toBeInTheDocument()

    expect(screen.getByText("Moderate Match")).toBeInTheDocument()

    // 17 pending reviews outrank the draft with none, so it renders first.

    const rows = screen.getAllByRole("row")

    expect(rows[1].textContent).toContain("Senior Backend Developer")

    expect(rows[2].textContent).toContain("Product Designer")
  })

  it("renders em-dash for missing scores", async () => {
    render(<HRDashboard onNavigate={onNavigate} />)

    await screen.findByText("Senior Backend Developer")

    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })

  it("shows the empty state when there is no data", async () => {
    reportsMocks.summary.mockResolvedValue(emptySummary)

    render(<HRDashboard onNavigate={onNavigate} />)

    expect(
      await screen.findByText("No recruitment data yet"),
    ).toBeInTheDocument()
  })

  it("shows an error and retries, but the hero stays visible during error", async () => {
    reportsMocks.summary

      .mockRejectedValueOnce(new Error("Reports API unavailable."))

      .mockResolvedValueOnce(summary)

    render(<HRDashboard onNavigate={onNavigate} />)

    expect(
      await screen.findByText("Could not load the dashboard."),
    ).toBeInTheDocument()

    // Hero must remain visible even when the data section shows an error.
    expect(
      screen.getByRole("heading", {
        name: /Ready to discover top talent\?/,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByText("Senior Backend Developer"),
    ).toBeInTheDocument()
  })

  it("renders cached data immediately on revisit (no skeleton flash)", () => {
    const range = trailingDaysWindow(30)
    const cacheKey = `hr-dashboard:summary:${range.from}:${range.to}`

    // Pre-populate the cache as if the user already visited this screen.
    setCachedResource(cacheKey, summary)

    // The API should NOT be called again on initial render when cache exists.
    reportsMocks.summary.mockClear()

    render(<HRDashboard onNavigate={onNavigate} />)

    // Cached KPI data must be visible synchronously — no loading skeleton.
    expect(screen.getByText("119")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: /Ready to discover top talent\?/,
      }),
    ).toBeInTheDocument()
  })
})
