import { useCallback, useEffect, useState } from "react"

import {
  ArrowSquareOut,
  Briefcase,
  Buildings,
  CalendarBlank,
  FileText,
  MagnifyingGlass,
  MapPin,
  Spinner,
  WarningCircle,
} from "@phosphor-icons/react"

import { analyzerApi } from "@/api/analyzerApi"

import { jobSearchApi } from "@/api/jobSearchApi"

import {
  getCachedResource,
  getOrFetchResource,
} from "@/services/resourceCache"

import type { CvVersion } from "@/types/analyzer"

import type { JobSearchResult } from "@/types/jobSearch"

import BezelCard from "@/ui/components/BezelCard"

const alertStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--danger)",
  background: "var(--danger-soft)",
  border: "1px solid color-mix(in srgb, var(--danger) 34%, transparent)",
  borderRadius: 10,
  padding: "11px 14px",
  marginBottom: 16,
  fontSize: 13,
}

const emptyStyle: React.CSSProperties = {
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "var(--text-secondary)",
  textAlign: "center",
  padding: 24,
}

const cardIconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "var(--accent-soft)",
  color: "var(--accent-ink)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
}

const JOB_SEARCH_CVS_CACHE_KEY = "job-search:cvs"

const jobSearchResultCacheKey = (params: {
  cvId: number
  query: string
  location: string
  remote: string
  jobage: string
  level: string
}) =>
  [
    "job-search:results",
    params.cvId,
    params.query.trim().toLowerCase(),
    params.location.trim().toLowerCase(),
    params.remote,
    params.jobage,
    params.level,
  ].join(":")

function formatPostedDate(value: string | null) {
  if (!value) return "Date unknown"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function JobSearchScreen() {
  const cachedCvs = getCachedResource<CvVersion[]>(JOB_SEARCH_CVS_CACHE_KEY)

  const [cvs, setCvs] = useState<CvVersion[]>(cachedCvs ?? [])

  const [selectedCvId, setSelectedCvId] = useState<number | null>(
    cachedCvs?.find((cv) => cv.parseStatus === "Success" && cv.isLatest)
      ?.cvId ??
      cachedCvs?.find((cv) => cv.parseStatus === "Success")?.cvId ??
      cachedCvs?.[0]?.cvId ??
      null,
  )

  const [query, setQuery] = useState("")

  const [location, setLocation] = useState("Remote")

  const [remote, setRemote] = useState("any")

  const [jobage, setJobage] = useState("30")

  const [level, setLevel] = useState("")

  const [result, setResult] = useState<JobSearchResult | null>(null)

  const [loading, setLoading] = useState(() => !cachedCvs)

  const [searching, setSearching] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const loadCvs = useCallback(async () => {
    const cached = getCachedResource<CvVersion[]>(JOB_SEARCH_CVS_CACHE_KEY)

    if (cached) {
      setCvs(cached)

      setLoading(false)

      return
    }

    setLoading(true)

    setError(null)

    try {
      const versions = await getOrFetchResource(
        JOB_SEARCH_CVS_CACHE_KEY,
        () => analyzerApi.listCvs(),
      )

      setCvs(versions)

      const parsed = versions.filter((cv) => cv.parseStatus === "Success")

      const preferred =
        parsed.find((cv) => cv.isLatest) ?? parsed[0] ?? versions[0] ?? null

      setSelectedCvId((current) => {
        if (current != null && versions.some((cv) => cv.cvId === current)) {
          return current
        }
        return preferred?.cvId ?? null
      })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load your CVs.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCvs()
  }, [loadCvs])

  const runSearch = async () => {
    if (selectedCvId == null) return

    setSearching(true)

    setError(null)

    try {
      const response = await getOrFetchResource(
        jobSearchResultCacheKey({
          cvId: selectedCvId,
          query,
          location,
          remote,
          jobage,
          level,
        }),
        () =>
          jobSearchApi.recommendations({
            cvId: selectedCvId,
            query: query.trim() || undefined,
            location: location.trim() || undefined,
            remote:
              remote === "any"
                ? undefined
                : remote as "remote" | "hybrid" | "onsite",
            jobage: jobage ? Number(jobage) : undefined,
            level: level || undefined,
            limit: 12,
          }),
      )

      setResult(response)
    } catch (caught) {
      setResult(null)

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to search for matching jobs.",
      )
    } finally {
      setSearching(false)
    }
  }

  const parsedCvCount = cvs.filter((cv) => cv.parseStatus === "Success").length

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <h1>Job Search</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Scan your CV, find a few matching tech job postings, and open them
            to apply. Nothing is saved.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Briefcase size={20} weight="light" color="var(--accent)" />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            freehire.me + LinkedIn · tech-focused · best-effort
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" style={alertStyle}>
          <WarningCircle size={18} weight="light" /> {error}
        </div>
      )}

      <div className="fitcv-card" style={{ padding: 24, marginBottom: 20 }}>
        <div className="fc-eyebrow" style={{ marginBottom: 14 }}>
          Scan CV &amp; search
        </div>
        <div className="job-search-filters">
          <label>
            <span className="fc-field-label">CV to scan</span>
            <select
              className="fc-input"
              value={selectedCvId ?? ""}
              onChange={(event) => setSelectedCvId(Number(event.target.value))}
              disabled={loading || cvs.length === 0}
            >
              {cvs.length === 0 && <option value="">No CV uploaded</option>}
              {cvs.map((cv) => (
                <option key={cv.cvId} value={cv.cvId}>
                  {cv.fileName} (v{cv.versionNumber}
                  {cv.parseStatus === "Success" ? "" : ` · ${cv.parseStatus}`})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="fc-field-label">Keywords</span>
            <input
              className="fc-input"
              type="text"
              placeholder="e.g. software engineer intern"
              title="Leave empty to auto-derive keywords from your CV"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label>
            <span className="fc-field-label">Location</span>
            <input
              className="fc-input"
              type="text"
              placeholder="Remote"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>

          <label>
            <span className="fc-field-label">Workplace type</span>
            <select
              className="fc-input"
              value={remote}
              onChange={(event) => setRemote(event.target.value)}
            >
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </label>

          <label>
            <span className="fc-field-label">Posted within</span>
            <select
              className="fc-input"
              value={jobage}
              onChange={(event) => setJobage(event.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="">Any time</option>
            </select>
          </label>

          <label>
            <span className="fc-field-label">Experience level</span>
            <select
              className="fc-input"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">Any (auto-detect)</option>
              <option value="Intern">Intern</option>
              <option value="Entry">Entry</option>
              <option value="Fresher">Fresher</option>
              <option value="Junior">Junior</option>
              <option value="Mid-level">Mid-level</option>
              <option value="Senior">Senior</option>
              <option value="Lead">Lead</option>
              <option value="Manager">Manager</option>
            </select>
          </label>

        </div>

        <div className="job-search-submit">
          <button
            type="button"
            className="fitcv-btn-primary"
            onClick={() => void runSearch()}
            disabled={searching || selectedCvId == null || loading}
          >
            {searching ? (
              <Spinner className="job-spin" size={15} weight="light" />
            ) : (
              <MagnifyingGlass size={15} weight="light" />
            )}
            {searching ? "Searching…" : "Find matching jobs"}
          </button>
        </div>

        {cvs.length > 0 && parsedCvCount === 0 && (
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
              marginTop: 12,
            }}
          >
            None of your CVs are parsed yet. Run the Match Analyzer first so
            keywords can be derived automatically.
          </p>
        )}
      </div>

      {loading && (
        <div className="fitcv-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Spinner className="job-spin" size={18} weight="light" /> Loading your CVs...
          </div>
        </div>
      )}

      {!loading && cvs.length === 0 && (
        <div className="fitcv-card" style={{ padding: 24 }}>
          <div style={emptyStyle}>
            <div style={cardIconStyle}>
              <FileText size={22} weight="light" />
            </div>
            <strong style={{ color: "var(--text-primary)" }}>
              No CV uploaded yet
            </strong>
            <p style={{ maxWidth: 420 }}>
              Upload your CV in CV Build or Match Analyzer, then come back here
              to find matching jobs.
            </p>
          </div>
        </div>
      )}

      {result && (
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <span>
            <span style={{ color: "var(--text-primary)", fontWeight: 650 }}>
              {result.results.length}
            </span>{" "}
            jobs for{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 650 }}>
              “{result.query}”
            </span>{" "}
            in {result.location}
          </span>
          {result.derivedLevel && (
            <span
              className="fc-badge"
              data-testid="derived-level-badge"
              style={{ fontSize: 11 }}
            >
              Level: {result.derivedLevel}
            </span>
          )}
          {result.derivedBy === "ai" && (
            <span
              className="fc-badge fc-badge--blue"
              data-testid="ai-derived-badge"
              style={{ fontSize: 11 }}
            >
              AI-derived from CV
            </span>
          )}
        </div>
      )}

      {result && result.results.length === 0 && (
        <div className="fitcv-card" style={{ padding: 24 }}>
          <div style={emptyStyle}>
            <div style={cardIconStyle}>
              <MagnifyingGlass size={22} weight="light" />
            </div>
            <strong style={{ color: "var(--text-primary)" }}>
              No jobs found
            </strong>
            <p style={{ maxWidth: 420 }}>
              Try different keywords, widen the location, or increase the
              posted-within window.
            </p>
          </div>
        </div>
      )}

      {result && result.results.length > 0 && (
        <div className="job-result-grid">
          {result.results.map((job) => (
            <BezelCard key={job.id} className="job-result-card">
              <div className="job-result-card__body">
                <div className="job-result-card__title" title={job.title}>
                  {job.title}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {job.source === "linkedin" && (
                    <span className="fc-badge fc-badge--blue">
                      LinkedIn
                    </span>
                  )}
                  {job.source === "freehire" && (
                    <span className="fc-badge fc-badge--green">
                      freehire
                    </span>
                  )}
                  {job.seniority && (
                    <span
                      className="fc-badge"
                      style={{ fontSize: 11 }}
                    >
                      {job.seniority}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginTop: 10,
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <Buildings size={14} weight="light" />
                    {job.company ?? "Unknown company"}
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <MapPin size={14} weight="light" />
                    {job.location ?? "Location not listed"}
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <CalendarBlank size={14} weight="light" />
                    {formatPostedDate(job.date)}
                  </div>
                </div>
                {job.matchedKeywords.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    {job.matchedKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="fc-badge fc-badge--blue"
                        style={{ fontSize: 11 }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "auto",
                    paddingTop: 14,
                  }}
                >
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fitcv-btn-secondary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 13,
                      textDecoration: "none",
                    }}
                  >
                    <ArrowSquareOut size={14} weight="light" />
                    View job
                  </a>
                </div>
              </div>
            </BezelCard>
          ))}
        </div>
      )}

      {result && (
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 12,
            marginTop: 14,
          }}
        >
          {result.note}
        </p>
      )}
    </div>
  )
}
