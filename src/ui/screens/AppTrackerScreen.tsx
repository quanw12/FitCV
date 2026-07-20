import { type FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Bell,
  Clock,
  ExternalLink,
  LoaderCircle,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { applicationApi } from "@/api/applicationApi"
import {
  APPLICATION_STATUSES,
  type ApplicationDetail,
  type ApplicationInput,
  type ApplicationStats,
  type ApplicationStatus,
  type TrackedApplication,
} from "@/types/application"

const SOURCES = ["LinkedIn", "TopCV", "Referral", "Company Website", "Other"]
const STATUS_COLORS: Record<ApplicationStatus, {
  color: string
  background: string
}> = {
  Applied: { color: "#475569", background: "#F1F5F9" },
  Screening: { color: "#1D4ED8", background: "#DBEAFE" },
  Interview: { color: "#B45309", background: "#FEF3C7" },
  Offer: { color: "#15803D", background: "#DCFCE7" },
  Rejected: { color: "#B91C1C", background: "#FEE2E2" },
}
const STAGE_COLORS = ["#64748B", "#2563EB", "#F59E0B", "#16A34A", "#DC2626"]

const EMPTY_STATS: ApplicationStats = {
  total: 0,
  remindersDue: 0,
  byStatus: { Applied: 0, Screening: 0, Interview: 0, Offer: 0, Rejected: 0 },
}

function todayInputValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function emptyForm(): ApplicationInput {
  return {
    companyName: "",
    positionTitle: "",
    appliedOn: todayInputValue(),
    source: "LinkedIn",
    status: "Applied",
    jobUrl: "",
    reminderAt: null,
  }
}

function applicationToForm(application: TrackedApplication): ApplicationInput {
  return {
    companyName: application.companyName,
    positionTitle: application.positionTitle,
    appliedOn: application.appliedOn,
    source: application.source,
    status: application.status,
    jobUrl: application.jobUrl ?? "",
    reminderAt: toDateTimeLocal(application.reminderAt),
  }
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(15, 23, 42, 0.48)",
        backdropFilter: "blur(3px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fitcv-card"
        style={{
          width: "min(680px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 750 }}>{title}</h2>
          <button
            type="button"
            className="fc-icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function ApplicationFormModal({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: ApplicationInput
  saving: boolean
  onClose: () => void
  onSave: (payload: ApplicationInput) => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const field = (name: keyof ApplicationInput, value: string) =>
    setForm((current) => ({ ...current, [name]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await onSave({
        ...form,
        companyName: form.companyName.trim(),
        positionTitle: form.positionTitle.trim(),
        jobUrl: form.jobUrl?.trim() || null,
        reminderAt: form.reminderAt
          ? new Date(form.reminderAt).toISOString()
          : null,
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save this application.",
      )
    }
  }

  return (
    <ModalShell
      title={initial.companyName ? "Edit application" : "Add application"}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 15 }}>
        {error && (
          <div className="tracker-alert tracker-alert--error">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        <div className="tracker-form-grid">
          <label>
            <span className="fc-field-label">Company</span>
            <input
              className="fc-input"
              required
              maxLength={200}
              value={form.companyName}
              onChange={(e) => field("companyName", e.target.value)}
            />
          </label>
          <label>
            <span className="fc-field-label">Position</span>
            <input
              className="fc-input"
              required
              maxLength={200}
              value={form.positionTitle}
              onChange={(e) => field("positionTitle", e.target.value)}
            />
          </label>
          <label>
            <span className="fc-field-label">Date applied</span>
            <input
              className="fc-input"
              required
              type="date"
              max={todayInputValue()}
              value={form.appliedOn}
              onChange={(e) => field("appliedOn", e.target.value)}
            />
          </label>
          <label>
            <span className="fc-field-label">Source</span>
            <select
              className="fc-input"
              value={form.source}
              onChange={(e) => field("source", e.target.value)}
            >
              {(SOURCES.includes(form.source)
                ? SOURCES
                : [form.source, ...SOURCES]
              ).map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="fc-field-label">Status</span>
            <select
              className="fc-input"
              value={form.status}
              onChange={(e) => field("status", e.target.value)}
            >
              {APPLICATION_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="fc-field-label">Follow-up reminder</span>
            <input
              className="fc-input"
              type="datetime-local"
              value={form.reminderAt ?? ""}
              onChange={(e) => field("reminderAt", e.target.value)}
            />
          </label>
        </div>
        <label>
          <span className="fc-field-label">Job URL (optional)</span>
          <input
            className="fc-input"
            type="url"
            maxLength={500}
            placeholder="https://..."
            value={form.jobUrl ?? ""}
            onChange={(e) => field("jobUrl", e.target.value)}
          />
        </label>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            className="fitcv-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="fitcv-btn-primary" disabled={saving}>
            {saving && <LoaderCircle className="tracker-spin" size={15} />}
            {saving ? "Saving..." : "Save application"}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ApplicationDetailModal({
  detail,
  busy,
  onClose,
  onAddNote,
  onDeleteNote,
}: {
  detail: ApplicationDetail
  busy: boolean
  onClose: () => void
  onAddNote: (content: string) => Promise<void>
  onDeleteNote: (noteId: number) => Promise<void>
}) {
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const addNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!note.trim()) return
    setError(null)
    try {
      await onAddNote(note.trim())
      setNote("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add note.")
    }
  }

  return (
    <ModalShell
      title={`${detail.companyName} — ${detail.positionTitle}`}
      onClose={onClose}
    >
      <div className="tracker-detail-grid">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 9 }}>
            Notes ({detail.noteCount})
          </div>
          <form
            onSubmit={addNote}
            style={{ display: "flex", gap: 8, marginBottom: 13 }}
          >
            <textarea
              className="fc-input"
              rows={2}
              maxLength={2000}
              placeholder="Add interview details, contacts, or next steps..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="fitcv-btn-primary"
              disabled={busy || !note.trim()}
              aria-label="Add note"
            >
              <Send size={15} />
            </button>
          </form>
          {error && (
            <div className="tracker-alert tracker-alert--error">{error}</div>
          )}
          <div style={{ display: "grid", gap: 9 }}>
            {detail.notes.length === 0 && (
              <p className="tracker-muted">No notes yet.</p>
            )}
            {detail.notes.map((item) => (
              <article key={item.noteId} className="tracker-note">
                <p>{item.content}</p>
                <div>
                  <time>{formatDateTime(item.createdAt)}</time>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      void onDeleteNote(item.noteId).catch((reason) =>
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Could not delete note.",
                        ),
                      )
                    }}
                    aria-label="Delete note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 9 }}>
            Status history
          </div>
          <div className="tracker-history">
            {detail.statusHistory.map((item) => (
              <div key={item.statusHistoryId}>
                <span
                  style={{
                    background: STATUS_COLORS[item.newStatus].background,
                    color: STATUS_COLORS[item.newStatus].color,
                  }}
                />
                <div>
                  <strong>{item.newStatus}</strong>
                  <time>{formatDateTime(item.changedAt)}</time>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

export default function AppTrackerScreen() {
  const [applications, setApplications] = useState<TrackedApplication[]>([])
  const [stats, setStats] = useState<ApplicationStats>(EMPTY_STATS)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | ApplicationStatus>(
    "All",
  )
  const [sourceFilter, setSourceFilter] = useState("All")
  const [remindersOnly, setRemindersOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<{
    id: number | null
    initial: ApplicationInput
  } | null>(null)
  const [detail, setDetail] = useState<ApplicationDetail | null>(null)

  const load = async () => {
    setError(null)
    try {
      const [items, summary] = await Promise.all([
        applicationApi.list(),
        applicationApi.stats(),
      ])
      setApplications(items)
      setStats(summary)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load applications.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const sourceOptions = useMemo(
    () => [
      "All",
      ...Array.from(new Set(applications.map((item) => item.source))).sort(),
    ],
    [applications],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return applications.filter((item) => {
      const matchesSearch =
        !query ||
        item.companyName.toLocaleLowerCase().includes(query) ||
        item.positionTitle.toLocaleLowerCase().includes(query)
      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter
      const matchesSource =
        sourceFilter === "All" || item.source === sourceFilter
      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        (!remindersOnly || item.reminderDue)
      )
    })
  }, [applications, remindersOnly, search, sourceFilter, statusFilter])

  const chartData = APPLICATION_STATUSES.map((stage) => ({
    stage,
    count: stats.byStatus[stage] ?? 0,
  }))

  const saveApplication = async (payload: ApplicationInput) => {
    setSaving(true)
    try {
      if (formState?.id) await applicationApi.update(formState.id, payload)
      else await applicationApi.create(payload)
      setFormState(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (
    application: TrackedApplication,
    nextStatus: ApplicationStatus,
  ) => {
    if (nextStatus === application.status) return
    setError(null)
    try {
      await applicationApi.update(application.applicationId, {
        status: nextStatus,
      })
      await load()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update status.",
      )
    }
  }

  const openDetail = async (applicationId: number) => {
    setError(null)
    try {
      setDetail(await applicationApi.get(applicationId))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load application details.",
      )
    }
  }

  const refreshDetail = async () => {
    if (!detail) return
    setDetail(await applicationApi.get(detail.applicationId))
    await load()
  }

  const removeApplication = async (application: TrackedApplication) => {
    if (
      !window.confirm(
        `Delete the application at ${application.companyName}? This also removes its notes and history.`,
      )
    )
      return
    setError(null)
    try {
      await applicationApi.delete(application.applicationId)
      await load()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete application.",
      )
    }
  }

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <h1>Application Tracker</h1>
          <p>
            Track applications, follow-ups, notes, and every status change in
            one place.
          </p>
        </div>
        <button
          className="fitcv-btn-primary"
          onClick={() => setFormState({ id: null, initial: emptyForm() })}
        >
          <Plus size={15} /> Add application
        </button>
      </div>

      {error && (
        <div className="tracker-alert tracker-alert--error" role="alert">
          <AlertCircle size={16} /> <span>{error}</span>
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}

      <div className="tracker-summary-grid">
        <div className="fitcv-card tracker-chart-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <span className="fc-eyebrow">Pipeline overview</span>
              <h2>{stats.total} applications</h2>
            </div>
            <span className="fc-badge fc-badge--amber">
              <Bell size={12} /> {stats.remindersDue} due
            </span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 20, top: 12 }}
            >
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis
                dataKey="stage"
                type="category"
                tick={{ fontSize: 12, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={15}>
                {chartData.map((_, index) => (
                  <Cell
                    key={APPLICATION_STATUSES[index]}
                    fill={STAGE_COLORS[index]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tracker-filters">
        <label className="fc-search tracker-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or position..."
            aria-label="Search applications"
          />
        </label>
        <select
          className="fc-input tracker-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filter by source"
        >
          {sourceOptions.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>
        <button
          className={`fc-chip ${remindersOnly ? "fc-chip--active" : ""}`}
          onClick={() => setRemindersOnly((value) => !value)}
        >
          <Bell size={13} /> Follow-ups
        </button>
      </div>
      <div className="tracker-status-filters" aria-label="Filter by status">
        {(["All", ...APPLICATION_STATUSES] as const).map((item) => (
          <button
            key={item}
            className={`fc-chip ${
              statusFilter === item ? "fc-chip--active" : ""
            }`}
            onClick={() => setStatusFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="fitcv-card tracker-table-wrap">
        {loading ? (
          <div className="tracker-empty">
            <LoaderCircle className="tracker-spin" size={24} />
            <strong>Loading applications...</strong>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tracker-empty">
            <MessageSquare size={28} />
            <strong>
              {applications.length
                ? "No applications match these filters."
                : "No applications tracked yet."}
            </strong>
            <span>
              {applications.length
                ? "Try clearing a filter."
                : "Add your first application to start tracking follow-ups."}
            </span>
          </div>
        ) : (
          <table className="fc-table">
            <thead>
              <tr>
                {[
                  "Company",
                  "Position",
                  "Date applied",
                  "Source",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((application) => {
                const colors = STATUS_COLORS[application.status]
                return (
                  <tr key={application.applicationId}>
                    <td>
                      <div className="tracker-company">
                        <span>
                          {application.companyName.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>{application.companyName}</strong>
                          {application.reminderDue && (
                            <small>
                              <Clock size={11} /> {application.reminderReason}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong style={{ fontSize: 13 }}>
                        {application.positionTitle}
                      </strong>
                    </td>
                    <td
                      style={{
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(application.appliedOn)}
                    </td>
                    <td>
                      <span className="fc-badge fc-badge--blue">
                        {application.source}
                      </span>
                    </td>
                    <td>
                      <select
                        className="tracker-status-select"
                        aria-label={`Status for ${application.companyName}`}
                        value={application.status}
                        onChange={(e) =>
                          void updateStatus(
                            application,
                            e.target.value as ApplicationStatus,
                          )
                        }
                        style={{
                          color: colors.color,
                          background: colors.background,
                        }}
                      >
                        {APPLICATION_STATUSES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="tracker-actions">
                        <button
                          onClick={() =>
                            void openDetail(application.applicationId)
                          }
                          aria-label="Open notes"
                        >
                          <MessageSquare size={14} />
                          <span>{application.noteCount}</span>
                        </button>
                        {application.jobUrl && (
                          <a
                            href={application.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open job posting"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button
                          onClick={() =>
                            setFormState({
                              id: application.applicationId,
                              initial: applicationToForm(application),
                            })
                          }
                          aria-label="Edit application"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => void removeApplication(application)}
                          aria-label="Delete application"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {formState && (
        <ApplicationFormModal
          initial={formState.initial}
          saving={saving}
          onClose={() => setFormState(null)}
          onSave={saveApplication}
        />
      )}
      {detail && (
        <ApplicationDetailModal
          detail={detail}
          busy={saving}
          onClose={() => setDetail(null)}
          onAddNote={async (content) => {
            setSaving(true)
            try {
              await applicationApi.addNote(detail.applicationId, content)
              await refreshDetail()
            } finally {
              setSaving(false)
            }
          }}
          onDeleteNote={async (noteId) => {
            setSaving(true)
            try {
              await applicationApi.deleteNote(detail.applicationId, noteId)
              await refreshDetail()
            } finally {
              setSaving(false)
            }
          }}
        />
      )}
    </div>
  )
}
