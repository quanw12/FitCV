export interface CvRebuildExperienceItem {
  title: string

  company: string

  location: string

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

export interface CvRebuildLinkItem {
  label: string

  url: string
}

export interface CvRebuildLanguageItem {
  name: string

  proficiency: string
}

export interface CvRebuildPublicationItem {
  title: string

  venue: string

  date: string
}

export interface CvRebuildData {
  name: string

  email: string

  phone: string

  links: CvRebuildLinkItem[]

  summary: string

  experience: CvRebuildExperienceItem[]

  skills: string[]

  projects: CvRebuildProjectItem[]

  certifications: string[]

  education: CvRebuildEducationItem[]

  languages: CvRebuildLanguageItem[]

  publications: CvRebuildPublicationItem[]

  awards: string[]
}

export interface CvRebuildResponse {
  filename: string

  preview_json: CvRebuildData

  pdf_base64: string

  thumbnail_base64: string
}
