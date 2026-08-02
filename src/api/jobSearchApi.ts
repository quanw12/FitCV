import type {
  JobSearchHit,
  JobSearchParams,
  JobSearchResult,
} from "@/types/jobSearch"

import { requestJson } from "./httpClient"

interface BackendJobSearchHit {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  matched_keywords: string[]
}

interface BackendJobSearchResponse {
  query: string
  location: string
  results: BackendJobSearchHit[]
  note: string
}

function normalizeHit(hit: BackendJobSearchHit): JobSearchHit {
  return {
    id: hit.id,
    title: hit.title,
    company: hit.company,
    location: hit.location,
    date: hit.date,
    url: hit.url,
    matchedKeywords: hit.matched_keywords,
  }
}

export const jobSearchApi = {
  async recommendations(params: JobSearchParams): Promise<JobSearchResult> {
    const payload = await requestJson<BackendJobSearchResponse>(
      "/api/job-search/recommendations",
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({
          cv_id: params.cvId,
          query: params.query?.trim() ? params.query.trim() : null,
          location: params.location?.trim() ? params.location.trim() : "Remote",
          remote: params.remote ?? null,
          jobage: params.jobage ?? 30,
          limit: params.limit ?? 12,
        }),
      },
    )
    return {
      query: payload.query,
      location: payload.location,
      note: payload.note,
      results: payload.results.map(normalizeHit),
    }
  },
}
