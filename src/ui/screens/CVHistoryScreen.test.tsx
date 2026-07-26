import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const analyzerMocks = vi.hoisted(() => ({
  listCvs: vi.fn(),
  listCvComparisons: vi.fn(),
  uploadCv: vi.fn(),
  deleteCv: vi.fn(),
}))

vi.mock("@/api/analyzerApi", () => ({
  analyzerApi: analyzerMocks,
}))

import CVHistoryScreen from "./CVHistoryScreen"

describe("CVHistoryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analyzerMocks.listCvs.mockResolvedValue([
      {
        cvId: 1,
        fileName: "cv-v1.pdf",
        fileType: "PDF",
        fileSizeKb: 120,
        versionNumber: 1,
        isLatest: false,
        uploadedAt: "2026-07-01T10:00:00Z",
        parseStatus: "Success",
        parserVersion: "test-v1",
        errorMessage: null,
      },
      {
        cvId: 2,
        fileName: "cv-v2.pdf",
        fileType: "PDF",
        fileSizeKb: 130,
        versionNumber: 2,
        isLatest: true,
        uploadedAt: "2026-07-02T10:00:00Z",
        parseStatus: "Success",
        parserVersion: "test-v1",
        errorMessage: null,
      },
    ])
    analyzerMocks.listCvComparisons.mockResolvedValue([
      {
        jobDescriptionId: 10,
        title: "Backend Developer",
        createdAt: "2026-07-01T09:00:00Z",
        bestScore: 82,
        latestScore: 82,
        latestDelta: 27,
        versions: [
          {
            cvId: 1,
            versionNumber: 1,
            fileName: "cv-v1.pdf",
            uploadedAt: "2026-07-01T10:00:00Z",
            matchResultId: 100,
            overallScore: 55,
            skillScore: 50,
            experienceScore: 60,
            educationScore: 100,
            softSkillScore: 70,
            matchLabel: "Moderate Match",
            completedAt: "2026-07-01T10:05:00Z",
            deltaFromPrevious: null,
          },
          {
            cvId: 2,
            versionNumber: 2,
            fileName: "cv-v2.pdf",
            uploadedAt: "2026-07-02T10:00:00Z",
            matchResultId: 101,
            overallScore: 82,
            skillScore: 85,
            experienceScore: 80,
            educationScore: 100,
            softSkillScore: 75,
            matchLabel: "Strong Match",
            completedAt: "2026-07-02T10:05:00Z",
            deltaFromPrevious: 27,
          },
        ],
      },
    ])
  })

  it("renders score progress and compares two versions against the same JD", async () => {
    render(<CVHistoryScreen />)

    expect(await screen.findByText("Progress across CV versions")).toBeInTheDocument()
    expect(screen.getByText("Latest 82.0%")).toBeInTheDocument()
    expect(screen.getByText("+27.0 points from previous")).toBeInTheDocument()

    const compareButtons = screen.getAllByRole("button", { name: "Compare" })
    fireEvent.click(compareButtons[0])
    fireEvent.click(compareButtons[1])

    await waitFor(() => expect(screen.getByText("Version comparison")).toBeInTheDocument())
    expect(screen.getByText("55.0%")).toBeInTheDocument()
    expect(screen.getByText("82.0%")).toBeInTheDocument()
    expect(screen.getByText("+27.0 points")).toBeInTheDocument()
  })
})
