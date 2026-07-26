export type JobStatus = "Draft" | "Published" | "Closed"

export interface JobCompany {
  name: string
  logo_url: string | null
  website_url: string | null
}

export interface JobPost {
  job_id: number
  title: string
  description: string | null
  about_job: string | null
  responsibilities: string | null
  requirements: string | null
  we_offer: string | null
  life_at_company: string | null
  hiring_process: string | null
  location: string | null
  employment_type: string | null
  status: JobStatus
  deadline: string | null
  archived_at: string | null
  skill_weight: number
  experience_weight: number
  education_weight: number
  soft_skill_weight: number
  openings_count: number
  application_count: number
  created_at: string
  updated_at: string | null
  company: JobCompany
}

export interface JobWrite {
  title: string
  description?: string | null
  about_job?: string | null
  responsibilities?: string | null
  requirements?: string | null
  we_offer?: string | null
  life_at_company?: string | null
  hiring_process?: string | null
  location?: string | null
  employment_type?: string | null
  deadline?: string | null
  openings_count?: number
  skill_weight?: number
  experience_weight?: number
  education_weight?: number
  soft_skill_weight?: number
}

export interface JobApplicationWrite {
  fullName: string
  email: string
  phone: string
  file: File
}

export interface JobApplicationCreated {
  application_id: number
  cv_id: number
  match_result_id: number
  analysis_status: string
}

export interface JobExtraction {
  title: string
  about_job: string
  responsibilities: string
  requirements: string
  we_offer: string
  life_at_company: string
  hiring_process: string
  location: string
  employment_type: string
  required_skills: string[]
  preferred_skills: string[]
  experience_summary: string
  warnings: string[]
}
