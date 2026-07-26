import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
  RefreshCw,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { jobsApi } from "@/api/jobsApi"
import type { JobPost } from "@/types/jobs"

interface PublicJobScreenProps {
  jobId: number
  onBack: () => void
}

const hasTimezone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)

const formatDate = (value: string | null) => {
  if (!value) return "Open until filled"
  const date = new Date(hasTimezone(value) ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) return "Deadline unavailable"
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const sections = [
  ["about_job", "About the job"],
  ["responsibilities", "Responsibilities"],
  ["requirements", "Requirements"],
  ["we_offer", "What we offer"],
  ["life_at_company", "Life at the company"],
  ["hiring_process", "Hiring process"],
] as const

export default function PublicJobScreen({
  jobId,
  onBack,
}: PublicJobScreenProps) {
  const [job, setJob] = useState<JobPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setJob(await jobsApi.getPublic(jobId))
    } catch (cause) {
      setJob(null)
      setError(
        cause instanceof Error
          ? cause.message
          : "This public job could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="public-job-page">
      <header className="public-job-header">
        <button className="public-job-brand" type="button" onClick={onBack}>
          <span>
            <Briefcase size={19} aria-hidden="true" />
          </span>
          <strong>FitCV</strong>
        </button>
        <button
          className="fc-btn fc-btn--secondary"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to FitCV
        </button>
      </header>

      <main className="public-job-main">
        {loading ? (
          <div className="fc-card public-job-state" aria-live="polite">
            <span className="state-spinner" />
            <strong>Loading public job</strong>
            <p>Fetching the latest published details...</p>
          </div>
        ) : error || !job ? (
          <div className="fc-card public-job-state" role="alert">
            <AlertCircle size={32} aria-hidden="true" />
            <strong>This job is unavailable</strong>
            <p>
              {error ||
                "It may have been closed, archived, or removed from public view."}
            </p>
            <button
              className="fc-btn fc-btn--secondary"
              onClick={() => void load()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : (
          <article className="fc-card public-job-card">
            <div className="public-job-hero">
              <div className="public-job-company-logo">
                {job.company.logo_url ? (
                  <img src={job.company.logo_url} alt="" />
                ) : (
                  <Building2 size={25} aria-hidden="true" />
                )}
              </div>
              <div>
                <span className="fc-badge fc-badge--green">Published</span>
                <h1>{job.title}</h1>
                <p>{job.company.name}</p>
              </div>
            </div>

            <div className="public-job-facts">
              <span>
                <MapPin size={16} aria-hidden="true" />
                {job.location || "Location to be confirmed"}
              </span>
              <span>
                <Briefcase size={16} aria-hidden="true" />
                {job.employment_type || "Employment type to be confirmed"}
              </span>
              <span>
                <CalendarDays size={16} aria-hidden="true" />
                Apply by {formatDate(job.deadline)}
              </span>
            </div>

            <div className="public-job-content">
              {sections.map(([key, title]) =>
                job[key] ? (
                  <section key={key}>
                    <h2>{title}</h2>
                    <p>{job[key]}</p>
                  </section>
                ) : null,
              )}
            </div>

            <footer className="public-job-footer">
              <p>
                {job.openings_count}{" "}
                {job.openings_count === 1 ? "opening" : "openings"}
              </p>
              {job.company.website_url && (
                <a
                  className="fc-btn fc-btn--secondary"
                  href={job.company.website_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Company website
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </footer>
          </article>
        )}
      </main>
    </div>
  )
}
