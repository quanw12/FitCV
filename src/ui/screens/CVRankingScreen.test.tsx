import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  listManaged: vi.fn(),
  listApplications: vi.fn(),
  getApplicationCv: vi.fn(),
  downloadJobCvs: vi.fn(),
  parseBatch: vi.fn(),
  retryAnalysis: vi.fn(),
}))

vi.mock("@/api/jobsApi", () => ({
  jobsApi: { listManaged: apiMocks.listManaged },
}))

vi.mock("@/api/cvRankingApi", () => ({
  cvRankingApi: {
    listApplications: apiMocks.listApplications,
    getApplicationCv: apiMocks.getApplicationCv,
    downloadJobCvs: apiMocks.downloadJobCvs,
    parseBatch: apiMocks.parseBatch,
  },
}))

vi.mock("@/api/applicationsApi", () => ({
  applicationsApi: { retryAnalysis: apiMocks.retryAnalysis },
}))

import CVRankingScreen from "./CVRankingScreen"

describe("CVRankingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:fitcv-test"),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    apiMocks.getApplicationCv.mockResolvedValue(
      new Blob(["%PDF-1.4 test CV"], { type: "application/pdf" }),
    )
    apiMocks.downloadJobCvs.mockResolvedValue(
      new Blob(["ZIP"], { type: "application/zip" }),
    )
    apiMocks.listManaged.mockResolvedValue([
      {
        job_id: 11,
        title: "Backend Engineer",
        description: null,
        about_job: "Build hiring products.",
        responsibilities: "Build APIs.",
        requirements: "Python and FastAPI.",
        we_offer: "Learning budget.",
        life_at_company: "Collaborative team.",
        hiring_process: "Technical interview.",
        location: "Ho Chi Minh City",
        employment_type: "Full-time",
        status: "Published",
        deadline: "2026-08-01T00:00:00Z",
        openings_count: 2,
        application_count: 2,
        created_at: "2026-07-20T00:00:00Z",
        updated_at: null,
        company: {
          name: "FitCV Labs",
          logo_url: null,
          website_url: null,
        },
      },
    ])
    apiMocks.listApplications.mockResolvedValue([
      {
        application_id: 101,
        job_id: 11,
        current_stage: "Screening",
        status: "Active",
        applied_at: "2026-07-22T09:00:00Z",
        candidate: {
          full_name: "Alice Nguyen",
          email: "alice@example.com",
          phone: "0900000001",
        },
        cv: {
          file_name: "alice.pdf",
          file_type: "PDF",
          file_size_kb: 220,
        },
        parse_status: "Success",
        parse_error: null,
        analysis_status: "Success",
        analysis_error: null,
        algorithm_version: "fitcv-deterministic-v1",
        overall_score: 88,
        match_label: "Strong Match",
        pass_probability: 82,
        breakdown: {
          skills: 95,
          experience: 85,
          education: 80,
          soft_skills: 75,
        },
        parsed_cv: {
          skills: ["Python", "FastAPI"],
          experience_years: 3,
          education: "Bachelor",
        },
      },
      {
        application_id: 102,
        job_id: 11,
        current_stage: "Applied",
        status: "Active",
        applied_at: "2026-07-21T09:00:00Z",
        candidate: {
          full_name: "Bob Tran",
          email: "bob@example.com",
          phone: "0900000002",
        },
        cv: {
          file_name: "bob.pdf",
          file_type: "PDF",
          file_size_kb: 180,
        },
        parse_status: "Success",
        parse_error: null,
        analysis_status: "Success",
        analysis_error: null,
        algorithm_version: "fitcv-deterministic-v1",
        overall_score: 45,
        match_label: "Weak Match",
        pass_probability: 35,
        breakdown: {
          skills: 30,
          experience: 45,
          education: 80,
          soft_skills: 50,
        },
        parsed_cv: { skills: ["React"] },
      },
    ])
  })

  it("supports upload and job applicant ranking as two tabs", async () => {
    render(<CVRankingScreen />)

    expect(
      screen.getByRole("heading", { name: "Bulk CV Ranking" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Job Applicants" }))

    expect(
      await screen.findByRole("heading", { name: "Job Applicants" }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(apiMocks.listApplications).toHaveBeenCalledWith(11),
    )
    expect(screen.getAllByText("Alice Nguyen").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bob Tran").length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByText("Alice Nguyen")[0])
    expect(
      await screen.findByRole("heading", { name: "Raw CV" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Parsed data and score" }),
    ).toBeInTheDocument()
    expect(apiMocks.getApplicationCv).toHaveBeenCalledWith(101)
    expect(
      await screen.findByTitle("Raw CV for Alice Nguyen"),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Select score >= 70" }))
    expect(
      screen.getByRole("checkbox", { name: "Select Alice Nguyen" }),
    ).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Select Bob Tran" }),
    ).not.toBeChecked()

    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 selected" }))
    expect(
      screen.getByText("1 applicant confirmed for HR review."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Download all CVs" }))
    await waitFor(() =>
      expect(apiMocks.downloadJobCvs).toHaveBeenCalledWith(11),
    )
  })
})
