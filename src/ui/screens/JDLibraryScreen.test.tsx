import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  listPublicJobs: vi.fn(),
  listApplications: vi.fn(),
  listJds: vi.fn(),
  getInsights: vi.fn(),
  deleteJd: vi.fn(),
  getProfile: vi.fn(),
}))

vi.mock("@/api/jobsApi", () => ({
  jobsApi: { listPublic: apiMocks.listPublicJobs, apply: vi.fn() },
}))
vi.mock("@/api/applicationsApi", () => ({
  applicationsApi: { listMine: apiMocks.listApplications },
}))
vi.mock("@/api/jdLibraryApi", () => ({
  jdLibraryApi: {
    list: apiMocks.listJds,
    getInsights: apiMocks.getInsights,
    delete: apiMocks.deleteJd,
  },
}))
vi.mock("@/api/profileApi", () => ({
  profileApi: { get: apiMocks.getProfile },
}))

import JDLibraryScreen from "./JDLibraryScreen"

describe("JDLibraryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listPublicJobs.mockResolvedValue([])
    apiMocks.listApplications.mockResolvedValue([])
    apiMocks.listJds.mockResolvedValue([
      {
        jobDescriptionId: 10,
        title: "Cybersecurity Intern",
        sourceType: "PastedText",
        rawText: "Requires Python, Wireshark, and communication.",
        createdAt: "2026-07-01T10:00:00Z",
        parseStatus: "Success",
        requiredSkills: ["Python", "Wireshark"],
        preferredSkills: ["Nessus"],
        softSkills: ["Communication"],
        experienceYears: null,
        education: "Bachelor",
        matchCount: 2,
        latestScore: 70,
        latestMatchLabel: "Moderate Match",
      },
    ])
    apiMocks.getInsights.mockResolvedValue({
      totalJobDescriptions: 1,
      totalMatches: 2,
      averageMatchScore: 70,
      requiredSkills: [{ skill: "Python", count: 1, percentage: 100 }],
      preferredSkills: [{ skill: "Nessus", count: 1, percentage: 100 }],
      missingSkills: [{ skill: "Nessus", count: 2, percentage: 100 }],
    })
  })

  it("renders personal JD stats, requested skills, and recurring gaps", async () => {
    render(<JDLibraryScreen onViewTracking={vi.fn()} />)

    expect(await screen.findByText("Cybersecurity Intern")).toBeInTheDocument()
    expect(screen.getByText("Analyzed JDs")).toBeInTheDocument()
    expect(screen.getByText("Completed matches")).toBeInTheDocument()
    expect(screen.getByText("70.0%")).toBeInTheDocument()
    expect(screen.getByText("Most requested skills")).toBeInTheDocument()
    expect(screen.getByText("Skills missing most")).toBeInTheDocument()
    expect(screen.getAllByText("Nessus").length).toBeGreaterThan(0)
  })
})
