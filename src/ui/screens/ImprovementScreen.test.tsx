import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ImprovementReportResponse } from "@/types/improvement"

const improvementApiMocks = vi.hoisted(() => ({
  getReport: vi.fn(),
  generateReport: vi.fn(),
}))

vi.mock("@/api/improvementApi", () => ({
  improvementApi: improvementApiMocks,
}))

import ImprovementScreen from "./ImprovementScreen"

function completedReport(
  matchResultId: string,
  overallScore: number,
): ImprovementReportResponse {
  return {
    matchResultId,
    status: "Success",
    generatedAt: "2026-07-18T00:00:00Z",
    errorMessage: null,
    overallScore,
    stale: false,
    report: {
      skillGaps: [],
      sectionFeedback: [],
      rewriteSuggestions: [],
      quickWins: [],
    },
  }
}

describe("Improvement request lifecycle", () => {
  it("aborts the old request and ignores a late response after the match ID changes", async () => {
    let firstSignal: AbortSignal | undefined
    let resolveFirst: ((value: ImprovementReportResponse) => void) | undefined

    improvementApiMocks.getReport.mockImplementation(
      (matchResultId: string, signal?: AbortSignal) => {
        if (matchResultId === "1") {
          firstSignal = signal
          return new Promise<ImprovementReportResponse>((resolve) => {
            resolveFirst = resolve
          })
        }
        return Promise.resolve(completedReport("2", 82))
      },
    )

    const view = render(<ImprovementScreen matchResultId="1" />)
    await waitFor(() => expect(firstSignal).toBeDefined())

    view.rerender(<ImprovementScreen matchResultId="2" />)

    await waitFor(() => expect(firstSignal?.aborted).toBe(true))
    expect(await screen.findByText("82%")).toBeInTheDocument()

    await act(async () => {
      resolveFirst?.(completedReport("1", 11))
      await Promise.resolve()
    })

    expect(screen.queryByText("11%")).not.toBeInTheDocument()
    expect(screen.getByText("82%")).toBeInTheDocument()
    expect(improvementApiMocks.generateReport).not.toHaveBeenCalled()
  })
})
