import type { AsyncStatus } from '@/types/app'
import type {
  GenerateImprovementResponse,
  ImprovementReport,
  ImprovementReportResponse,
  SuggestionPriority,
} from '@/types/improvement'
import { requestJson } from './httpClient'

interface BackendReport {
  skill_gaps: Array<{ skill: string; priority: SuggestionPriority; reason: string; jd_evidence: string }>
  section_feedback: Array<{ section: string; issue: string; explanation: string; priority: SuggestionPriority; suggested_action: string }>
  rewrite_suggestions: Array<{ section: string; original_text: string; issue: string; suggested_text: string; framework: string }>
  quick_wins: Array<{ title: string; category: string; priority: SuggestionPriority; explanation: string }>
}

interface BackendReportResponse {
  match_result_id: number
  status: AsyncStatus
  generated_at: string | null
  error_message: string | null
  overall_score: number | null
  stale: boolean
  report: BackendReport | null
}

interface BackendGenerateResponse {
  match_result_id: number
  status: AsyncStatus
  task_id: number | null
}

function stableId(prefix: string, parts: string[]): string {
  let hash = 0
  for (const char of parts.join('|')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return `${prefix}-${Math.abs(hash)}`
}

function normalizeSection(value: string): 'Summary' | 'WorkExperience' | 'Skills' | 'Education' | 'Projects' | 'Other' {
  const allowed = ['Summary', 'WorkExperience', 'Skills', 'Education', 'Projects'] as const
  return allowed.find(section => section === value) ?? 'Other'
}

function normalizeReport(report: BackendReport): ImprovementReport {
  return {
    skillGaps: report.skill_gaps.map(item => ({
      ...item,
      id: stableId('skill', [item.skill]),
      jdEvidence: item.jd_evidence,
    })),
    sectionFeedback: report.section_feedback.map(item => ({
      ...item,
      id: stableId('feedback', [item.section, item.issue]),
      section: normalizeSection(item.section),
      suggestedAction: item.suggested_action,
    })),
    rewriteSuggestions: report.rewrite_suggestions.map(item => ({
      id: stableId('rewrite', [item.section, item.original_text]),
      section: normalizeSection(item.section),
      originalText: item.original_text,
      issue: item.issue,
      suggestedText: item.suggested_text,
      framework: item.framework,
    })),
    quickWins: report.quick_wins.map(item => ({
      ...item,
      id: stableId('quick', [item.title]),
    })),
  }
}

function normalizeResponse(payload: BackendReportResponse): ImprovementReportResponse {
  return {
    matchResultId: String(payload.match_result_id),
    status: payload.status,
    generatedAt: payload.generated_at,
    errorMessage: payload.error_message,
    overallScore: payload.overall_score,
    stale: payload.stale,
    report: payload.report ? normalizeReport(payload.report) : null,
  }
}

export const improvementApi = {
  async generateReport(matchResultId: string, regenerate = false): Promise<GenerateImprovementResponse> {
    const payload = await requestJson<BackendGenerateResponse>(
      `/api/match-results/${matchResultId}/improvement-report/generate?regenerate=${regenerate}`,
      { method: 'POST', authenticated: true },
    )
    return {
      matchResultId: String(payload.match_result_id),
      status: payload.status,
      taskId: payload.task_id == null ? null : String(payload.task_id),
    }
  },

  async getReport(matchResultId: string): Promise<ImprovementReportResponse> {
    const payload = await requestJson<BackendReportResponse>(
      `/api/match-results/${matchResultId}/improvement-report`,
      { authenticated: true },
    )
    return normalizeResponse(payload)
  },
}
