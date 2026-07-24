import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  UserRound,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { jobsApi } from "@/api/jobsApi"
import { pipelineApi } from "@/api/pipelineApi"
import type { JobPost } from "@/types/jobs"
import type {
  PipelineApplication,
  PipelineNote,
  PipelineStage,
  PipelineStageHistory,
} from "@/types/pipeline"

const stages: PipelineStage[] = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
]

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

const scoreClass = (score: number | null) => {
  if (score == null) return "pipeline-score--pending"
  if (score >= 80) return "pipeline-score--strong"
  if (score >= 50) return "pipeline-score--moderate"
  return "pipeline-score--weak"
}

export default function PipelineScreen() {
  const [applications, setApplications] = useState<PipelineApplication[]>([])
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>()
  const [selected, setSelected] = useState<PipelineApplication | null>(null)
  const [notes, setNotes] = useState<PipelineNote[]>([])
  const [history, setHistory] = useState<PipelineStageHistory[]>([])
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState("")
  const [detailError, setDetailError] = useState("")
  const [success, setSuccess] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [nextApplications, nextJobs] = await Promise.all([
        pipelineApi.list(selectedJobId),
        jobsApi.listManaged(false),
      ])
      setApplications(nextApplications)
      setJobs(nextJobs)
    } catch (cause) {
      setError(errorMessage(cause, "Could not load the hiring pipeline."))
    } finally {
      setLoading(false)
    }
  }, [selectedJobId])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        stages.map((stage) => [
          stage,
          applications.filter((item) => item.current_stage === stage),
        ]),
      ) as Record<PipelineStage, PipelineApplication[]>,
    [applications],
  )

  const openDetails = async (application: PipelineApplication) => {
    setSelected(application)
    setNote("")
    setNotes([])
    setHistory([])
    setDetailError("")
    setDetailLoading(true)
    try {
      const [nextNotes, nextHistory] = await Promise.all([
        pipelineApi.listNotes(application.application_id),
        pipelineApi.listHistory(application.application_id),
      ])
      setNotes(nextNotes)
      setHistory(nextHistory)
    } catch (cause) {
      setDetailError(errorMessage(cause, "Could not load candidate activity."))
    } finally {
      setDetailLoading(false)
    }
  }

  const move = async (
    application: PipelineApplication,
    stage: PipelineStage,
  ) => {
    if (application.current_stage === stage || movingId) return
    setMovingId(application.application_id)
    setError("")
    setDetailError("")
    setSuccess("")
    try {
      const updated = await pipelineApi.moveStage(
        application.application_id,
        stage,
      )
      setApplications((current) =>
        current.map((item) =>
          item.application_id === updated.application_id ? updated : item,
        ),
      )
      setSelected((current) =>
        current?.application_id === updated.application_id ? updated : current,
      )
      setSuccess(`Moved ${updated.candidate_name} to ${updated.current_stage}.`)
      if (selected?.application_id === updated.application_id) {
        setHistory(await pipelineApi.listHistory(updated.application_id))
      }
    } catch (cause) {
      const message = errorMessage(cause, "Could not move this candidate.")
      if (selected?.application_id === application.application_id) {
        setDetailError(message)
      } else {
        setError(message)
      }
    } finally {
      setMovingId(null)
    }
  }

  const addNote = async () => {
    if (!selected || !note.trim() || savingNote) return
    setSavingNote(true)
    setDetailError("")
    try {
      const created = await pipelineApi.addNote(
        selected.application_id,
        note.trim(),
      )
      setNotes((current) => [created, ...current])
      setApplications((current) =>
        current.map((item) =>
          item.application_id === selected.application_id
            ? { ...item, note_count: item.note_count + 1 }
            : item,
        ),
      )
      setSelected((current) =>
        current ? { ...current, note_count: current.note_count + 1 } : current,
      )
      setNote("")
    } catch (cause) {
      setDetailError(errorMessage(cause, "Could not save this note."))
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head pipeline-page-head">
        <div>
          <div className="fc-eyebrow">Hiring pipeline</div>
          <h1>Candidate Pipeline</h1>
          <p>Move applicants through the six recruitment stages.</p>
        </div>
        <div className="pipeline-toolbar">
          <label>
            <span className="sr-only">Filter by job</span>
            <select
              className="fc-input"
              value={selectedJobId ?? ""}
              onChange={(event) =>
                setSelectedJobId(
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
            >
              <option value="">All jobs</option>
              {jobs.map((job) => (
                <option value={job.job_id} key={job.job_id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="fc-btn fc-btn--secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {success && (
        <div className="job-alert job-alert--success" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{success}</span>
          <button onClick={() => setSuccess("")} aria-label="Dismiss success">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="fc-card pipeline-page-state" aria-live="polite">
          <span className="state-spinner" />
          <strong>Loading candidate pipeline</strong>
          <p>Fetching applications and their current stages...</p>
        </div>
      ) : error ? (
        <div className="fc-card pipeline-page-state" role="alert">
          <AlertCircle size={30} aria-hidden="true" />
          <strong>Pipeline could not be loaded</strong>
          <p>{error}</p>
          <button
            className="fc-btn fc-btn--secondary"
            onClick={() => void load()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="fc-card pipeline-page-state">
          <UserRound size={32} aria-hidden="true" />
          <strong>No candidates in this pipeline</strong>
          <p>
            Applications submitted to a published FitCV job will appear here.
          </p>
        </div>
      ) : (
        <div className="pipeline-board" aria-label="Candidate pipeline board">
          {stages.map((stage) => (
            <section
              className={`pipeline-column pipeline-column--${stage.toLowerCase()}`}
              key={stage}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const applicationId = Number(
                  event.dataTransfer.getData("text/plain"),
                )
                const application = applications.find(
                  (item) => item.application_id === applicationId,
                )
                if (application) void move(application, stage)
              }}
            >
              <div className="pipeline-column-head">
                <span />
                <h2>{stage}</h2>
                <strong>{grouped[stage].length}</strong>
              </div>
              <div className="pipeline-column-cards">
                {grouped[stage].length === 0 ? (
                  <div className="pipeline-column-empty">
                    Drop a candidate here
                  </div>
                ) : (
                  grouped[stage].map((application) => (
                    <button
                      className="fc-card pipeline-candidate-card"
                      type="button"
                      key={application.application_id}
                      draggable
                      disabled={movingId === application.application_id}
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          "text/plain",
                          String(application.application_id),
                        )
                      }
                      onClick={() => void openDetails(application)}
                    >
                      <div className="pipeline-candidate-head">
                        <span>{initials(application.candidate_name)}</span>
                        <div>
                          <strong>{application.candidate_name}</strong>
                          <small>{application.job_title}</small>
                        </div>
                      </div>
                      <div className="pipeline-candidate-foot">
                        <span
                          className={`pipeline-score ${scoreClass(
                            application.overall_score,
                          )}`}
                        >
                          {application.overall_score == null
                            ? "Pending"
                            : `${Math.round(application.overall_score)}%`}
                        </span>
                        {application.note_count > 0 && (
                          <span>
                            <MessageSquare size={12} aria-hidden="true" />
                            {application.note_count}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <div className="pipeline-modal-backdrop" role="presentation">
          <div
            className="fc-card pipeline-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-candidate-title"
          >
            <div className="pipeline-modal-head">
              <div>
                <div className="fc-eyebrow">Candidate details</div>
                <h2 id="pipeline-candidate-title">{selected.candidate_name}</h2>
              </div>
              <button
                className="fc-icon-btn"
                onClick={() => setSelected(null)}
                aria-label="Close candidate details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {detailError && (
              <div className="job-alert job-alert--error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{detailError}</span>
              </div>
            )}

            <div className="pipeline-contact-grid">
              <span>
                <Mail size={14} aria-hidden="true" />
                {selected.candidate_email || "Email unavailable"}
              </span>
              <span>
                <Phone size={14} aria-hidden="true" />
                {selected.candidate_phone || "Phone unavailable"}
              </span>
              <span>
                <CalendarDays size={14} aria-hidden="true" />
                Applied {formatDate(selected.applied_at)}
              </span>
            </div>

            <div className="pipeline-stage-editor">
              <label>
                <span className="fc-field-label">Recruitment stage</span>
                <select
                  className="fc-input"
                  value={selected.current_stage}
                  disabled={movingId === selected.application_id}
                  onChange={(event) =>
                    void move(selected, event.target.value as PipelineStage)
                  }
                >
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span className="fc-field-label">Match score</span>
                <strong
                  className={`pipeline-modal-score ${scoreClass(
                    selected.overall_score,
                  )}`}
                >
                  {selected.overall_score == null
                    ? "Analysis pending"
                    : `${Math.round(selected.overall_score)}% · ${
                        selected.match_label ?? "Scored"
                      }`}
                </strong>
              </div>
            </div>

            <section className="pipeline-detail-section">
              <h3>Notes</h3>
              <div className="pipeline-note-compose">
                <textarea
                  className="fc-input"
                  value={note}
                  rows={3}
                  maxLength={5000}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a factual recruiter note..."
                />
                <button
                  className="fc-btn fc-btn--primary"
                  disabled={savingNote || !note.trim()}
                  onClick={() => void addNote()}
                >
                  <Send size={14} aria-hidden="true" />
                  {savingNote ? "Saving..." : "Add note"}
                </button>
              </div>
              {detailLoading ? (
                <p className="pipeline-detail-empty">Loading activity...</p>
              ) : notes.length === 0 ? (
                <p className="pipeline-detail-empty">
                  No recruiter notes for this candidate.
                </p>
              ) : (
                <div className="pipeline-note-list">
                  {notes.map((item) => (
                    <article key={item.note_id}>
                      <div>
                        <strong>{item.author_name}</strong>
                        <time>{formatDate(item.created_at)}</time>
                      </div>
                      <p>{item.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="pipeline-detail-section">
              <h3>Stage history</h3>
              {detailLoading ? null : history.length === 0 ? (
                <p className="pipeline-detail-empty">
                  Stage changes will be recorded here.
                </p>
              ) : (
                <div className="pipeline-history-list">
                  {history.map((item) => (
                    <div key={item.stage_history_id}>
                      <Clock3 size={14} aria-hidden="true" />
                      <p>
                        <strong>{item.new_stage}</strong>
                        <span>
                          {item.changed_by_name} · {formatDate(item.changed_at)}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
