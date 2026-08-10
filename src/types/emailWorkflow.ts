export type EmailStage = "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected"

export interface EmailTemplate {
  key: string
  name: string
  description: string
  allowed_stages: EmailStage[] | null
  default_stage: EmailStage | null
}

export type CandidateEmailStatus =
  | "Draft"
  | "Approved"
  | "Sent"
  | "Failed"
  | "Invalidated"

export interface CandidateEmailDraft {
  email_id: number

  application_id: number
  thread_id: number | null
  campaign_id: number | null
  template_key: string
  message_kind: "Initial" | "Reply"
  stage_at_generation: EmailStage | null
  current_stage: EmailStage
  stage_changed_since_generation: boolean
  candidate_name: string

  job_title: string

  recipient_email: string

  reply_to_email: string | null

  subject: string

  body: string

  status: CandidateEmailStatus

  delivery_status: string | null

  retryable: boolean

  retry_count: number

  last_attempt_at: string | null

  ai_generated: boolean

  in_reply_to: string | null

  approved_at: string | null

  sent_at: string | null

  provider_message_id: string | null

  error_message: string | null

  created_at: string

  updated_at: string | null
}

export interface EmailAudienceItem {
  application_id: number
  candidate_name: string
  candidate_email: string
  job_id: number
  job_title: string
  current_stage: EmailStage
  applied_at: string
  overall_score: number | null
  match_label: string | null
  has_email_address: boolean
  last_email_template_key: string | null
  last_email_sent_at: string | null
  already_emailed_for_stage: boolean
  pending_draft_email_id: number | null
  blocked_reason: string | null
}

export interface EmailAudienceResponse {
  stage: EmailStage
  template_key: string
  job_id: number | null
  eligible: EmailAudienceItem[]
  blocked: EmailAudienceItem[]
}

export interface CampaignPreview {
  campaign_id: number
  template_key: string
  target_stage: EmailStage
  interview_date: string | null
  ai_generated: boolean
  recipient_count: number
  shared_body_skeleton: string
  drafts: CandidateEmailDraft[]
  skipped: EmailAudienceItem[]
}

export interface BulkEmailSendResult {
  job_id: number
  status: string
  total_count: number
  sent_count: number
  failed_count: number
  created_at: string
  finished_at: string | null
  results: Array<{
    email_id: number

    status: string

    error_message: string | null
  }>
}

export type SmartReplyTone = "professional" | "warm" | "concise"
export type SmartReplyIntent = "general" | "answer_question" | "interview_details" | "application_update" | "rejection_follow_up"

export interface EmailThreadMessage {
  message_id: string

  direction: "Inbound" | "Outbound"

  email_id: number | null

  inbound_id: number | null

  subject: string

  body: string

  status: string

  delivery_status: string | null

  retryable: boolean

  ai_generated: boolean

  provider_message_id: string | null

  occurred_at: string

  fetch_status?: string | null

  fetch_error?: string | null
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

  inbound_replies_enabled?: boolean

  has_fetched_inbound?: boolean
}

export interface EmailThreadDetail extends EmailThreadSummary {
  messages: EmailThreadMessage[]
}

export interface SmartReplyBatchResult {
  drafts: CandidateEmailDraft[]
  skipped: Array<{
    thread_id: number
    reason: string
  }>
}
