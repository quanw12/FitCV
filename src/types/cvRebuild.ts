export interface CvRebuildExperienceItem {
  title: string

  company: string

  date: string

  bullets: string[]
}

export interface CvRebuildProjectItem {
  name: string

  description: string
}

export interface CvRebuildEducationItem {
  degree: string

  institution: string

  date: string
}

export interface CvRebuildData {
  name: string

  email: string

  phone: string

  summary: string

  experience: CvRebuildExperienceItem[]

  skills: string[]

  projects: CvRebuildProjectItem[]

  certifications: string[]

  education: CvRebuildEducationItem[]
}

export interface CvRebuildResponse {
  filename: string

  preview_json: CvRebuildData

  pdf_base64: string

  thumbnail_base64: string
}
