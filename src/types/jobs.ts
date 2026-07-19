export type JobStatus = 'Draft' | 'Published' | 'Closed'

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
}
