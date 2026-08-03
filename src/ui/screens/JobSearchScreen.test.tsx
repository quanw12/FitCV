import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  listCvs: vi.fn(),
  recommendations: vi.fn(),
}))

vi.mock("@/api/analyzerApi", () => ({
  analyzerApi: { listCvs: apiMocks.listCvs },
}))
vi.mock("@/api/jobSearchApi", () => ({
  jobSearchApi: { recommendations: apiMocks.recommendations },
}))

import JobSearchScreen from "./JobSearchScreen"

const parsedCv = {
  cvId: 1,
  fileName: "resume.pdf",
  fileType: "PDF",
  fileSizeKb: 120,
  versionNumber: 1,
  isLatest: true,
  uploadedAt: "2026-07-01T10:00:00Z",
  parseStatus: "Success",
  parserVersion: "1.0",
  errorMessage: null,
}

describe("JobSearchScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listCvs.mockResolvedValue([parsedCv])
    apiMocks.recommendations.mockResolvedValue({
      query: "react python",
      location: "Remote",
      note: "Personal-use prototype",
      derivedBy: "deterministic",
      derivedLevel: "Junior",
      results: [
        {
          id: "frontend-engineer-example-abc123",
          title: "Frontend Engineer (React)",
          company: "Example Co",
          location: "Ho Chi Minh City, Vietnam",
          date: "2026-07-20",
          url: "https://job-boards.greenhouse.io/example/123",
          matchedKeywords: ["react"],
          seniority: "junior",
          category: "frontend",
          source: "freehire",
        },
      ],
    })
  })

  it("renders parsed CVs and searches with a click", async () => {
    render(<JobSearchScreen />)

    expect(await screen.findByText("resume.pdf (v1)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /find matching jobs/i }))

    expect(
      await screen.findByText("Frontend Engineer (React)"),
    ).toBeInTheDocument()

    expect(apiMocks.recommendations).toHaveBeenCalledWith(
      expect.objectContaining({ cvId: 1 }),
    )

    const link = screen.getByRole("link", { name: /view job/i })
    expect(link).toHaveAttribute(
      "href",
      "https://job-boards.greenhouse.io/example/123",
    )
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("shows an empty state when there are no CVs", async () => {
    apiMocks.listCvs.mockResolvedValue([])

    render(<JobSearchScreen />)

    expect(await screen.findByText("No CV uploaded yet")).toBeInTheDocument()
  })

  it("shows an AI-derived badge and the derived level", async () => {
    apiMocks.recommendations.mockResolvedValue({
      query: "Senior Backend Engineer python fastapi",
      location: "Remote",
      note: "Personal-use prototype",
      derivedBy: "ai",
      derivedLevel: "Senior",
      results: [],
    })

    render(<JobSearchScreen />)

    await screen.findByText("resume.pdf (v1)")

    fireEvent.click(
      screen.getByRole("button", { name: /find matching jobs/i }),
    )

    expect(
      await screen.findByTestId("ai-derived-badge"),
    ).toHaveTextContent("AI-derived from CV")
    expect(screen.getByTestId("derived-level-badge")).toHaveTextContent(
      "Level: Senior",
    )
    expect(screen.getByText(/no jobs found/i)).toBeInTheDocument()
  })

  it("sends the selected experience level", async () => {
    render(<JobSearchScreen />)

    await screen.findByText("resume.pdf (v1)")

    fireEvent.change(screen.getByLabelText(/experience level/i), {
      target: { value: "Senior" },
    })
    fireEvent.click(screen.getByRole("button", { name: /find matching jobs/i }))

    await waitFor(() =>
      expect(apiMocks.recommendations).toHaveBeenCalledWith(
        expect.objectContaining({ cvId: 1, level: "Senior" }),
      ),
    )
  })

  it("shows an error when the search fails", async () => {
    apiMocks.recommendations.mockRejectedValue(
      new Error("freehire request failed: 500"),
    )

    render(<JobSearchScreen />)

    await screen.findByText("resume.pdf (v1)")

    fireEvent.click(screen.getByRole("button", { name: /find matching jobs/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "freehire request failed: 500",
    )
  })
})
