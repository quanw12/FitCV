export interface JobSearchHit {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  matchedKeywords: string[]
}

export interface JobSearchResult {
  query: string
  location: string
  results: JobSearchHit[]
  note: string
}

export interface JobSearchParams {
  cvId: number
  query?: string
  location?: string
  remote?: "remote" | "hybrid" | "onsite"
  jobage?: number
  limit?: number
}
