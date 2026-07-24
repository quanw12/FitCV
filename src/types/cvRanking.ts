export interface CvScoreBreakdown {
  skills: number
  experience: number
  education: number
  softSkills: number
}

export interface ParsedCvCandidate {
  id: string
  sourceIndex: number
  fileName: string
  fileType: 'PDF' | 'DOCX'
  fileSizeLabel: string
  name: string
  email: string
  phone: string
  location: string
  position: string
  skills: string[]
  matchedSkills: string[]
  missingSkills: string[]
  experienceYears: number
  education: string
  score: number
  matchLabel: string
  scoreBreakdown: CvScoreBreakdown
  status: 'Ready' | 'Failed'
  strengths: string[]
  weaknesses: string[]
  parseNotes: string[]
}

export interface BatchParseCvResponse {
  requiredSkills: string[]
  preferredSkills: string[]
  candidates: ParsedCvCandidate[]
  warnings: string[]
}

export type CvAnalysisStatus = 'Pending' | 'Processing' | 'Failed' | 'Success'

export interface RankingCandidate {
  full_name: string
  email: string
  phone: string
}

export interface RankingCvFile {
  file_name: string
  file_type: string
  file_size_kb: number
}

export interface RankingBreakdown {
  skills?: number | null
  experience?: number | null
  education?: number | null
  soft_skills?: number | null
  [criterion: string]: number | null | undefined
}

export interface RankedApplication {
  application_id: number
  job_id: number
  current_stage: string
  status: string
  applied_at: string
  candidate: RankingCandidate
  cv: RankingCvFile
  parse_status: CvAnalysisStatus | string
  parse_error: string | null
  analysis_status: CvAnalysisStatus | string
  analysis_error: string | null
  algorithm_version: string | null
  overall_score: number | null
  match_label: string | null
  pass_probability: number | null
  breakdown: RankingBreakdown | null
  parsed_cv: Record<string, unknown> | null
}
