import type { AsyncStatus } from './app'

export type SuggestionPriority = 'Low' | 'Medium' | 'High'
export type CvSection = 'Summary' | 'WorkExperience' | 'Skills' | 'Education' | 'Projects' | 'Other'

export interface SkillGap {
  id: string
  skill: string
  priority: SuggestionPriority
  reason: string
  jdEvidence: string
}

export interface SectionFeedback {
  id: string
  section: CvSection
  issue: string
  explanation: string
  priority: SuggestionPriority
  suggestedAction: string
}

export interface RewriteSuggestion {
  id: string
  section: CvSection
  originalText: string
  issue: string
  suggestedText: string
  framework: string
}

export interface QuickWin {
  id: string
  title: string
  category: string
  priority: SuggestionPriority
  explanation: string
}

export interface ImprovementReport {
  skillGaps: SkillGap[]
  sectionFeedback: SectionFeedback[]
  rewriteSuggestions: RewriteSuggestion[]
  quickWins: QuickWin[]
}

export interface ImprovementReportResponse {
  matchResultId: string
  status: AsyncStatus
  generatedAt: string | null
  errorMessage: string | null
  overallScore: number | null
  stale: boolean
  report: ImprovementReport | null
}

export interface GenerateImprovementResponse {
  matchResultId: string
  status: AsyncStatus
  taskId: string | null
}
