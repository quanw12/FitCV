import { authApi } from './authApi'
import type { AsyncStatus } from '@/types/app'
import type {
  GenerateImprovementResponse,
  ImprovementReport,
  ImprovementReportResponse,
  SuggestionPriority,
} from '@/types/improvement'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const USE_IMPROVEMENT_FIXTURE = import.meta.env.VITE_IMPROVEMENT_FIXTURE === 'true' || !API_BASE_URL

export interface AnalyzeCvRequest {
  cvId: string
  jobDescription: string
}

export interface AnalyzeCvResponse {
  matchResultId: string
  status: AsyncStatus
}

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

const fixtureReport: ImprovementReport = {
  skillGaps: [
    { id: 'skill-docker', skill: 'Docker', priority: 'High', reason: 'The CV does not demonstrate the containerization experience required by this role.', jdEvidence: 'Experience with Docker and containerized deployment.' },
    { id: 'skill-cicd', skill: 'CI/CD', priority: 'Medium', reason: 'Deployment automation is requested but is not demonstrated in the CV.', jdEvidence: 'Familiarity with CI/CD pipelines.' },
    { id: 'skill-redis', skill: 'Redis', priority: 'Low', reason: 'Caching knowledge would strengthen the backend profile.', jdEvidence: 'Knowledge of Redis is preferred.' },
  ],
  sectionFeedback: [
    { id: 'feedback-work', section: 'WorkExperience', issue: 'Experience bullets describe responsibilities without outcomes.', explanation: 'Recruiters cannot assess the scale or impact of the work.', priority: 'High', suggestedAction: 'Use action verbs and add verified scope or results for each major contribution.' },
    { id: 'feedback-summary', section: 'Summary', issue: 'The summary is generic and not tailored to the target role.', explanation: 'It misses the strongest relevant backend skills.', priority: 'Medium', suggestedAction: 'Mention the target role and two or three skills already supported by the CV.' },
  ],
  rewriteSuggestions: [
    { id: 'rewrite-backend', section: 'WorkExperience', originalText: 'Responsible for developing backend features and fixing bugs.', issue: 'The statement is vague and has no verifiable scope or outcome.', suggestedText: 'Developed [N] backend features using the technologies already listed in your CV, improving [verified outcome].', framework: 'Problem → Action → Result' },
    { id: 'rewrite-project', section: 'Projects', originalText: 'Worked with a team to build a web application.', issue: 'Your individual action and project result are unclear.', suggestedText: 'Collaborated with a team of [N] to implement [specific feature], resulting in [verified project outcome].', framework: 'Problem → Action → Result' },
  ],
  quickWins: [
    { id: 'quick-docker', title: 'Add Docker only if you have used it', category: 'Skill', priority: 'High', explanation: 'Describe a real project or course where you used it.' },
    { id: 'quick-metric', title: 'Quantify one experience bullet', category: 'Experience', priority: 'Medium', explanation: 'Replace placeholders only with figures you can verify.' },
    { id: 'quick-summary', title: 'Shorten the summary to three sentences', category: 'Format', priority: 'Low', explanation: 'Keep it focused on evidence relevant to this JD.' },
  ],
}

function sessionToken(): string | undefined {
  return authApi.getSession()?.accessToken
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(payload?.detail ?? `Request failed with status ${response.status}.`)
  }
  return response.json() as Promise<T>
}

function stableId(prefix: string, parts: string[]): string {
  let hash = 0
  for (const char of parts.join('|')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return `${prefix}-${Math.abs(hash)}`
}

function normalizeReport(report: BackendReport): ImprovementReport {
  return {
    skillGaps: report.skill_gaps.map(item => ({ ...item, id: stableId('skill', [item.skill]), jdEvidence: item.jd_evidence })),
    sectionFeedback: report.section_feedback.map(item => ({ ...item, id: stableId('feedback', [item.section, item.issue]), section: normalizeSection(item.section), suggestedAction: item.suggested_action })),
    rewriteSuggestions: report.rewrite_suggestions.map(item => ({ id: stableId('rewrite', [item.section, item.original_text]), section: normalizeSection(item.section), originalText: item.original_text, issue: item.issue, suggestedText: item.suggested_text, framework: item.framework })),
    quickWins: report.quick_wins.map(item => ({ ...item, id: stableId('quick', [item.title]) })),
  }
}

function normalizeSection(value: string): 'Summary' | 'WorkExperience' | 'Skills' | 'Education' | 'Projects' | 'Other' {
  const allowed = ['Summary', 'WorkExperience', 'Skills', 'Education', 'Projects'] as const
  return allowed.find(section => section === value) ?? 'Other'
}

function normalizeResponse(payload: BackendReportResponse): ImprovementReportResponse {
  return {
    matchResultId: String(payload.match_result_id), status: payload.status, generatedAt: payload.generated_at,
    errorMessage: payload.error_message, overallScore: payload.overall_score, stale: payload.stale,
    report: payload.report ? normalizeReport(payload.report) : null,
  }
}

function fixtureResponse(matchResultId: string): ImprovementReportResponse {
  return { matchResultId, status: 'Success', generatedAt: new Date().toISOString(), errorMessage: null, overallScore: 78, stale: false, report: fixtureReport }
}

export const fitcvApi = {
  async analyzeCv(_request: AnalyzeCvRequest): Promise<AnalyzeCvResponse> {
    throw new Error('CV/JD Analyzer integration is owned by the Analyzer task and is not connected yet.')
  },

  async generateImprovementReport(matchResultId: string, regenerate = false): Promise<GenerateImprovementResponse> {
    if (USE_IMPROVEMENT_FIXTURE) return { matchResultId, status: 'Success', taskId: null }
    const payload = await requestJson<BackendGenerateResponse>(`/api/match-results/${matchResultId}/improvement-report/generate?regenerate=${regenerate}`, { method: 'POST' })
    return { matchResultId: String(payload.match_result_id), status: payload.status, taskId: payload.task_id ? String(payload.task_id) : null }
  },

  async getImprovementReport(matchResultId: string): Promise<ImprovementReportResponse> {
    if (USE_IMPROVEMENT_FIXTURE) return fixtureResponse(matchResultId)
    return normalizeResponse(await requestJson<BackendReportResponse>(`/api/match-results/${matchResultId}/improvement-report`))
  },
}
