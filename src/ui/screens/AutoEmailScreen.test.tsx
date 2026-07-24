import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CandidateEmailDraft } from "@/types/emailWorkflow"

const emailMocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  listDrafts: vi.fn(),
  generate: vi.fn(),
  update: vi.fn(),
  approve: vi.fn(),
  send: vi.fn(),
  bulkSend: vi.fn(),
}))
const pipelineMocks = vi.hoisted(() => ({
  list: vi.fn(),
}))

vi.mock("@/api/emailWorkflowApi", () => ({
  emailWorkflowApi: emailMocks,
}))
vi.mock("@/api/pipelineApi", () => ({ pipelineApi: pipelineMocks }))

import AutoEmailScreen from "./AutoEmailScreen"

const draft: CandidateEmailDraft = {
  email_id: 7,
  application_id: 4,
  template_key: "shortlist",
  candidate_name: "Nguyen Minh",
  job_title: "Backend Engineer",
  recipient_email: "minh@example.com",
  subject: "Next steps for your application",
  body: "Dear Nguyen Minh,\n\nWe would like to continue with the next step.",
  status: "Draft",
  ai_generated: true,
  approved_at: null,
  sent_at: null,
  provider_message_id: null,
  error_message: null,
  created_at: "2026-07-23T08:00:00Z",
  updated_at: null,
}

describe("AutoEmailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emailMocks.listTemplates.mockResolvedValue([
      {
        key: "shortlist",
        name: "Shortlist notification",
        description: "Invite a promising candidate to continue.",
      },
    ])
    pipelineMocks.list.mockResolvedValue([
      {
        application_id: 4,
        job_id: 2,
        job_title: "Backend Engineer",
        candidate_name: "Nguyen Minh",
        candidate_email: "minh@example.com",
        candidate_phone: "0900000000",
        current_stage: "Screening",
        status: "Active",
        applied_at: "2026-07-23T08:00:00Z",
        overall_score: 88,
        match_label: "Strong Match",
        note_count: 0,
      },
    ])
    emailMocks.listDrafts.mockResolvedValue([])
    emailMocks.generate.mockResolvedValue(draft)
    emailMocks.update.mockImplementation(
      (_id: number, subject: string, body: string) =>
        Promise.resolve({ ...draft, subject, body }),
    )
    emailMocks.approve.mockResolvedValue({
      ...draft,
      status: "Approved",
      approved_at: "2026-07-23T09:00:00Z",
    })
    emailMocks.send.mockResolvedValue({
      ...draft,
      status: "Sent",
      approved_at: "2026-07-23T09:00:00Z",
      sent_at: "2026-07-23T09:05:00Z",
      provider_message_id: "message-123",
    })
  })

  it("generates a draft but does not send before HR approval", async () => {
    render(<AutoEmailScreen />)
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate AI draft" }),
    )

    expect(
      await screen.findByText(
        "AI draft created. Review and edit it before approving.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve draft" })).toBeEnabled()
    expect(emailMocks.send).not.toHaveBeenCalled()
  })

  it("enforces approve then send and confirms delivery", async () => {
    render(<AutoEmailScreen />)
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate AI draft" }),
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Approve draft" }),
    )

    fireEvent.click(
      await screen.findByRole("button", { name: "Send approved email" }),
    )

    expect(emailMocks.approve).toHaveBeenCalledWith(7)
    expect(emailMocks.send).toHaveBeenCalledWith(7)
    expect(
      await screen.findByText("Email sent to minh@example.com."),
    ).toBeInTheDocument()
  })

  it("shows an empty tracking state", async () => {
    pipelineMocks.list.mockResolvedValue([])

    render(<AutoEmailScreen />)

    expect(await screen.findByText("No email records yet")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Generate AI draft" }),
    ).toBeDisabled()
  })

  it("shows a load error and retries", async () => {
    emailMocks.listTemplates
      .mockRejectedValueOnce(new Error("Email API unavailable."))
      .mockResolvedValueOnce([
        {
          key: "shortlist",
          name: "Shortlist notification",
          description: "Invite a candidate.",
        },
      ])

    render(<AutoEmailScreen />)

    expect(
      await screen.findByText("Email workflow could not be loaded"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(emailMocks.listTemplates).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText("Template library")).toBeInTheDocument()
  })
})
