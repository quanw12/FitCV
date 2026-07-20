import type { AsyncStatus } from "@/types/app"

import type {
  AnalyzeCvRequest,
  CvComparisonSeries,
  CvVersion,
  MatchAnalysis,
} from "@/types/analyzer"
import { requestJson } from "./httpClient"

interface BackendCvVersion {
  cv_id: number

  file_name: string

  file_type: "PDF" | "DOCX"

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

  match_label: MatchAnalysis["matchLabel"]

  pass_probability: number | null

  breakdown: MatchAnalysis["breakdown"]

  strengths: string[]

  weaknesses: string[]

  suggestions: string[]

  algorithm_version: string

  error_message: string | null

  generated_at: string

  completed_at: string | null

  disclaimer: string
}

interface BackendCvScorePoint {
  cv_id: number
  version_number: number
  file_name: string
  uploaded_at: string
  match_result_id: number
  overall_score: number
  skill_score: number | null
  experience_score: number | null
  education_score: number | null
  soft_skill_score: number | null
  match_label: string | null
  completed_at: string | null
  delta_from_previous: number | null
}

interface BackendCvComparisonSeries {
  job_description_id: number
  title: string
  created_at: string
  best_score: number
  latest_score: number
  latest_delta: number | null
  versions: BackendCvScorePoint[]
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

function normalizeComparison(
  payload: BackendCvComparisonSeries,
): CvComparisonSeries {
  return {
    jobDescriptionId: payload.job_description_id,
    title: payload.title,
    createdAt: payload.created_at,
    bestScore: payload.best_score,
    latestScore: payload.latest_score,
    latestDelta: payload.latest_delta,
    versions: payload.versions.map((point) => ({
      cvId: point.cv_id,
      versionNumber: point.version_number,
      fileName: point.file_name,
      uploadedAt: point.uploaded_at,
      matchResultId: point.match_result_id,
      overallScore: point.overall_score,
      skillScore: point.skill_score,
      experienceScore: point.experience_score,
      educationScore: point.education_score,
      softSkillScore: point.soft_skill_score,
      matchLabel: point.match_label,
      completedAt: point.completed_at,
      deltaFromPrevious: point.delta_from_previous,
    })),
  }
}

export const analyzerApi = {
  async uploadCv(file: File, signal?: AbortSignal): Promise<CvVersion> {
    const body = new FormData()

    body.append("file", file)

    const payload = await requestJson<BackendCvVersion>("/api/cvs", {
      method: "POST",

      authenticated: true,

      body,

      signal,
    })

    return normalizeCv(payload)
  },

  async listCvs(): Promise<CvVersion[]> {
    const payload = await requestJson<BackendCvVersion[]>("/api/cvs", {
      authenticated: true,
    })

    return payload.map(normalizeCv)
  },

  async getCv(cvId: number, signal?: AbortSignal): Promise<CvVersion> {
    const payload = await requestJson<BackendCvVersion>(`/api/cvs/${cvId}`, {
      authenticated: true,

      signal,
    })

    return normalizeCv(payload)
  },

  async listCvComparisons(): Promise<CvComparisonSeries[]> {
    const payload = await requestJson<BackendCvComparisonSeries[]>(
      "/api/cvs/comparisons",
      {
        authenticated: true,
      },
    )
    return payload.map(normalizeComparison)
  },

  deleteCv(cvId: number): Promise<void> {
    return requestJson(`/api/cvs/${cvId}`, {
      method: "DELETE",

      authenticated: true,
    })
  },

  async analyzeCv(
    request: AnalyzeCvRequest,

    signal?: AbortSignal,
  ): Promise<MatchAnalysis> {
    const payload = await requestJson<BackendMatchAnalysis>(
      "/api/analyzer/matches",
      {
        method: "POST",

        authenticated: true,

        body: JSON.stringify({
          cv_id: request.cvId,

          job_description: request.jobDescription,

          title: request.title ?? "Pasted job description",
        }),

        signal,
      },
    )

    return normalizeMatch(payload)
  },

  async getMatchResult(
    matchResultId: string,

    signal?: AbortSignal,
  ): Promise<MatchAnalysis> {
    const payload = await requestJson<BackendMatchAnalysis>(
      `/api/analyzer/matches/${matchResultId}`,

      { authenticated: true, signal },
    )

    return normalizeMatch(payload)
  },
}
