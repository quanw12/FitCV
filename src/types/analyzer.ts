import type { AsyncStatus, MatchLabel } from "./app"

export interface CvVersion {
  cvId: number
  fileName: string
  fileType: "PDF" | "DOCX"
  fileSizeKb: number | null
  versionNumber: number
  isLatest: boolean
  uploadedAt: string
  parseStatus: AsyncStatus
  parserVersion: string | null
  errorMessage: string | null
}

export interface AnalyzeCvRequest {
  cvId: number
  jobDescription: string
  title?: string
}

export interface CategoryEvidence {
  score: number
  matched: string[]
  missing: string[]
  detail: string
}

export interface MatchAnalysis {
  matchResultId: string
  status: AsyncStatus
  cvId: number
  jobDescriptionId: number | null
  title: string
  overallScore: number | null
  matchLabel: MatchLabel | null
  passProbability: number | null
  breakdown: Partial<Record<"skills" | "experience" | "education" | "soft_skills", CategoryEvidence>>
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  algorithmVersion: string
  errorMessage: string | null
  generatedAt: string
  completedAt: string | null
  disclaimer: string
}

export interface AnalyzerDraftState {
  cvFile: File | null
  uploadedCvId: number | null
  jdText: string
  result: MatchAnalysis | null
}
