import { fireEvent, render, screen } from "@testing-library/react"
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

import LinkedInJobSearchScreen from "./LinkedInJobSearchScreen"

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

describe("LinkedInJobSearchScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listCvs.mockResolvedValue([parsedCv])
    apiMocks.recommendations.mockResolvedValue({
      query: "react python",
      location: "Remote",
      note: "Personal-use prototype",
      results: [
        {
          id: "123456789",
          title: "Frontend Engineer (React)",
          company: "Example Co",
          location: "Remote",
          date: "2026-07-20",
          url: "https://www.linkedin.com/jobs/view/123456789",
          matchedKeywords: ["react"],
        },
      ],
    })
  })

  it("renders parsed CVs and searches with a click", async () => {
    render(<LinkedInJobSearchScreen />)

    expect(await screen.findByText("resume.pdf (v1)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /find matching jobs/i }))

    expect(
      await screen.findByText("Frontend Engineer (React)"),
    ).toBeInTheDocument()

    expect(apiMocks.recommendations).toHaveBeenCalledWith(
      expect.objectContaining({ cvId: 1 }),
    )

    const link = screen.getByRole("link", { name: /view on linkedin/i })
    expect(link).toHaveAttribute(
      "href",
      "https://www.linkedin.com/jobs/view/123456789",
    )
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("shows an empty state when there are no CVs", async () => {
    apiMocks.listCvs.mockResolvedValue([])

    render(<LinkedInJobSearchScreen />)

    expect(await screen.findByText("No CV uploaded yet")).toBeInTheDocument()
  })

  it("shows an error when the search fails", async () => {
    apiMocks.recommendations.mockRejectedValue(
      new Error("LinkedIn request failed: 429"),
    )

    render(<LinkedInJobSearchScreen />)

    await screen.findByText("resume.pdf (v1)")

    fireEvent.click(screen.getByRole("button", { name: /find matching jobs/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "LinkedIn request failed: 429",
    )
  })
})
