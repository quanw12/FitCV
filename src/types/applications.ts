export type ApplicationStage =
  | "Applied"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected"

export type ApplicationStatus = "Active" | "Withdrawn" | "Rejected" | "Hired"

export type ApplicationProcessingStatus =
  | "Pending"
  | "Processing"
  | "Success"
  | "Failed"

export interface ApplicationCompany {
  name: string
  logo_url: string | null
  website_url: string | null
}

export interface ApplicationJob {
  title: string
  location: string | null
  employment_type: string | null
  job_status: string
  company: ApplicationCompany
}

export interface ApplicationCv {
  file_name: string
}

export interface StudentApplication {
  application_id: number
  job_id: number
  current_stage: ApplicationStage
  status: ApplicationStatus
  applied_at: string
  updated_at: string | null
  job: ApplicationJob
  cv: ApplicationCv
  parse_status: ApplicationProcessingStatus
  analysis_status: ApplicationProcessingStatus
  analysis_error: string | null
}

export interface RetryApplicationAnalysisResponse {
  application_id: number
  analysis_status: "Pending"
}
