import type { AsyncStatus } from '@/types/app'
import type { AnalyzeCvRequest, CvVersion, MatchAnalysis } from '@/types/analyzer'
import { requestJson } from './httpClient'

interface BackendCvVersion {
  cv_id: number
  file_name: string
  file_type: 'PDF' | 'DOCX'
  file_size_kb: number | null
  version_number: number
  is_latest: boolean
  uploaded_at: string
  parse_status: AsyncStatus
  parser_version: string | null
  error_message: string | null
}

interface BackendMatchAnalysis {
  match_result_id: number
  status: AsyncStatus
  cv_id: number
  job_description_id: number | null
  title: string
  overall_score: number | null
  match_label: MatchAnalysis['matchLabel']
  pass_probability: number | null
  breakdown: MatchAnalysis['breakdown']
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  algorithm_version: string
  error_message: string | null
  generated_at: string
  completed_at: string | null
  disclaimer: string
}

function normalizeCv(payload: BackendCvVersion): CvVersion {
  return {
    cvId: payload.cv_id,
    fileName: payload.file_name,
    fileType: payload.file_type,
    fileSizeKb: payload.file_size_kb,
    versionNumber: payload.version_number,
    isLatest: payload.is_latest,
    uploadedAt: payload.uploaded_at,
    parseStatus: payload.parse_status,
    parserVersion: payload.parser_version,
    errorMessage: payload.error_message,
  }
}

function normalizeMatch(payload: BackendMatchAnalysis): MatchAnalysis {
  return {
    matchResultId: String(payload.match_result_id),
    status: payload.status,
    cvId: payload.cv_id,
    jobDescriptionId: payload.job_description_id,
    title: payload.title,
    overallScore: payload.overall_score,
    matchLabel: payload.match_label,
    passProbability: payload.pass_probability,
    breakdown: payload.breakdown,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    suggestions: payload.suggestions,
    algorithmVersion: payload.algorithm_version,
    errorMessage: payload.error_message,
    generatedAt: payload.generated_at,
    completedAt: payload.completed_at,
    disclaimer: payload.disclaimer,
  }
}

export const analyzerApi = {
  async uploadCv(file: File): Promise<CvVersion> {
    const body = new FormData()
    body.append('file', file)
    const payload = await requestJson<BackendCvVersion>('/api/cvs', {
      method: 'POST',
      authenticated: true,
      body,
    })
    return normalizeCv(payload)
  },

  async listCvs(): Promise<CvVersion[]> {
    const payload = await requestJson<BackendCvVersion[]>('/api/cvs', {
      authenticated: true,
    })
    return payload.map(normalizeCv)
  },

  async getCv(cvId: number): Promise<CvVersion> {
    const payload = await requestJson<BackendCvVersion>(`/api/cvs/${cvId}`, {
      authenticated: true,
    })
    return normalizeCv(payload)
  },

  deleteCv(cvId: number): Promise<void> {
    return requestJson(`/api/cvs/${cvId}`, {
      method: 'DELETE',
      authenticated: true,
    })
  },

  async analyzeCv(request: AnalyzeCvRequest): Promise<MatchAnalysis> {
    const payload = await requestJson<BackendMatchAnalysis>('/api/analyzer/matches', {
      method: 'POST',
      authenticated: true,
      body: JSON.stringify({
        cv_id: request.cvId,
        job_description: request.jobDescription,
        title: request.title ?? 'Pasted job description',
      }),
    })
    return normalizeMatch(payload)
  },

  async getMatchResult(matchResultId: string): Promise<MatchAnalysis> {
    const payload = await requestJson<BackendMatchAnalysis>(
      `/api/analyzer/matches/${matchResultId}`,
      { authenticated: true },
    )
    return normalizeMatch(payload)
  },
}
