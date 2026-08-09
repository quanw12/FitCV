import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  CandidateEmailDraft,
  EmailAudienceItem,
  EmailStage,
} from "@/types/emailWorkflow"

const emailMocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  listDrafts: vi.fn(),
  listAudience: vi.fn(),
  createCampaign: vi.fn(),
  generate: vi.fn(),
  update: vi.fn(),

  approve: vi.fn(),

  reopen: vi.fn(),

  send: vi.fn(),

  bulkSend: vi.fn(),

  listThreads: vi.fn(),

  getThread: vi.fn(),

  markThreadRead: vi.fn(),

  generateSmartReply: vi.fn(),
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
  thread_id: 2,
  campaign_id: 11,
  template_key: "shortlist",
  message_kind: "Initial",
  stage_at_generation: "Screening",
  current_stage: "Screening",
  stage_changed_since_generation: false,
  candidate_name: "Nguyen Minh",

  job_title: "Backend Engineer",

  recipient_email: "minh@example.com",

  recipient_email_valid: true,

  reply_to_email: "reply+token@inbound.example.com",

  subject: "Next steps for your application",

  body: "Dear Nguyen Minh,\n\nWe would like to continue with the next step.",

  status: "Draft",

  delivery_status: null,

  retryable: false,

  retry_count: 0,

  last_attempt_at: null,

  ai_generated: true,

  in_reply_to: null,

  approved_at: null,

  sent_at: null,

  provider_message_id: null,

  error_message: null,

  created_at: "2026-07-23T08:00:00Z",

  updated_at: null,
}

const audienceItem: EmailAudienceItem = {
  application_id: 4,
  candidate_name: "Nguyen Minh",
  candidate_email: "minh@example.com",
  job_id: 2,
  job_title: "Backend Engineer",
  current_stage: "Screening",
  applied_at: "2026-07-23T08:00:00Z",
  overall_score: 88,
  match_label: "Strong Match",
  has_email_address: true,
  last_email_template_key: null,
  last_email_sent_at: null,
  already_emailed_for_stage: false,
  pending_draft_email_id: null,
  blocked_reason: null,
}

const audienceResponse = (
  stage: EmailStage,
  eligible: EmailAudienceItem[] = [{ ...audienceItem, current_stage: stage }],
) => ({
  stage,
  template_key: stage === "Rejected" ? "rejection" : "shortlist",
  job_id: null,
  eligible,
  blocked: [],
})

describe("AutoEmailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    emailMocks.listTemplates.mockResolvedValue([
      {
        key: "shortlist",
        name: "Shortlist notification",
        description: "Invite a promising candidate to continue.",
        allowed_stages: ["Screening"],
        default_stage: "Screening",
      },
      {
        key: "rejection",
        name: "Rejection",
        description: "Close a candidate application respectfully.",
        allowed_stages: ["Rejected"],
        default_stage: "Rejected",
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
    emailMocks.listAudience.mockImplementation((stage: EmailStage) =>
      Promise.resolve(audienceResponse(stage)),
    )
    emailMocks.listThreads.mockResolvedValue([])
    emailMocks.generate.mockResolvedValue(draft)
    emailMocks.createCampaign.mockResolvedValue({
      campaign_id: 11,
      template_key: "shortlist",
      target_stage: "Screening",
      interview_date: null,
      ai_generated: true,
      recipient_count: 1,
      shared_body_skeleton: "Dear {{candidate_name}},\n\nShared campaign body",
      drafts: [draft],
      skipped: [],
    })
    emailMocks.update.mockImplementation(
      (_id: number, subject: string, body: string) =>
        Promise.resolve({ ...draft, subject, body }),
    )

    emailMocks.approve.mockResolvedValue({
      ...draft,

      status: "Approved",

      approved_at: "2026-07-23T09:00:00Z",
    })

    emailMocks.reopen.mockResolvedValue({
      ...draft,

      status: "Draft",

      delivery_status: null,

      error_message: null,
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
    const selectAll = await screen.findByRole("button", {
      name: "Select all eligible",
    })
    await waitFor(() => expect(selectAll).toBeEnabled())
    fireEvent.click(selectAll)
    fireEvent.click(
      screen.getByRole("button", { name: "Generate for 1 candidate" }),
    )

    expect(
      await screen.findByText(
        "AI draft created. Review and edit it before approving.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve draft" })).toBeEnabled()
    expect(emailMocks.createCampaign).toHaveBeenCalledWith({
      application_ids: [4],
      template_key: "shortlist",
      guidance: "",
      interview_lead_days: 3,
      interview_window: "09:00-17:00 ICT",
    })
    expect(emailMocks.send).not.toHaveBeenCalled()
  })

  it("warns when the active draft recipient email is invalid", async () => {
    emailMocks.listDrafts.mockResolvedValue([
      {
        ...draft,
        recipient_email: "legacy-address",
        recipient_email_valid: false,
      },
    ])

    render(<AutoEmailScreen />)

    expect(
      await screen.findByText(
        "Candidate email address is missing or invalid. Update it before sending.",
      ),
    ).toBeInTheDocument()
  })

  it("enforces approve then send and confirms delivery", async () => {
    render(<AutoEmailScreen />)
    const selectAll = await screen.findByRole("button", {
      name: "Select all eligible",
    })
    await waitFor(() => expect(selectAll).toBeEnabled())
    fireEvent.click(selectAll)
    fireEvent.click(
      screen.getByRole("button", { name: "Generate for 1 candidate" }),
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
    emailMocks.listAudience.mockImplementation((stage: EmailStage) =>
      Promise.resolve(audienceResponse(stage, [])),
    )

    render(<AutoEmailScreen />)

    expect(await screen.findByText("No email records yet")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Generate for 0 candidates" }),
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
          allowed_stages: ["Screening"],
          default_stage: "Screening",
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

    expect(
      await screen.findByText("Create a candidate email campaign"),
    ).toBeInTheDocument()
  })

  it("reopens a failed email for a new HR review", async () => {
    emailMocks.listDrafts.mockResolvedValue([
      {
        ...draft,

        status: "Failed",

        delivery_status: "Failed",

        approved_at: "2026-07-23T09:00:00Z",

        error_message: "Provider temporarily unavailable.",
      },
    ])

    render(<AutoEmailScreen />)

    fireEvent.click(
      await screen.findByRole("button", { name: "Reopen for review" }),
    )

    await waitFor(() => {
      expect(emailMocks.reopen).toHaveBeenCalledWith(7)
    })

    expect(
      await screen.findByText(
        "Draft reopened. Review it and approve again before sending.",
      ),
    ).toBeInTheDocument()
  })

  it("loads the Rejected audience when HR selects that stage", async () => {
    const second = {
      ...audienceItem,
      application_id: 5,
      candidate_name: "Tran Ha",
      candidate_email: "ha@example.com",
      current_stage: "Rejected" as const,
    }
    emailMocks.listAudience.mockImplementation((stage: EmailStage) =>
      Promise.resolve(
        audienceResponse(
          stage,
          stage === "Rejected"
            ? [{ ...audienceItem, current_stage: "Rejected" }, second]
            : [{ ...audienceItem, current_stage: stage }],
        ),
      ),
    )

    render(<AutoEmailScreen />)
    fireEvent.click(await screen.findByRole("button", { name: /Rejected/ }))

    await waitFor(() => {
      expect(emailMocks.listAudience).toHaveBeenCalledWith(
        "Rejected",
        undefined,
      )
    })
    expect(await screen.findByText("Tran Ha")).toBeInTheDocument()
  })

  it("selects the eligible audience and generates one rejection campaign", async () => {
    const recipients = [
      { ...audienceItem, current_stage: "Rejected" as const },
      {
        ...audienceItem,
        application_id: 5,
        candidate_name: "Tran Ha",
        candidate_email: "ha@example.com",
        current_stage: "Rejected" as const,
      },
    ]
    emailMocks.listAudience.mockImplementation((stage: EmailStage) =>
      Promise.resolve(
        audienceResponse(
          stage,
          stage === "Rejected"
            ? recipients
            : [{ ...audienceItem, current_stage: stage }],
        ),
      ),
    )

    render(<AutoEmailScreen />)
    fireEvent.click(await screen.findByRole("button", { name: /Rejected/ }))
    const selectAll = await screen.findByRole("button", {
      name: "Select all eligible",
    })
    await waitFor(() => expect(selectAll).toBeEnabled())
    fireEvent.click(selectAll)
    fireEvent.click(
      screen.getByRole("button", { name: "Generate for 2 candidates" }),
    )

    await waitFor(() => {
      expect(emailMocks.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          application_ids: [4, 5],
          template_key: "rejection",
        }),
      )
    })
  })

  it("shows an audience empty state and keeps generation disabled", async () => {
    emailMocks.listAudience.mockImplementation((stage: EmailStage) =>
      Promise.resolve(audienceResponse(stage, [])),
    )

    render(<AutoEmailScreen />)

    expect(
      await screen.findByText("No candidates in Screening"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Generate for 0 candidates" }),
    ).toBeDisabled()
  })

  it("marks stale-stage drafts and prevents selecting them for bulk send", async () => {
    emailMocks.listDrafts.mockResolvedValue([
      {
        ...draft,
        status: "Approved",
        stage_at_generation: "Rejected",
        current_stage: "Interview",
        stage_changed_since_generation: true,
      },
    ])

    render(<AutoEmailScreen />)

    expect(await screen.findAllByText("Stage changed")).not.toHaveLength(0)
    expect(
      screen.getByRole("checkbox", {
        name: "Select email for Nguyen Minh",
      }),
    ).toBeDisabled()
  })
})
