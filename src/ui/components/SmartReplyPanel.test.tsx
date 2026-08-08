import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  CandidateEmailDraft,
  EmailThreadDetail,
  EmailThreadSummary,
} from "@/types/emailWorkflow"

const mocks = vi.hoisted(() => ({
  listThreads: vi.fn(),

  getThread: vi.fn(),

  markThreadRead: vi.fn(),
  generateSmartReply: vi.fn(),
  generateSmartReplyBatch: vi.fn(),
  update: vi.fn(),

  approve: vi.fn(),

  send: vi.fn(),
}))

vi.mock("@/api/emailWorkflowApi", () => ({
  emailWorkflowApi: mocks,
}))

import SmartReplyPanel from "./SmartReplyPanel"

const summary: EmailThreadSummary = {
  thread_id: 3,

  application_id: 4,

  candidate_name: "Nguyen Minh",

  candidate_email: "minh@example.com",

  job_title: "Backend Engineer",

  current_stage: "Interview",

  subject: "Next steps",

  reply_to_email: "reply+token@inbound.example.com",

  last_message_at: "2026-07-30T08:00:00Z",

  last_inbound_at: "2026-07-30T08:00:00Z",

  unread_count: 1,

  last_message_preview: "Could you share the interview schedule?",
}

const detail: EmailThreadDetail = {
  ...summary,

  messages: [
    {
      message_id: "outbound-6",

      direction: "Outbound",

      email_id: 6,

      inbound_id: null,

      subject: "Next steps",

      body: "We would like to continue with your application.",

      status: "Sent",

      delivery_status: "Delivered",

      retryable: false,

      ai_generated: true,

      provider_message_id: "resend-6",

      occurred_at: "2026-07-29T08:00:00Z",
    },

    {
      message_id: "inbound-8",

      direction: "Inbound",

      email_id: null,

      inbound_id: 8,

      subject: "Re: Next steps",

      body: "Could you share the interview schedule?",

      status: "Received",

      delivery_status: null,

      retryable: false,

      ai_generated: false,

      provider_message_id: "<candidate-message@example.com>",

      occurred_at: "2026-07-30T08:00:00Z",
    },
  ],
}

const draft: CandidateEmailDraft = {
  email_id: 9,

  application_id: 4,
  thread_id: 3,
  campaign_id: null,
  template_key: "smart-reply",
  message_kind: "Reply",
  stage_at_generation: "Interview",
  current_stage: "Interview",
  stage_changed_since_generation: false,
  candidate_name: "Nguyen Minh",

  job_title: "Backend Engineer",

  recipient_email: "minh@example.com",

  reply_to_email: "reply+token@inbound.example.com",

  subject: "Re: Next steps",

  body: "Dear Nguyen Minh,\n\nThe recruiting team will follow up shortly.",

  status: "Draft",

  delivery_status: null,

  retryable: false,

  retry_count: 0,

  last_attempt_at: null,

  ai_generated: true,

  in_reply_to: "<candidate-message@example.com>",

  approved_at: null,

  sent_at: null,

  provider_message_id: null,

  error_message: null,

  created_at: "2026-07-30T08:05:00Z",

  updated_at: null,
}

describe("SmartReplyPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.listThreads.mockResolvedValue([summary])

    mocks.getThread.mockResolvedValue(detail)

    mocks.markThreadRead.mockResolvedValue({
      thread_id: 3,

      unread_count: 0,
    })

    mocks.generateSmartReply.mockResolvedValue(draft)
    mocks.generateSmartReplyBatch.mockResolvedValue({
      drafts: [draft],
      skipped: [],
    })
    mocks.approve.mockResolvedValue({
      ...draft,

      status: "Approved",

      approved_at: "2026-07-30T08:06:00Z",
    })

    mocks.send.mockResolvedValue({
      ...draft,

      status: "Sent",

      delivery_status: "Sent",

      approved_at: "2026-07-30T08:06:00Z",

      sent_at: "2026-07-30T08:07:00Z",

      provider_message_id: "resend-9",
    })
  })

  it("requires HR approval before sending an AI Smart Reply", async () => {
    render(<SmartReplyPanel />)

    fireEvent.click(
      await screen.findByRole(
        "button",

        { name: "Generate Smart Reply" },

        { timeout: 10_000 },
      ),
    )

    expect(
      await screen.findByText(
        "Smart Reply drafted. HR review is required before sending.",
      ),
    ).toBeInTheDocument()
    expect(mocks.generateSmartReply).toHaveBeenCalledWith(
      3,
      "professional",
      "general",
      "",
    )
    expect(mocks.send).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Approve reply" }))

    fireEvent.click(
      await screen.findByRole("button", { name: "Send approved reply" }),
    )

    await waitFor(() => {
      expect(mocks.approve).toHaveBeenCalledWith(9)

      expect(mocks.send).toHaveBeenCalledWith(9)
    })
  })

  it("generates one shared batch for two inbound conversations", async () => {
    const second: EmailThreadSummary = {
      ...summary,
      thread_id: 8,
      application_id: 9,
      candidate_name: "Tran Ha",
      candidate_email: "ha@example.com",
    }
    mocks.listThreads.mockResolvedValue([summary, second])
    mocks.generateSmartReplyBatch.mockResolvedValue({
      drafts: [
        draft,
        {
          ...draft,
          email_id: 10,
          application_id: 9,
          thread_id: 8,
          candidate_name: "Tran Ha",
          recipient_email: "ha@example.com",
        },
      ],
      skipped: [],
    })

    render(<SmartReplyPanel />)
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select conversation with Nguyen Minh",
      }),
    )
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select conversation with Tran Ha",
      }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate reply for 2 conversations",
      }),
    )

    await waitFor(() => {
      expect(mocks.generateSmartReplyBatch).toHaveBeenCalledWith(
        [3, 8],
        "professional",
        "general",
        "",
      )
    })
    expect(await screen.findByText("2 drafted, 0 skipped.")).toBeInTheDocument()
  })

  it("disables batch selection until a thread has an inbound message", async () => {
    mocks.listThreads.mockResolvedValue([
      {
        ...summary,
        thread_id: 12,
        candidate_name: "Le An",
        last_inbound_at: null,
        last_message_preview: "Waiting for reply",
      },
    ])

    render(<SmartReplyPanel />)

    expect(
      await screen.findByRole("checkbox", {
        name: "Select conversation with Le An",
      }),
    ).toBeDisabled()
  })
})
