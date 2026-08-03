export interface JobSearchHit {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  matchedKeywords: string[]
  seniority: string | null
  category: string | null
  source: "linkedin" | "freehire"
}

export interface JobSearchResult {
  query: string
  location: string
  results: JobSearchHit[]
  note: string
  derivedBy: "ai" | "deterministic"
  derivedLevel: string | null
}

export interface JobSearchParams {
  cvId: number
  query?: string
  location?: string
  remote?: "remote" | "hybrid" | "onsite"
  jobage?: number
  limit?: number
  level?: string
}
