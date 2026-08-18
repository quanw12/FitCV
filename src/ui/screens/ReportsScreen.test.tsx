import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ReportSummary } from "@/types/reports"

const reportsMocks = vi.hoisted(() => ({ summary: vi.fn() }))

vi.mock("@/api/reportsApi", () => ({ reportsApi: reportsMocks }))

import ReportsScreen from "./ReportsScreen"

const now = new Date()

const pad = (n: number) => String(n).padStart(2, "0")

const dateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const firstOfCurrentMonth = dateInput(
  new Date(now.getFullYear(), now.getMonth(), 1),
)

const lastOfCurrentMonth = dateInput(
  new Date(now.getFullYear(), now.getMonth() + 1, 0),
)

const summary: ReportSummary = {
  window: {
    from: firstOfCurrentMonth,
    to: lastOfCurrentMonth,
    label: "Jul 2026",
  },

  kpis: {
    active_job_posts: 4,

    total_cvs_reviewed: 119,

    avg_candidate_score: 68.4,

    review_progress: 58,

    time_to_shortlist_days: 3.2,

    time_to_hire_days: null,

    offer_acceptance_rate: null,

    prev: {
      active_job_posts: 3,

      total_cvs_reviewed: 96,

      avg_candidate_score: 64.1,

      review_progress: 51,

      time_to_shortlist_days: 3.8,

      time_to_hire_days: null,

      offer_acceptance_rate: null,
    },
  },

  charts: {
    applications_over_time: [
      { period: "2026-W27", label: "Jul 5", count: 12 },

      { period: "2026-W28", label: "Jul 12", count: 18 },

      { period: "2026-W29", label: "Jul 19", count: 24 },
    ],

    screening_pass_rate: { passed_count: 68, not_passed_count: 32 },

    score_distribution: [
      { range: "90-100%", count: 8 },

      { range: "80-89%", count: 19 },

      { range: "70-79%", count: 32 },
    ],
  },

  jobs: [
    {
      job_id: 1,

      title: "Senior Backend Developer",

      department: "Engineering",

      cv_count: 47,

      avg_score: 72.1,

      review_progress: 68,

      status: "Published",
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

    time_to_shortlist_days: null,

    time_to_hire_days: null,

    offer_acceptance_rate: null,

    prev: null,
  },

  jobs: [],
}

describe("ReportsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    reportsMocks.summary.mockResolvedValue(summary)
  })

  it("renders KPIs, em-dashes for null funnel metrics, and charts", async () => {
    render(<ReportsScreen />)

    expect(await screen.findByText("119")).toBeInTheDocument()

    expect(screen.getByText("3.2 days")).toBeInTheDocument()

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2)

    expect(screen.getByText("Applications Over Time")).toBeInTheDocument()

    expect(screen.getByText("Screening Pass Rate")).toBeInTheDocument()

    expect(screen.getByText("Score Distribution")).toBeInTheDocument()
  })

  it("renders the per-job performance table for the month", async () => {
    render(<ReportsScreen />)

    expect(await screen.findByText("Job Performance")).toBeInTheDocument()

    expect(screen.getByText("Senior Backend Developer")).toBeInTheDocument()

    expect(screen.getByText("72%")).toBeInTheDocument()

    expect(screen.getByText("Moderate Match")).toBeInTheDocument()

    expect(screen.getByText("Published")).toBeInTheDocument()
  })

  it("navigates months and refetches with the month window", async () => {
    render(<ReportsScreen />)

    await screen.findByText("119")

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }))

    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    )

    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    await waitFor(() => {
      expect(reportsMocks.summary).toHaveBeenLastCalledWith({
        from: dateInput(previousMonthStart),

        to: dateInput(previousMonthEnd),
      })
    })
  })

  it("exports a CSV from the fetched data", async () => {
    const createObjectURL = vi.fn(() => "blob:mock")

    const revokeObjectURL = vi.fn()

    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,

      configurable: true,
    })

    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,

      configurable: true,
    })

    render(<ReportsScreen />)

    await screen.findByText("119")

    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)

    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it("shows the empty state when there is no data", async () => {
    reportsMocks.summary.mockResolvedValue(emptySummary)

    render(<ReportsScreen />)

    expect(await screen.findByText("No reports yet")).toBeInTheDocument()
  })

  it("shows an error and retries", async () => {
    reportsMocks.summary

      .mockRejectedValueOnce(new Error("Reports API unavailable."))

      .mockResolvedValueOnce(summary)

    render(<ReportsScreen />)

    expect(
      await screen.findByText("Could not load reports."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("119")).toBeInTheDocument()
  })
})
