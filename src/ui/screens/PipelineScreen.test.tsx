import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PipelineApplication } from "@/types/pipeline"

const pipelineMocks = vi.hoisted(() => ({
  list: vi.fn(),
  moveStage: vi.fn(),
  bulkMoveStage: vi.fn(),
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

const secondApplication: PipelineApplication = {
  ...application,
  application_id: 5,
  job_id: 3,
  job_title: "Data Engineer",
  candidate_name: "Tran An",
  candidate_email: "an@example.com",
  current_stage: "Interview",
  overall_score: 42,
}

describe("PipelineScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    jobsMocks.listManaged.mockResolvedValue([])
    pipelineMocks.list.mockResolvedValue([application, secondApplication])
    pipelineMocks.listNotes.mockResolvedValue([])
    pipelineMocks.listHistory.mockResolvedValue([])
    pipelineMocks.moveStage.mockImplementation((_id: number, stage: string) =>
      Promise.resolve({ ...application, current_stage: stage }),
    )
    pipelineMocks.bulkMoveStage.mockResolvedValue({
      updated: [
        { ...application, current_stage: "Offer" },
        { ...secondApplication, current_stage: "Offer" },
      ],
      skipped_application_ids: [],
      history_ids: [10, 11],
    })
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

    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }))

    await waitFor(() => {
      expect(pipelineMocks.moveStage).toHaveBeenCalledWith(4, "Interview")
    })
    expect(
      await screen.findByText("Saved 1 stage change."),
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

  it("selects visible candidates and filters by stage and score", async () => {
    render(<PipelineScreen />)

    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select Nguyen Minh" }),
    )
    expect(screen.getByText("1 selected · 2 shown")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Filter pipeline by stage"), {
      target: { value: "Interview" },
    })
    expect(screen.getByText("1 selected · 1 shown")).toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", { name: "Select Nguyen Minh" }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Filter pipeline by score"), {
      target: { value: "weak" },
    })
    expect(screen.getByText("1 selected · 1 shown")).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: "Select Tran An" }),
    ).toBeInTheDocument()
  })

  it("moves the selected candidates through the bulk stage action", async () => {
    render(<PipelineScreen />)

    fireEvent.click(
      await screen.findByRole("button", { name: "Select all visible" }),
    )
    fireEvent.change(screen.getByLabelText("Bulk target stage"), {
      target: { value: "Offer" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Move selected" }))
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }))

    await waitFor(() => {
      expect(pipelineMocks.bulkMoveStage).toHaveBeenCalledWith([4, 5], "Offer")
    })
    expect(
      await screen.findByText("Saved 2 stage changes."),
    ).toBeInTheDocument()
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
