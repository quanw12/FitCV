import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { JobPost } from "@/types/jobs"

const jobsMocks = vi.hoisted(() => ({
  getPublic: vi.fn(),
}))

vi.mock("@/api/jobsApi", () => ({ jobsApi: jobsMocks }))

import PublicJobScreen from "./PublicJobScreen"

const job: JobPost = {
  job_id: 12,
  title: "Backend Engineer",
  description: null,
  about_job: "Build reliable services.",
  responsibilities: "Design APIs.",
  requirements: "Python and SQL.",
  we_offer: "Flexible hours.",
  life_at_company: null,
  hiring_process: "Two interviews.",
  location: "Ho Chi Minh City",
  employment_type: "Full-time",
  status: "Published",
  deadline: "2026-08-10T17:00:00Z",
  archived_at: null,
  skill_weight: 45,
  experience_weight: 30,
  education_weight: 15,
  soft_skill_weight: 10,
  openings_count: 2,
  application_count: 0,
  created_at: "2026-07-23T08:00:00Z",
  updated_at: null,
  company: {
    name: "FitCV Labs",
    logo_url: null,
    website_url: "https://example.com",
  },
}

describe("PublicJobScreen", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows a published job without requiring a session", async () => {
    jobsMocks.getPublic.mockResolvedValue(job)

    render(<PublicJobScreen jobId={12} onBack={vi.fn()} />)

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument()
    expect(screen.getByText("Python and SQL.")).toBeInTheDocument()
    expect(jobsMocks.getPublic).toHaveBeenCalledWith(12)
  })

  it("shows an understandable error and retries", async () => {
    jobsMocks.getPublic
      .mockRejectedValueOnce(new Error("Job not found."))
      .mockResolvedValueOnce(job)

    render(<PublicJobScreen jobId={12} onBack={vi.fn()} />)

    expect(
      await screen.findByText("This job is unavailable"),
    ).toBeInTheDocument()
    expect(screen.getByText("Job not found.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument()
  })
})
