export interface EmailTemplate {
  key: string
  name: string
  description: string
}

export type CandidateEmailStatus = "Draft" | "Approved" | "Sent" | "Failed"

export interface CandidateEmailDraft {
  email_id: number
  application_id: number
  template_key: string
  candidate_name: string
  job_title: string
  recipient_email: string
  subject: string
  body: string
  status: CandidateEmailStatus
  ai_generated: boolean
  approved_at: string | null
  sent_at: string | null
  provider_message_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string | null
}

export interface BulkEmailSendResult {
  sent_count: number
  failed_count: number
  results: Array<{
    email_id: number
    status: string
    error_message: string | null
  }>
}
