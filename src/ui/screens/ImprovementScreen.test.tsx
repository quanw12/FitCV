import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const improvementMocks = vi.hoisted(() => ({
  generateReport: vi.fn(),
  getReport: vi.fn(),
}))

vi.mock("@/api/improvementApi", () => ({
  improvementApi: improvementMocks,
}))

import ImprovementScreen from "./ImprovementScreen"

describe("ImprovementScreen failure state", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    improvementMocks.generateReport.mockResolvedValue({
      matchResultId: "28",
      status: "Pending",
      taskId: "7",
    })
    improvementMocks.getReport
      .mockResolvedValueOnce({
        matchResultId: "28",
        status: "Pending",
        generatedAt: null,
        errorMessage: null,
        overallScore: 57.76,
        stale: false,
        report: null,
      })
      .mockResolvedValueOnce({
        matchResultId: "28",
        status: "Failed",
        generatedAt: null,
        errorMessage: "Gemini did not return grounded advice.",
        overallScore: 57.76,
        stale: false,
        report: null,
      })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("replaces the processing card with one retryable error card", async () => {
    render(<ImprovementScreen matchResultId="28" />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText("Generating your report")).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByText("Suggestions unavailable")).toBeInTheDocument()
    expect(
      screen.getByText("Gemini did not return grounded advice."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Generating your report")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})
