import { authApi } from "./authApi"
import { API_BASE_URL } from "./config"
import type {
  BatchParseCvResponse,
  ParsedCvCandidate,
  RankedApplication,
} from "@/types/cvRanking"
import { requestJson } from "./httpClient"

interface BackendParsedCandidate {
  id: string
  source_index: number
  file_name: string
  file_type: "PDF" | "DOCX"
  file_size_label: string
  name: string
  email: string
  phone: string
  location: string
  position: string
  skills: string[]
  matched_skills: string[]
  missing_skills: string[]
  experience_years: number
  education: string
  score: number
  match_label: string
  score_breakdown: {
    skills: number
    experience: number
    education: number
    soft_skills: number
  }
  status: "Ready" | "Failed"
  strengths: string[]
  weaknesses: string[]
  parse_notes: string[]
}

interface BackendBatchParseResponse {
  required_skills: string[]
  preferred_skills: string[]
  candidates: BackendParsedCandidate[]
  warnings: string[]
}

async function requestBlob(path: string, fallback: string): Promise<Blob> {
  if (!API_BASE_URL) throw new Error("API base URL is not configured.")

  const token = authApi.getSession()?.accessToken
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new Error(payload?.detail ?? fallback)
  }
  return response.blob()
}

function normalizeCandidate(
  candidate: BackendParsedCandidate,
): ParsedCvCandidate {
  return {
    id: candidate.id,
    sourceIndex: candidate.source_index,
    fileName: candidate.file_name,
    fileType: candidate.file_type,
    fileSizeLabel: candidate.file_size_label,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location,
    position: candidate.position,
    skills: candidate.skills,
    matchedSkills: candidate.matched_skills,
    missingSkills: candidate.missing_skills,
    experienceYears: candidate.experience_years,
    education: candidate.education,
    score: candidate.score,
    matchLabel: candidate.match_label,
    scoreBreakdown: {
      skills: candidate.score_breakdown.skills,
      experience: candidate.score_breakdown.experience,
      education: candidate.score_breakdown.education,
      softSkills: candidate.score_breakdown.soft_skills,
    },
    status: candidate.status,
    strengths: candidate.strengths,
    weaknesses: candidate.weaknesses,
    parseNotes: candidate.parse_notes,
  }
}

export const cvRankingApi = {
  listApplications: (jobId: number) =>
    requestJson<RankedApplication[]>(
      `/api/hr/cv-ranking/jobs/${jobId}/applications`,
      { authenticated: true },
    ),
  getApplicationCv: (applicationId: number) =>
    requestBlob(
      `/api/applications/${applicationId}/cv/download`,
      "Unable to load this CV.",
    ),
  downloadJobCvs: (jobId: number) =>
    requestBlob(
      `/api/hr/cv-ranking/jobs/${jobId}/cvs/archive`,
      "Unable to download the job CV archive.",
    ),
  async parseBatch(
    files: File[],
    jobDescription: string,
  ): Promise<BatchParseCvResponse> {
    if (!API_BASE_URL) throw new Error("API base URL is not configured.")

    const formData = new FormData()
    formData.append("job_description", jobDescription)
    files.forEach((file) => formData.append("files", file))

    const token = authApi.getSession()?.accessToken
    const response = await fetch(`${API_BASE_URL}/api/hr/cv-ranking/parse`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string
      } | null
      throw new Error(
        payload?.detail ??
          `CV screening failed with status ${response.status}.`,
      )
    }

    const payload = (await response.json()) as BackendBatchParseResponse
    return {
      requiredSkills: payload.required_skills,
      preferredSkills: payload.preferred_skills,
      candidates: payload.candidates.map(normalizeCandidate),
      warnings: payload.warnings,
    }
  },
}
