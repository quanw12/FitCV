import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AnalyzerDraftState } from "@/types/analyzer"

const analyzerApiMocks = vi.hoisted(() => ({
  uploadCv: vi.fn(),
  getCv: vi.fn(),
  deleteCv: vi.fn(),
  analyzeCv: vi.fn(),
  getMatchResult: vi.fn(),
}))

vi.mock("@/api/analyzerApi", () => ({ analyzerApi: analyzerApiMocks }))

import AnalyzerScreen from "./AnalyzerScreen"

function AnalyzerHarness({
  initialDraft,
  onAnalysisComplete,
  onAnalysisInvalidated,
}: {
  initialDraft: AnalyzerDraftState
  onAnalysisComplete?: (matchResultId: string) => void
  onAnalysisInvalidated?: () => void
}) {
  const [draft, setDraft] = useState(initialDraft)
  return (
    <AnalyzerScreen
      draft={draft}
      setDraft={setDraft}
      onAnalysisComplete={onAnalysisComplete}
      onAnalysisInvalidated={onAnalysisInvalidated}
    />
  )
}

function readyDraft(): AnalyzerDraftState {
  return {
    cvFile: new File(["synthetic cv"], "synthetic.pdf", {
      type: "application/pdf",
    }),
    uploadedCvId: 7,
    jdText:
      "Backend role requires Python, FastAPI, MySQL, Docker, CI/CD and clear communication skills.",
    result: null,
  }
}

describe("Analyzer invalidation and cancellation", () => {
  beforeEach(() => {
    analyzerApiMocks.analyzeCv.mockReset()
  })

  it("invalidates the previous Improvement selection when JD input changes", () => {
    const onAnalysisInvalidated = vi.fn()
    render(
      <AnalyzerHarness
        initialDraft={readyDraft()}
        onAnalysisInvalidated={onAnalysisInvalidated}
      />,
    )

    fireEvent.change(screen.getByLabelText("Job Description"), {
      target: { value: "A different job description with enough content to analyze safely." },
    })

    expect(onAnalysisInvalidated).toHaveBeenCalledTimes(1)
  })

  it("aborts an in-flight analysis and ignores its late result when inputs change", async () => {
    const onAnalysisInvalidated = vi.fn()
    const onAnalysisComplete = vi.fn()
    let requestSignal: AbortSignal | undefined

    analyzerApiMocks.analyzeCv.mockImplementation(
      (_request: unknown, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          requestSignal = signal
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          )
        }),
    )

    render(
      <AnalyzerHarness
        initialDraft={readyDraft()}
        onAnalysisComplete={onAnalysisComplete}
        onAnalysisInvalidated={onAnalysisInvalidated}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Analyze match" }))
    await waitFor(() => expect(analyzerApiMocks.analyzeCv).toHaveBeenCalledOnce())
    expect(requestSignal?.aborted).toBe(false)

    fireEvent.change(screen.getByLabelText("Job Description"), {
      target: { value: "A newly selected role invalidates the running analysis." },
    })

    await waitFor(() => expect(requestSignal?.aborted).toBe(true))
    expect(onAnalysisComplete).not.toHaveBeenCalled()
    expect(onAnalysisInvalidated).toHaveBeenCalled()
  })
})
