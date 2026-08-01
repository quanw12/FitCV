export interface EmailTemplate {
  key: string
  name: string
  description: string
}

export type CandidateEmailStatus = "Draft" | "Approved" | "Sent" | "Failed"

export interface CandidateEmailDraft {
  email_id: number
  application_id: number
  thread_id: number | null
  template_key: string
  message_kind: "Initial" | "Reply"
  candidate_name: string
  job_title: string
  recipient_email: string
  reply_to_email: string | null
  subject: string
  body: string
  status: CandidateEmailStatus
  delivery_status: string | null
  ai_generated: boolean
  in_reply_to: string | null
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

export type SmartReplyTone = "professional" | "warm" | "concise"

export interface EmailThreadMessage {
  message_id: string
  direction: "Inbound" | "Outbound"
  email_id: number | null
  inbound_id: number | null
  subject: string
  body: string
  status: string
  delivery_status: string | null
  ai_generated: boolean
  provider_message_id: string | null
  occurred_at: string
}

export interface EmailThreadSummary {
  thread_id: number
  application_id: number
  candidate_name: string
  candidate_email: string
  job_title: string
  current_stage: string
  subject: string | null
  reply_to_email: string | null
  last_message_at: string
  last_inbound_at: string | null
  unread_count: number
  last_message_preview: string | null
}

export interface EmailThreadDetail extends EmailThreadSummary {
  messages: EmailThreadMessage[]
}
