import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ImprovementReportResponse } from "@/types/improvement"

const improvementMocks = vi.hoisted(() => ({
  generateReport: vi.fn(),
  getReport: vi.fn(),
}))

vi.mock("@/api/improvementApi", () => ({
  improvementApi: improvementMocks,
}))

import ImprovementScreen from "./ImprovementScreen"

const fullReport: NonNullable<ImprovementReportResponse["report"]> = {
  skillGaps: [
    {
      id: "skill-docker",
      skill: "Docker",
      priority: "High",
      reason: "The role requires container deployment experience.",
      jdEvidence: "Experience deploying services with Docker.",
    },
  ],
  sectionFeedback: [
    {
      id: "feedback-experience",
      section: "WorkExperience",
      issue: "Impact is unclear",
      explanation: "The bullet describes activity without a measurable result.",
      priority: "Medium",
      suggestedAction: "Add an outcome that you can verify.",
    },
  ],
  rewriteSuggestions: [
    {
      id: "rewrite-experience",
      section: "WorkExperience",
      originalText: "Built backend services.",
      issue: "The statement is too broad.",
      suggestedText: "Built backend services for the order workflow.",
      framework: "Action + Scope",
    },
  ],
  quickWins: [
    {
      id: "quick-proofread",
      title: "Proofread the summary",
      category: "Format",
      priority: "Low",
      explanation: "Remove repeated wording before submitting.",
    },
  ],
}

function reportResponse(
  overrides: Partial<ImprovementReportResponse> = {},
): ImprovementReportResponse {
  return {
    matchResultId: "28",
    status: "Success",
    generatedAt: "2026-07-23T00:00:00Z",
    errorMessage: null,
    overallScore: 57.76,
    stale: false,
    report: fullReport,
    ...overrides,
  }
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("ImprovementScreen acceptance states", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    improvementMocks.generateReport.mockResolvedValue({
      matchResultId: "28",
      status: "Pending",
      taskId: "7",
    })
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows processing and prevents a duplicate regenerate request", async () => {
    vi.useFakeTimers()
    const pending = reportResponse({
      status: "Pending",
      generatedAt: null,
      report: null,
    })
    improvementMocks.getReport.mockResolvedValue(pending)

    const { unmount } = render(<ImprovementScreen matchResultId="28" />)
    await flushPromises()

    expect(screen.getByText("Generating your report")).toBeInTheDocument()
    const regenerate = screen.getByRole("button", { name: "Regenerate" })
    expect(regenerate).toBeDisabled()

    fireEvent.click(regenerate)
    expect(improvementMocks.generateReport).toHaveBeenCalledTimes(1)

    unmount()
  })

  it("renders a successful report with all four areas", async () => {
    improvementMocks.getReport.mockResolvedValueOnce(reportResponse())

    render(<ImprovementScreen matchResultId="28" />)

    expect(await screen.findByText("Docker")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Section-by-section Feedback" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Rewrite Suggestions" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Quick Wins Checklist" }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Overall score 57.76, Moderate Match"),
    ).toBeInTheDocument()
  })

  it("renders an appropriate empty state for every report area", async () => {
    improvementMocks.getReport.mockResolvedValueOnce(
      reportResponse({
        report: {
          skillGaps: [],
          sectionFeedback: [],
          rewriteSuggestions: [],
          quickWins: [],
        },
      }),
    )

    render(<ImprovementScreen matchResultId="28" />)

    expect(
      await screen.findByText(
        "No clear skill gaps were found for this job description.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No section-specific feedback is available."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No safe rewrite suggestions are available."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No quick wins are available for this report."),
    ).toBeInTheDocument()
  })

  it("shows a failed state and recovers after Retry", async () => {
    vi.useFakeTimers()
    const pending = reportResponse({
      status: "Pending",
      generatedAt: null,
      report: null,
    })
    const failed = reportResponse({
      status: "Failed",
      generatedAt: null,
      errorMessage: "Gemini did not return grounded advice.",
      report: null,
    })
    improvementMocks.getReport
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(reportResponse())

    render(<ImprovementScreen matchResultId="28" />)
    await flushPromises()

    expect(screen.getByText("Generating your report")).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByText("Suggestions unavailable")).toBeInTheDocument()
    expect(
      screen.getByText("Gemini did not return grounded advice."),
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText("Generating your report")).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByText("Docker")).toBeInTheDocument()
    expect(
      screen.queryByText("Suggestions unavailable"),
    ).not.toBeInTheDocument()
    expect(improvementMocks.generateReport).toHaveBeenNthCalledWith(
      2,
      "28",
      true,
      expect.anything(),
    )
  })

  it("warns when the report is stale", async () => {
    improvementMocks.getReport.mockResolvedValueOnce(
      reportResponse({ stale: true }),
    )

    render(<ImprovementScreen matchResultId="28" />)

    expect(
      await screen.findByText(
        "This report may be outdated because the CV or job description changed. Regenerate it for current advice.",
      ),
    ).toBeInTheDocument()
  })

  it("reports clipboard success and failure", async () => {
    vi.useFakeTimers()
    const writeText = vi.mocked(navigator.clipboard.writeText)
    improvementMocks.getReport.mockResolvedValueOnce(reportResponse())

    render(<ImprovementScreen matchResultId="28" />)
    await flushPromises()

    const copy = screen.getByRole("button", {
      name: "Copy rewrite for Work Experience",
    })
    await act(async () => {
      fireEvent.click(copy)
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith(
      "Built backend services for the order workflow.",
    )
    expect(screen.getByText("Copied")).toBeInTheDocument()

    writeText.mockRejectedValueOnce(new Error("Clipboard unavailable"))
    await act(async () => {
      fireEvent.click(copy)
      await Promise.resolve()
    })
    expect(screen.getByText("Copy failed")).toBeInTheDocument()
  })

  it("updates Quick Wins state and progress immediately", async () => {
    improvementMocks.getReport.mockResolvedValueOnce(reportResponse())

    render(<ImprovementScreen matchResultId="28" />)

    const quickWin = await screen.findByRole("button", {
      name: /Proofread the summary/,
    })
    expect(screen.getByText("0/1 completed")).toBeInTheDocument()
    expect(quickWin).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(quickWin)

    expect(screen.getByText("1/1 completed")).toBeInTheDocument()
    expect(quickWin).toHaveAttribute("aria-pressed", "true")
  })
})
