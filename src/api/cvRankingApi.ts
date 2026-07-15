import { authApi } from './authApi'
import { API_BASE_URL } from './config'
import type { BatchParseCvResponse, ParsedCvCandidate } from '@/types/cvRanking'

interface BackendParsedCandidate {
  id: string
  file_name: string
  file_type: 'PDF' | 'DOCX'
  file_size_label: string
  name: string
  email: string
  phone: string
  location: string
  position: string
  skills: string[]
  missing_skills: string[]
  experience_years: number
  education: string
  score: number
  score_breakdown: {
    skills: number
    experience: number
    education: number
  }
  status: 'Ready' | 'Failed'
  parse_notes: string[]
}

interface BackendBatchParseResponse {
  required_skills: string[]
  candidates: BackendParsedCandidate[]
  warnings: string[]
}

function sessionToken(): string | undefined {
  return authApi.getSession()?.accessToken
}

function normalizeCandidate(candidate: BackendParsedCandidate): ParsedCvCandidate {
  return {
    id: candidate.id,
    fileName: candidate.file_name,
    fileType: candidate.file_type,
    fileSizeLabel: candidate.file_size_label,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location,
    position: candidate.position,
    skills: candidate.skills,
    missingSkills: candidate.missing_skills,
    experienceYears: candidate.experience_years,
    education: candidate.education,
    score: candidate.score,
    scoreBreakdown: candidate.score_breakdown,
    status: candidate.status,
    parseNotes: candidate.parse_notes,
  }
}

export const cvRankingApi = {
  async parseBatch(files: File[], jobDescription: string): Promise<BatchParseCvResponse> {
    if (!API_BASE_URL) throw new Error('API base URL is not configured.')

    const formData = new FormData()
    formData.append('job_description', jobDescription)
    files.forEach(file => formData.append('files', file))

    const token = sessionToken()
    const response = await fetch(`${API_BASE_URL}/api/hr/cv-ranking/parse`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: string } | null
      throw new Error(payload?.detail ?? `CV parsing failed with status ${response.status}.`)
    }

    const payload = await response.json() as BackendBatchParseResponse
    return {
      requiredSkills: payload.required_skills,
      candidates: payload.candidates.map(normalizeCandidate),
      warnings: payload.warnings,
    }
  },
}
