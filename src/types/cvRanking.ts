export interface CvScoreBreakdown {
  skills: number
  experience: number
  education: number
}

export interface ParsedCvCandidate {
  id: string
  fileName: string
  fileType: 'PDF' | 'DOCX'
  fileSizeLabel: string
  name: string
  email: string
  phone: string
  location: string
  position: string
  skills: string[]
  missingSkills: string[]
  experienceYears: number
  education: string
  score: number
  scoreBreakdown: CvScoreBreakdown
  status: 'Ready' | 'Failed'
  parseNotes: string[]
}

export interface BatchParseCvResponse {
  requiredSkills: string[]
  candidates: ParsedCvCandidate[]
  warnings: string[]
}
