import { requestJson } from "./httpClient"

import type {
  BulkEmailSendResult,
  CampaignPreview,
  CandidateEmailDraft,
  EmailAudienceResponse,
  EmailStage,
  EmailThreadDetail,
  EmailThreadSummary,
  SmartReplyBatchResult,
  SmartReplyIntent,
  EmailTemplate,
  SmartReplyTone,
} from "@/types/emailWorkflow"

export const emailWorkflowApi = {
  listTemplates: () =>
    requestJson<EmailTemplate[]>("/api/hr/emails/templates", {
      authenticated: true,
    }),

  listDrafts: (jobId?: number) =>
    requestJson<CandidateEmailDraft[]>(
      `/api/hr/emails/drafts${jobId ? `?job_id=${jobId}` : ""}`,

      { authenticated: true },
    ),
  listAudience: (stage: EmailStage, jobId?: number) => {
    const params = new URLSearchParams({ stage })
    if (jobId != null) params.set("job_id", String(jobId))
    return requestJson<EmailAudienceResponse>(
      `/api/hr/emails/audience?${params.toString()}`,
      { authenticated: true },
    )
  },
  createCampaign: (payload: {
    application_ids: number[]
    template_key: string
    guidance?: string
    interview_lead_days?: number
    interview_window?: string
    allow_resend?: boolean
  }) =>
    requestJson<CampaignPreview>("/api/hr/emails/campaigns", {
      authenticated: true,
      method: "POST",
      body: JSON.stringify({
        ...payload,
        guidance: payload.guidance?.trim() || null,
        interview_window: payload.interview_window?.trim() || null,
      }),
    }),
  generate: (applicationId: number, templateKey: string, guidance?: string) =>
    requestJson<CandidateEmailDraft>("/api/hr/emails/drafts/generate", {
      authenticated: true,

      method: "POST",

      body: JSON.stringify({
        application_id: applicationId,
        template_key: templateKey,
        guidance: guidance?.trim() || null,
      }),
    }),

  update: (emailId: number, subject: string, body: string) =>
    requestJson<CandidateEmailDraft>(`/api/hr/emails/drafts/${emailId}`, {
      authenticated: true,

      method: "PATCH",

      body: JSON.stringify({ subject, body }),
    }),

  approve: (emailId: number) =>
    requestJson<CandidateEmailDraft>(
      `/api/hr/emails/drafts/${emailId}/approve`,

      { authenticated: true, method: "POST" },
    ),

  reopen: (emailId: number) =>
    requestJson<CandidateEmailDraft>(
      `/api/hr/emails/drafts/${emailId}/reopen`,

      { authenticated: true, method: "POST" },
    ),

  send: (emailId: number) =>
    requestJson<CandidateEmailDraft>(`/api/hr/emails/drafts/${emailId}/send`, {
      authenticated: true,

      method: "POST",
    }),

  bulkSend: (emailIds: number[]) =>
    requestJson<BulkEmailSendResult>("/api/hr/emails/bulk-send", {
      authenticated: true,

      method: "POST",

      body: JSON.stringify({ email_ids: emailIds }),
    }),

  bulkSendProgress: (jobId: number) =>
    requestJson<BulkEmailSendResult>(
      "/api/hr/emails/bulk-send/" + jobId,
      {
        authenticated: true,
      },
    ),

  listThreads: () =>
    requestJson<EmailThreadSummary[]>("/api/hr/emails/threads", {
      authenticated: true,
    }),

  getThread: (threadId: number) =>
    requestJson<EmailThreadDetail>(`/api/hr/emails/threads/${threadId}`, {
      authenticated: true,
    }),

  markThreadRead: (threadId: number) =>
    requestJson<{ thread_id: number; unread_count: number }>(
      `/api/hr/emails/threads/${threadId}/read`,

      {
        authenticated: true,

        method: "PATCH",
      },
    ),

  generateSmartReply: (
    threadId: number,
    tone: SmartReplyTone,
    intent: SmartReplyIntent,
    guidance?: string,
  ) =>
    requestJson<CandidateEmailDraft>(
      `/api/hr/emails/threads/${threadId}/smart-reply`,

      {
        authenticated: true,

        method: "POST",

        body: JSON.stringify({
          tone,
          intent,
          guidance: guidance?.trim() || null,
        }),
      },
    ),
  generateSmartReplyBatch: (
    threadIds: number[],
    tone: SmartReplyTone,
    intent: SmartReplyIntent,
    guidance?: string,
    interviewLeadDays = 3,
  ) =>
    requestJson<SmartReplyBatchResult>(
      "/api/hr/emails/threads/smart-reply/batch",
      {
        authenticated: true,
        method: "POST",
        body: JSON.stringify({
          thread_ids: threadIds,
          tone,
          intent,
          guidance: guidance?.trim() || null,
          interview_lead_days: interviewLeadDays,
        }),
      },
    ),
}
