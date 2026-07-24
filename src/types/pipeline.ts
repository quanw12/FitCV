export type PipelineStage = "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected"

export interface PipelineApplication {
  application_id: number
  job_id: number
  job_title: string
  candidate_name: string
  candidate_email: string
  candidate_phone: string
  current_stage: PipelineStage
  status: string
  applied_at: string
  overall_score: number | null
  match_label: string | null
  note_count: number
}

export interface PipelineNote {
  note_id: number
  application_id: number
  author_name: string
  content: string
  created_at: string
  updated_at: string | null
}

export interface PipelineStageHistory {
  stage_history_id: number
  previous_stage: string | null
  new_stage: string
  changed_by_name: string
  changed_at: string
}
