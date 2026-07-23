import { requestJson } from "./httpClient"
import type {
  BulkEmailSendResult,
  CandidateEmailDraft,
  EmailTemplate,
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
}
