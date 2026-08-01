import { requestJson } from "./httpClient"
import type {
  BulkEmailSendResult,
  CandidateEmailDraft,
  EmailThreadDetail,
  EmailThreadSummary,
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
  generate: (applicationId: number, templateKey: string) =>
    requestJson<CandidateEmailDraft>("/api/hr/emails/drafts/generate", {
      authenticated: true,
      method: "POST",
      body: JSON.stringify({
        application_id: applicationId,
        template_key: templateKey,
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
    guidance?: string,
  ) =>
    requestJson<CandidateEmailDraft>(
      `/api/hr/emails/threads/${threadId}/smart-reply`,
      {
        authenticated: true,
        method: "POST",
        body: JSON.stringify({
          tone,
          guidance: guidance?.trim() || null,
        }),
      },
    ),
}
