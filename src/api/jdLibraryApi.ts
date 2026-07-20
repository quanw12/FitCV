import { requestJson } from "./httpClient"
import type { JdLibraryInsights, JdLibraryItem } from "@/types/jdLibrary"

interface BackendJdLibraryItem {
  job_description_id: number
  title: string
  source_type: string
  raw_text: string
  created_at: string
  parse_status: string
  required_skills: string[]
  preferred_skills: string[]
  soft_skills: string[]
  experience_years: number | null
  education: string | null
  match_count: number
  latest_score: number | null
  latest_match_label: string | null
}

interface BackendSkillFrequency {
  skill: string
  count: number
  percentage: number
}

interface BackendJdLibraryInsights {
  total_job_descriptions: number
  total_matches: number
  average_match_score: number | null
  required_skills: BackendSkillFrequency[]
  preferred_skills: BackendSkillFrequency[]
  missing_skills: BackendSkillFrequency[]
}

function normalizeItem(item: BackendJdLibraryItem): JdLibraryItem {
  return {
    jobDescriptionId: item.job_description_id,
    title: item.title,
    sourceType: item.source_type,
    rawText: item.raw_text,
    createdAt: item.created_at,
    parseStatus: item.parse_status,
    requiredSkills: item.required_skills,
    preferredSkills: item.preferred_skills,
    softSkills: item.soft_skills,
    experienceYears: item.experience_years,
    education: item.education,
    matchCount: item.match_count,
    latestScore: item.latest_score,
    latestMatchLabel: item.latest_match_label,
  }
}

function normalizeInsights(
  payload: BackendJdLibraryInsights,
): JdLibraryInsights {
  return {
    totalJobDescriptions: payload.total_job_descriptions,
    totalMatches: payload.total_matches,
    averageMatchScore: payload.average_match_score,
    requiredSkills: payload.required_skills,
    preferredSkills: payload.preferred_skills,
    missingSkills: payload.missing_skills,
  }
}

export const jdLibraryApi = {
  async list(query = ""): Promise<JdLibraryItem[]> {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""
    const payload = await requestJson<BackendJdLibraryItem[]>(
      `/api/jd-library${suffix}`,
      {
        authenticated: true,
      },
    )
    return payload.map(normalizeItem)
  },

  async getInsights(): Promise<JdLibraryInsights> {
    const payload = await requestJson<BackendJdLibraryInsights>(
      "/api/jd-library/insights",
      {
        authenticated: true,
      },
    )
    return normalizeInsights(payload)
  },

  delete(jobDescriptionId: number): Promise<void> {
    return requestJson(`/api/jd-library/${jobDescriptionId}`, {
      method: "DELETE",
      authenticated: true,
    })
  },
}
