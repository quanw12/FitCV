import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PipelineApplication } from "@/types/pipeline"

const pipelineMocks = vi.hoisted(() => ({
  list: vi.fn(),
  moveStage: vi.fn(),
  listNotes: vi.fn(),
  addNote: vi.fn(),
  listHistory: vi.fn(),
}))
const jobsMocks = vi.hoisted(() => ({
  listManaged: vi.fn(),
}))

vi.mock("@/api/pipelineApi", () => ({ pipelineApi: pipelineMocks }))
vi.mock("@/api/jobsApi", () => ({ jobsApi: jobsMocks }))

import PipelineScreen from "./PipelineScreen"

const application: PipelineApplication = {
  application_id: 4,
  job_id: 2,
  job_title: "Backend Engineer",
  candidate_name: "Nguyen Minh",
  candidate_email: "minh@example.com",
  candidate_phone: "0900000000",
  current_stage: "Applied",
  status: "Active",
  applied_at: "2026-07-23T08:00:00Z",
  overall_score: 88,
  match_label: "Strong Match",
  note_count: 0,
}

describe("PipelineScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    jobsMocks.listManaged.mockResolvedValue([])
    pipelineMocks.list.mockResolvedValue([application])
    pipelineMocks.listNotes.mockResolvedValue([])
    pipelineMocks.listHistory.mockResolvedValue([])
    pipelineMocks.moveStage.mockImplementation((_id: number, stage: string) =>
      Promise.resolve({ ...application, current_stage: stage }),
    )
    pipelineMocks.addNote.mockResolvedValue({
      note_id: 9,
      application_id: application.application_id,
      author_name: "HR Manager",
      content: "Schedule a technical interview.",
      created_at: "2026-07-23T10:00:00Z",
      updated_at: null,
    })
  })

  it("loads candidates and moves a candidate through a backend stage", async () => {
    render(<PipelineScreen />)
    fireEvent.click(await screen.findByRole("button", { name: /Nguyen Minh/ }))

    fireEvent.change(screen.getByLabelText("Recruitment stage"), {
      target: { value: "Interview" },
    })

    await waitFor(() => {
      expect(pipelineMocks.moveStage).toHaveBeenCalledWith(4, "Interview")
    })
    expect(
      await screen.findByText("Moved Nguyen Minh to Interview."),
    ).toBeInTheDocument()
  })

  it("adds a recruiter note and updates the visible activity", async () => {
    render(<PipelineScreen />)
    fireEvent.click(await screen.findByRole("button", { name: /Nguyen Minh/ }))
    fireEvent.change(
      screen.getByPlaceholderText("Add a factual recruiter note..."),
      {
        target: { value: "Schedule a technical interview." },
      },
    )
    fireEvent.click(screen.getByRole("button", { name: "Add note" }))

    expect(
      await screen.findByText("Schedule a technical interview."),
    ).toBeInTheDocument()
    expect(pipelineMocks.addNote).toHaveBeenCalledWith(
      4,
      "Schedule a technical interview.",
    )
  })

  it("shows the pipeline empty state", async () => {
    pipelineMocks.list.mockResolvedValue([])

    render(<PipelineScreen />)

    expect(
      await screen.findByText("No candidates in this pipeline"),
    ).toBeInTheDocument()
  })

  it("shows a load failure and retries", async () => {
    pipelineMocks.list
      .mockRejectedValueOnce(new Error("Pipeline API unavailable."))
      .mockResolvedValueOnce([])

    render(<PipelineScreen />)

    expect(
      await screen.findByText("Pipeline could not be loaded"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByText("No candidates in this pipeline"),
    ).toBeInTheDocument()
  })
})
