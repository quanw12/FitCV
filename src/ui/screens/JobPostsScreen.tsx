import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Edit3,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Users,
  XCircle,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

import { jobsApi } from "@/api/jobsApi"
import type { JobPost, JobStatus, JobWrite } from "@/types/jobs"

type JobListView = "active" | "archived"
type JobAction = "publish" | "close" | "archive" | "unarchive"

interface ManagedJobs {
  active: JobPost[]
  archived: JobPost[]
}

const weightFields = [
  ["skill_weight", "Skills", "Technical and role-specific skills"],
  ["experience_weight", "Experience", "Relevant work and project experience"],
  ["education_weight", "Education", "Degree and academic background"],
  ["soft_skill_weight", "Soft skills", "Communication and collaboration"],
] as const

const sections = [
  ["about_job", "About the job"],
  ["responsibilities", "Responsibilities"],
  ["requirements", "Requirements"],
  ["we_offer", "We offer"],
  ["life_at_company", "Life at company"],
  ["hiring_process", "How we hire"],
] as const

const createEmptyForm = (): JobWrite => ({
  title: "",
  about_job: "",
  responsibilities: "",
  requirements: "",
  we_offer: "",
  life_at_company: "",
  hiring_process: "",
  location: "",
  employment_type: "",
  deadline: "",
  openings_count: 1,
  skill_weight: 45,
  experience_weight: 30,
  education_weight: 15,
  soft_skill_weight: 10,
})

const hasTimezone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
const padDatePart = (value: number) => String(value).padStart(2, "0")

const parseApiDate = (value: string) =>
  new Date(hasTimezone(value) ? value : `${value}Z`)

const toLocalDateTimeInput = (value: string | null) => {
  if (!value) return ""
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

const toUtcIso = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const formatDate = (value: string | null) => {
  if (!value) return "Not set"
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return "Invalid date"
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

const statusBadge = (status: JobStatus) => {
  if (status === "Published") return "fc-badge--green"
  if (status === "Closed") return "fc-badge--gray"
  return "fc-badge--amber"
}

const actionLabels: Record<JobAction, string> = {
  publish: "Publishing...",
  close: "Closing...",
  archive: "Archiving...",
  unarchive: "Restoring...",
}

export default function JobPostsScreen() {
  const [managedJobs, setManagedJobs] = useState<ManagedJobs>({
    active: [],
    archived: [],
  })
  const [listView, setListView] = useState<JobListView>("active")
  const [form, setForm] = useState<JobWrite>(createEmptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    jobId: number
    action: JobAction
  } | null>(null)
  const [loadError, setLoadError] = useState("")
  const [formError, setFormError] = useState("")
  const [actionError, setActionError] = useState("")
  const [success, setSuccess] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const [active, archived] = await Promise.all([
        jobsApi.listManaged(false),
        jobsApi.listManaged(true),
      ])
      setManagedJobs({ active, archived })
    } catch (cause) {
      setLoadError(errorMessage(cause, "Could not load company jobs."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const weightTotal = useMemo(
    () =>
      weightFields.reduce((total, [key]) => total + Number(form[key] ?? 0), 0),
    [form],
  )
  const weightsValid =
    weightFields.every(([key]) => {
      const value = Number(form[key])
      return Number.isFinite(value) && value >= 0 && value <= 100
    }) && Math.abs(weightTotal - 100) < 0.001

  const activeApplications = managedJobs.active.reduce(
    (total, job) => total + job.application_count,
    0,
  )
  const publishedCount = managedJobs.active.filter(
    (job) => job.status === "Published",
  ).length
  const visibleJobs = managedJobs[listView]

  const setField = (key: keyof JobWrite, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const scrollToEditor = () => {
    window.requestAnimationFrame(() => {
      document
        .getElementById("job-editor")
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" })
    })
  }

  const startCreate = () => {
    setForm(createEmptyForm())
    setEditingId(null)
    setFormError("")
    setActionError("")
    setSuccess("")
    setEditorOpen(true)
    scrollToEditor()
  }

  const startEdit = (job: JobPost) => {
    setEditingId(job.job_id)
    setForm({
      title: job.title,
      about_job: job.about_job ?? "",
      responsibilities: job.responsibilities ?? "",
      requirements: job.requirements ?? "",
      we_offer: job.we_offer ?? "",
      life_at_company: job.life_at_company ?? "",
      hiring_process: job.hiring_process ?? "",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "",
      deadline: toLocalDateTimeInput(job.deadline),
      openings_count: job.openings_count,
      skill_weight: job.skill_weight,
      experience_weight: job.experience_weight,
      education_weight: job.education_weight,
      soft_skill_weight: job.soft_skill_weight,
    })
    setFormError("")
    setActionError("")
    setSuccess("")
    setEditorOpen(true)
    scrollToEditor()
  }

  const closeEditor = () => {
    setForm(createEmptyForm())
    setEditingId(null)
    setEditorOpen(false)
    setFormError("")
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setFormError("A title is required, even for a draft.")
      return
    }
    if (
      !Number.isFinite(form.openings_count) ||
      Number(form.openings_count) < 1
    ) {
      setFormError("Openings must be at least 1.")
      return
    }
    if (!weightsValid) {
      setFormError(
        "Each scoring weight must be between 0 and 100, with a total of 100%.",
      )
      return
    }
    const deadline = toUtcIso(form.deadline)
    if (deadline === undefined) {
      setFormError("Enter a valid deadline.")
      return
    }

    setSaving(true)
    setFormError("")
    setActionError("")
    setSuccess("")
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        deadline,
      }
      if (editingId) {
        const updated = await jobsApi.update(editingId, payload)
        setManagedJobs((current) => ({
          ...current,
          active: current.active.map((job) =>
            job.job_id === updated.job_id ? updated : job,
          ),
        }))
        setSuccess(`Saved changes to “${updated.title}”.`)
      } else {
        const created = await jobsApi.create(payload)
        setManagedJobs((current) => ({
          ...current,
          active: [created, ...current.active],
        }))
        setListView("active")
        setSuccess(`Created draft “${created.title}”.`)
      }
      closeEditor()
    } catch (cause) {
      setFormError(errorMessage(cause, "Could not save this job."))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (job: JobPost, action: JobAction) => {
    setPendingAction({ jobId: job.job_id, action })
    setActionError("")
    setSuccess("")
    try {
      const updated = await jobsApi[action](job.job_id)
      if (action === "archive") {
        setManagedJobs((current) => ({
          active: current.active.filter(
            (item) => item.job_id !== updated.job_id,
          ),
          archived: [updated, ...current.archived],
        }))
        if (editingId === updated.job_id) closeEditor()
        setSuccess(
          `Archived “${updated.title}”. Its ${updated.status.toLowerCase()} status was preserved.`,
        )
      } else if (action === "unarchive") {
        setManagedJobs((current) => ({
          active: [updated, ...current.active],
          archived: current.archived.filter(
            (item) => item.job_id !== updated.job_id,
          ),
        }))
        setSuccess(`Restored “${updated.title}” to active jobs.`)
      } else {
        setManagedJobs((current) => ({
          ...current,
          active: current.active.map((item) =>
            item.job_id === updated.job_id ? updated : item,
          ),
        }))
        setSuccess(
          action === "publish"
            ? `Published “${updated.title}”.`
            : `Closed “${updated.title}”.`,
        )
      }
    } catch (cause) {
      setActionError(errorMessage(cause, `Could not ${action} this job.`))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow">Recruitment</div>
          <h1>Job Post Management</h1>
          <p>Create, publish, and maintain your company jobs.</p>
        </div>
        <button className="fc-btn fc-btn--primary" onClick={startCreate}>
          <Plus size={16} aria-hidden="true" />
          New job
        </button>
      </div>

      <div className="job-summary-grid" aria-label="Job post summary">
        <div className="fc-stat job-summary-card">
          <span className="job-summary-icon job-summary-icon--blue">
            <Briefcase size={18} aria-hidden="true" />
          </span>
          <div>
            <strong>{managedJobs.active.length}</strong>
            <span>Active records</span>
          </div>
        </div>
        <div className="fc-stat job-summary-card">
          <span className="job-summary-icon job-summary-icon--green">
            <CheckCircle2 size={18} aria-hidden="true" />
          </span>
          <div>
            <strong>{publishedCount}</strong>
            <span>Published</span>
          </div>
        </div>
        <div className="fc-stat job-summary-card">
          <span className="job-summary-icon job-summary-icon--amber">
            <Users size={18} aria-hidden="true" />
          </span>
          <div>
            <strong>{activeApplications}</strong>
            <span>Applications</span>
          </div>
        </div>
      </div>

      {success && (
        <div className="job-alert job-alert--success" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
          >
            <XCircle size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {actionError && (
        <div className="job-alert job-alert--error" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{actionError}</span>
          <button
            onClick={() => setActionError("")}
            aria-label="Dismiss error message"
          >
            <XCircle size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {editorOpen && (
        <form id="job-editor" className="fc-card job-editor" onSubmit={save}>
          <div className="job-editor-head">
            <div className="fc-section-title">
              <Briefcase size={17} aria-hidden="true" />
              <div>
                <h2>{editingId ? "Edit job post" : "Create job draft"}</h2>
                <p>
                  Save incomplete work as a draft. All marked publishing fields
                  are required before the job can go live.
                </p>
              </div>
            </div>
            <button
              className="fc-icon-btn"
              type="button"
              onClick={closeEditor}
              aria-label="Close job editor"
            >
              <XCircle size={19} aria-hidden="true" />
            </button>
          </div>

          {formError && (
            <div className="job-alert job-alert--error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <section
            className="job-editor-section"
            aria-labelledby="job-basics-title"
          >
            <div className="job-editor-section-title">
              <h3 id="job-basics-title">Job basics</h3>
              <span>Title is required for a draft</span>
            </div>
            <div className="job-form-grid">
              <label className="job-field--wide">
                <span className="fc-field-label">Title *</span>
                <input
                  className="fc-input"
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  autoFocus
                  required
                />
              </label>
              <label>
                <span className="fc-field-label">Location</span>
                <input
                  className="fc-input"
                  value={form.location ?? ""}
                  onChange={(event) => setField("location", event.target.value)}
                  placeholder="Ho Chi Minh City"
                />
              </label>
              <label>
                <span className="fc-field-label">Employment type</span>
                <input
                  className="fc-input"
                  value={form.employment_type ?? ""}
                  onChange={(event) =>
                    setField("employment_type", event.target.value)
                  }
                  placeholder="Full-time"
                  list="employment-types"
                />
                <datalist id="employment-types">
                  <option value="Full-time" />
                  <option value="Part-time" />
                  <option value="Contract" />
                  <option value="Internship" />
                </datalist>
              </label>
              <label>
                <span className="fc-field-label">Deadline</span>
                <input
                  className="fc-input"
                  type="datetime-local"
                  value={form.deadline ?? ""}
                  onChange={(event) => setField("deadline", event.target.value)}
                />
              </label>
              <label>
                <span className="fc-field-label">Openings</span>
                <input
                  className="fc-input"
                  type="number"
                  min={1}
                  value={form.openings_count ?? 1}
                  onChange={(event) =>
                    setField("openings_count", Number(event.target.value))
                  }
                />
              </label>
            </div>
          </section>

          <section
            className="job-editor-section"
            aria-labelledby="job-content-title"
          >
            <div className="job-editor-section-title">
              <h3 id="job-content-title">Job description</h3>
              <span>Required before publishing</span>
            </div>
            <div className="job-description-grid">
              {sections.map(([key, label]) => (
                <label key={key}>
                  <span className="fc-field-label">{label}</span>
                  <textarea
                    className="fc-input"
                    value={form[key] ?? ""}
                    onChange={(event) => setField(key, event.target.value)}
                    rows={5}
                  />
                </label>
              ))}
            </div>
          </section>

          <section
            className="job-editor-section"
            aria-labelledby="job-scoring-title"
          >
            <div className="job-editor-section-title">
              <div>
                <h3 id="job-scoring-title">
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Candidate scoring weights
                </h3>
                <p>Adjust how FitCV will prioritize candidates for this job.</p>
              </div>
              <strong
                className={
                  weightsValid
                    ? "job-weight-total--valid"
                    : "job-weight-total--invalid"
                }
                aria-live="polite"
              >
                Total {weightTotal}%
              </strong>
            </div>
            <div className="job-weight-grid">
              {weightFields.map(([key, label, description]) => (
                <label key={key}>
                  <span className="fc-field-label">{label}</span>
                  <span className="job-weight-input">
                    <input
                      className="fc-input"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form[key] ?? 0}
                      aria-label={`${label} weight`}
                      aria-invalid={!weightsValid}
                      onChange={(event) =>
                        setField(key, Number(event.target.value))
                      }
                    />
                    <span>%</span>
                  </span>
                  <small>{description}</small>
                </label>
              ))}
            </div>
          </section>

          <div className="job-editor-actions">
            <button
              className="fc-btn fc-btn--primary"
              disabled={saving}
              type="submit"
            >
              <Save size={15} aria-hidden="true" />
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Create draft"}
            </button>
            <button
              className="fc-btn fc-btn--secondary"
              type="button"
              onClick={closeEditor}
              disabled={saving}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Cancel
            </button>
          </div>
        </form>
      )}

      <section
        className="job-list-section"
        aria-labelledby="company-jobs-title"
      >
        <div className="job-list-head">
          <div>
            <div className="fc-eyebrow">Company jobs</div>
            <h2 id="company-jobs-title">Recruitment records</h2>
          </div>
          <button
            className="fc-btn fc-btn--secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? "job-spin" : undefined}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        <div
          className="job-tabs"
          role="tablist"
          aria-label="Job record filters"
        >
          <button
            id="active-jobs-tab"
            role="tab"
            aria-selected={listView === "active"}
            aria-controls="job-list-panel"
            className={listView === "active" ? "is-active" : undefined}
            onClick={() => setListView("active")}
          >
            Active
            <span>{managedJobs.active.length}</span>
          </button>
          <button
            id="archived-jobs-tab"
            role="tab"
            aria-selected={listView === "archived"}
            aria-controls="job-list-panel"
            className={listView === "archived" ? "is-active" : undefined}
            onClick={() => setListView("archived")}
          >
            Archived
            <span>{managedJobs.archived.length}</span>
          </button>
        </div>

        <div
          id="job-list-panel"
          role="tabpanel"
          aria-labelledby={`${listView}-jobs-tab`}
        >
          {loading ? (
            <div className="fc-card job-list-state" aria-live="polite">
              <span className="state-spinner" />
              <strong>Loading company jobs</strong>
              <p>Fetching the latest recruitment records...</p>
            </div>
          ) : loadError ? (
            <div className="fc-card job-list-state" role="alert">
              <AlertCircle size={28} aria-hidden="true" />
              <strong>Jobs could not be loaded</strong>
              <p>{loadError}</p>
              <button
                className="fc-btn fc-btn--secondary"
                onClick={() => void load()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="fc-card job-list-state">
              {listView === "active" ? (
                <>
                  <Briefcase size={30} aria-hidden="true" />
                  <strong>No active job records yet</strong>
                  <p>Create a draft, complete its details, then publish it.</p>
                  <button
                    className="fc-btn fc-btn--primary"
                    onClick={startCreate}
                  >
                    <Plus size={15} aria-hidden="true" />
                    Create first job
                  </button>
                </>
              ) : (
                <>
                  <Archive size={30} aria-hidden="true" />
                  <strong>No archived jobs</strong>
                  <p>
                    Jobs you archive will remain available here for restoration.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="job-card-list">
              {visibleJobs.map((job) => {
                const busyAction =
                  pendingAction?.jobId === job.job_id
                    ? pendingAction.action
                    : null
                return (
                  <article className="fc-card job-post-card" key={job.job_id}>
                    <div className="job-post-main">
                      <div className="job-post-title-row">
                        <div>
                          <h3>{job.title}</h3>
                          <div className="job-post-meta">
                            <span>
                              <MapPin size={13} aria-hidden="true" />
                              {job.location || "Location pending"}
                            </span>
                            <span>
                              <CalendarDays size={13} aria-hidden="true" />
                              Deadline {formatDate(job.deadline)}
                            </span>
                          </div>
                        </div>
                        <span className={`fc-badge ${statusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </div>

                      {job.about_job && (
                        <p className="job-post-summary">{job.about_job}</p>
                      )}

                      <div className="job-post-facts">
                        <span>{job.employment_type || "Type pending"}</span>
                        <span>{job.openings_count} openings</span>
                        <span>{job.application_count} applications</span>
                        {job.archived_at && (
                          <span>Archived {formatDate(job.archived_at)}</span>
                        )}
                      </div>

                      <div
                        className="job-score-summary"
                        aria-label="Candidate scoring weights"
                      >
                        {weightFields.map(([key, label]) => (
                          <span key={key}>
                            {label} <strong>{job[key]}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="job-post-actions">
                      {listView === "archived" ? (
                        <button
                          className="fc-btn fc-btn--secondary"
                          disabled={Boolean(busyAction)}
                          onClick={() => void runAction(job, "unarchive")}
                        >
                          <ArchiveRestore size={14} aria-hidden="true" />
                          {busyAction === "unarchive"
                            ? actionLabels.unarchive
                            : "Restore"}
                        </button>
                      ) : (
                        <>
                          {job.status !== "Published" && (
                            <button
                              className="fc-btn fc-btn--secondary"
                              disabled={Boolean(busyAction)}
                              onClick={() => startEdit(job)}
                            >
                              <Edit3 size={14} aria-hidden="true" />
                              Edit
                            </button>
                          )}
                          {job.status !== "Published" && (
                            <button
                              className="fc-btn fc-btn--primary"
                              disabled={Boolean(busyAction)}
                              onClick={() => void runAction(job, "publish")}
                            >
                              <Plus size={14} aria-hidden="true" />
                              {busyAction === "publish"
                                ? actionLabels.publish
                                : job.status === "Closed"
                                  ? "Reopen"
                                  : "Publish"}
                            </button>
                          )}
                          {job.status === "Published" && (
                            <button
                              className="fc-btn fc-btn--secondary"
                              disabled={Boolean(busyAction)}
                              onClick={() => void runAction(job, "close")}
                            >
                              <XCircle size={14} aria-hidden="true" />
                              {busyAction === "close"
                                ? actionLabels.close
                                : "Close"}
                            </button>
                          )}
                          <button
                            className="fc-btn fc-btn--ghost job-archive-action"
                            disabled={Boolean(busyAction)}
                            onClick={() => void runAction(job, "archive")}
                          >
                            <Archive size={14} aria-hidden="true" />
                            {busyAction === "archive"
                              ? actionLabels.archive
                              : "Archive"}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
