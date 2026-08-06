import { authApi } from "./authApi"

import { API_BASE_URL } from "./config"

import type {
  BatchParseCvResponse,
  ParsedCvCandidate,
  RankedApplication,
  ScreeningBatchStatus,
  ScreeningBatchSummary,
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

  screening_candidate_id?: number | null

  is_selected?: boolean

  is_confirmed?: boolean
}

interface BackendBatchParseResponse {
  required_skills: string[]

  preferred_skills: string[]

  candidates: BackendParsedCandidate[]

  warnings: string[]

  screening_batch_id?: number | null

  ai_task_id?: number | null

  status?: ScreeningBatchStatus | null

  title?: string | null

  created_at?: string | null

  total_files?: number | null

  processed_count?: number | null
}

interface BackendScreeningBatchSummary {
  screening_batch_id: number
  title: string
  status: ScreeningBatchStatus
  total_files: number
  processed_count: number
  selected_count: number
  created_at: string
  completed_at?: string | null
}

async function requestBlob(path: string, fallback: string): Promise<Blob> {
  if (!API_BASE_URL) throw new Error("API base URL is not configured.")

  const token = authApi.getSession()?.accessToken

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
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

    screeningCandidateId: candidate.screening_candidate_id,

    isSelected: candidate.is_selected ?? false,

    isConfirmed: candidate.is_confirmed ?? false,
  }
}

function normalizeBatch(payload: BackendBatchParseResponse): BatchParseCvResponse {
  return {
    requiredSkills: payload.required_skills,
    preferredSkills: payload.preferred_skills,
    candidates: payload.candidates.map(normalizeCandidate),
    warnings: payload.warnings,
    batchId: payload.screening_batch_id,
    taskId: payload.ai_task_id,
    status: payload.status,
    title: payload.title,
    createdAt: payload.created_at,
    totalFiles: payload.total_files,
    processedCount: payload.processed_count,
  }
}

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

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

  async listBatches(filters?: {
    query?: string
    status?: ScreeningBatchStatus | ""
    minScore?: number
    createdFrom?: string
    createdTo?: string
  }): Promise<ScreeningBatchSummary[]> {
    const params = new URLSearchParams()
    if (filters?.query) params.set("q", filters.query)
    if (filters?.status) params.set("status", filters.status)
    if (filters?.minScore != null)
      params.set("min_score", String(filters.minScore))
    if (filters?.createdFrom)
      params.set("created_from", `${filters.createdFrom}T00:00:00`)
    if (filters?.createdTo)
      params.set("created_to", `${filters.createdTo}T23:59:59`)
    const suffix = params.size ? `?${params.toString()}` : ""
    const rows = await requestJson<BackendScreeningBatchSummary[]>(
      `/api/hr/cv-ranking/batches${suffix}`,
      { authenticated: true },
    )
    return rows.map((row) => ({
      screeningBatchId: row.screening_batch_id,
      title: row.title,
      status: row.status,
      totalFiles: row.total_files,
      processedCount: row.processed_count,
      selectedCount: row.selected_count,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }))
  },

  async getBatch(batchId: number): Promise<BatchParseCvResponse> {
    const payload = await requestJson<BackendBatchParseResponse>(
      `/api/hr/cv-ranking/batches/${batchId}`,
      { authenticated: true },
    )
    return normalizeBatch(payload)
  },

  async saveBatchSelection(
    batchId: number,
    selectedIds: string[],
    confirmedIds: string[],
  ): Promise<BatchParseCvResponse> {
    const payload = await requestJson<BackendBatchParseResponse>(
      `/api/hr/cv-ranking/batches/${batchId}/selection`,
      {
        method: "PATCH",
        authenticated: true,
        body: JSON.stringify({
          selected_candidate_keys: selectedIds,
          confirmed_candidate_keys: confirmedIds,
        }),
      },
    )
    return normalizeBatch(payload)
  },

  getBatchCandidateCv(batchId: number, candidateId: number) {
    return requestBlob(
      `/api/hr/cv-ranking/batches/${batchId}/candidates/${candidateId}/cv`,
      "Unable to load this screening CV.",
    )
  },

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

      credentials: "include",

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

    let payload = normalizeBatch(
      (await response.json()) as BackendBatchParseResponse,
    )
    if (!payload.batchId) return payload
    const batchId = payload.batchId
    const deadline = Date.now() + 10 * 60 * 1000
    while (
      payload.status === "Pending" ||
      payload.status === "Processing"
    ) {
      if (Date.now() >= deadline) {
        throw new Error(
          "Screening is still processing. Open it from screening history later.",
        )
      }
      await delay(1200)
      payload = await cvRankingApi.getBatch(batchId)
    }
    return payload
  },
}
