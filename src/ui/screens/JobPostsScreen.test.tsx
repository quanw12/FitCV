import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { JobPost } from "@/types/jobs"

const jobsMocks = vi.hoisted(() => ({
  listManaged: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  close: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  extract: vi.fn(),
}))

vi.mock("@/api/jobsApi", () => ({
  jobsApi: jobsMocks,
}))

import JobPostsScreen from "./JobPostsScreen"

const activeJob: JobPost = {
  job_id: 12,
  title: "Backend Engineer",
  description: null,
  about_job: "Build reliable services for FitCV.",
  responsibilities: "Design and maintain APIs.",
  requirements: "Python and FastAPI.",
  we_offer: "Flexible working hours.",
  life_at_company: "Collaborative team.",
  hiring_process: "Screen and technical interview.",
  location: "Ho Chi Minh City",
  employment_type: "Full-time",
  status: "Draft",
  deadline: "2026-08-10T17:00:00Z",
  archived_at: null,
  skill_weight: 45,
  experience_weight: 30,
  education_weight: 15,
  soft_skill_weight: 10,
  openings_count: 2,
  application_count: 3,
  created_at: "2026-07-23T08:00:00Z",
  updated_at: null,
  company: {
    name: "FitCV Labs",
    logo_url: null,
    website_url: null,
  },
}

const archivedJob: JobPost = {
  ...activeJob,
  job_id: 19,
  title: "Archived QA Engineer",
  status: "Closed",
  archived_at: "2026-07-22T09:00:00Z",
}

describe("JobPostsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    jobsMocks.listManaged.mockImplementation((archived = false) =>
      Promise.resolve(archived ? [archivedJob] : [activeJob]),
    )
    jobsMocks.create.mockResolvedValue(activeJob)
    jobsMocks.update.mockResolvedValue(activeJob)
    jobsMocks.publish.mockResolvedValue({
      ...activeJob,
      status: "Published",
    })
    jobsMocks.close.mockResolvedValue({
      ...activeJob,
      status: "Closed",
    })
    jobsMocks.archive.mockResolvedValue({
      ...activeJob,
      archived_at: "2026-07-23T10:00:00Z",
    })
    jobsMocks.unarchive.mockResolvedValue({
      ...archivedJob,
      archived_at: null,
    })
    jobsMocks.extract.mockResolvedValue({
      title: "AI Platform Engineer",
      about_job: "Build an AI recruitment platform.",
      responsibilities: "Design reliable APIs.",
      requirements: "Python, FastAPI, and three years of experience.",
      we_offer: "Flexible working hours.",
      life_at_company: "Collaborative product team.",
      hiring_process: "Screening and technical interview.",
      location: "Ho Chi Minh City",
      employment_type: "Full-time",
      required_skills: ["Python", "FastAPI"],
      preferred_skills: [],
      experience_summary: "Three years of backend experience.",
      warnings: ["Salary was not specified."],
    })
  })

  it("loads active and archived jobs into separate accessible tabs", async () => {
    render(<JobPostsScreen />)

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument()
    expect(jobsMocks.listManaged).toHaveBeenCalledWith(false)
    expect(jobsMocks.listManaged).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole("tab", { name: /Archived/ }))

    expect(screen.getByText("Archived QA Engineer")).toBeInTheDocument()
    expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument()
  })

  it("validates scoring weights before creating a draft", async () => {
    jobsMocks.listManaged.mockResolvedValue([])
    jobsMocks.create.mockResolvedValue({
      ...activeJob,
      title: "Platform Engineer",
      skill_weight: 50,
      experience_weight: 25,
    })

    render(<JobPostsScreen />)
    await screen.findByText("No active job records yet")
    fireEvent.click(screen.getByRole("button", { name: "New job" }))

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Platform Engineer" },
    })
    fireEvent.change(screen.getByLabelText("Skills weight"), {
      target: { value: "50" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }))

    expect(
      screen.getByText(
        "Each scoring weight must be between 0 and 100, with a total of 100%.",
      ),
    ).toBeInTheDocument()
    expect(jobsMocks.create).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Experience weight"), {
      target: { value: "25" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }))

    await waitFor(() => {
      expect(jobsMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Platform Engineer",
          deadline: null,
          skill_weight: 50,
          experience_weight: 25,
          education_weight: 15,
          soft_skill_weight: 10,
        }),
      )
    })
    expect(
      await screen.findByText("Created draft “Platform Engineer”."),
    ).toBeInTheDocument()
  })

  it("extracts an AI draft and keeps it in review before saving", async () => {
    render(<JobPostsScreen />)
    await screen.findByText("Backend Engineer")
    fireEvent.click(screen.getByRole("button", { name: "New job" }))

    fireEvent.change(screen.getByLabelText("Full job description"), {
      target: {
        value:
          "We need an experienced backend engineer to build reliable APIs with Python and FastAPI in Ho Chi Minh City.",
      },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Extract fields with AI" }),
    )

    expect(
      await screen.findByDisplayValue("AI Platform Engineer"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "AI extracted a draft. Review every field before saving or publishing.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Salary was not specified.")).toBeInTheDocument()
    expect(jobsMocks.create).not.toHaveBeenCalled()
  })

  it("publishes and closes a job without reloading the list", async () => {
    render(<JobPostsScreen />)
    await screen.findByText("Backend Engineer")

    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    expect(
      await screen.findByRole("button", { name: "Close" }),
    ).toBeInTheDocument()
    expect(jobsMocks.publish).toHaveBeenCalledWith(activeJob.job_id)

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      await screen.findByRole("button", { name: "Reopen" }),
    ).toBeInTheDocument()
    expect(jobsMocks.close).toHaveBeenCalledWith(activeJob.job_id)
  })

  it("copies an anonymous public link for a published job", async () => {
    jobsMocks.listManaged.mockImplementation((archived = false) =>
      Promise.resolve(archived ? [] : [{ ...activeJob, status: "Published" }]),
    )

    render(<JobPostsScreen />)
    await screen.findByText("Backend Engineer")

    fireEvent.click(screen.getByRole("button", { name: "Copy public link" }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/[?&]job=12$/),
      )
    })
    expect(
      await screen.findByText("Copied the public link for “Backend Engineer”."),
    ).toBeInTheDocument()
  })

  it("loads a draft into the editor and saves its changes", async () => {
    jobsMocks.update.mockResolvedValue({
      ...activeJob,
      title: "API Platform Engineer",
    })

    render(<JobPostsScreen />)
    await screen.findByText("Backend Engineer")

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "API Platform Engineer" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(jobsMocks.update).toHaveBeenCalledWith(
        activeJob.job_id,
        expect.objectContaining({
          title: "API Platform Engineer",
          skill_weight: 45,
          experience_weight: 30,
          education_weight: 15,
          soft_skill_weight: 10,
        }),
      )
    })
    expect(
      await screen.findByText("Saved changes to “API Platform Engineer”."),
    ).toBeInTheDocument()
  })

  it("moves an archived job out of active records and restores it later", async () => {
    jobsMocks.listManaged.mockImplementation((archived = false) =>
      Promise.resolve(archived ? [] : [activeJob]),
    )
    jobsMocks.unarchive.mockResolvedValue({
      ...activeJob,
      archived_at: null,
    })

    render(<JobPostsScreen />)
    await screen.findByText("Backend Engineer")

    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    expect(
      await screen.findByText("No active job records yet"),
    ).toBeInTheDocument()
    expect(jobsMocks.archive).toHaveBeenCalledWith(activeJob.job_id)

    fireEvent.click(screen.getByRole("tab", { name: /Archived/ }))
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    expect(await screen.findByText("No archived jobs")).toBeInTheDocument()
    expect(jobsMocks.unarchive).toHaveBeenCalledWith(activeJob.job_id)
  })

  it("shows a load failure and recovers through Retry", async () => {
    let shouldFail = true
    jobsMocks.listManaged.mockImplementation(() => {
      if (shouldFail) return Promise.reject(new Error("Backend unavailable."))
      return Promise.resolve([])
    })

    render(<JobPostsScreen />)

    expect(
      await screen.findByText("Jobs could not be loaded"),
    ).toBeInTheDocument()
    expect(screen.getByText("Backend unavailable.")).toBeInTheDocument()

    shouldFail = false
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByText("No active job records yet"),
    ).toBeInTheDocument()
  })
})
