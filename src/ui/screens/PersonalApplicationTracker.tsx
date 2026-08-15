import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"

import { createPortal } from "react-dom"

import {
  WarningCircle,
  Bell,
  Clock,
  ArrowSquareOut,
  Spinner,
  PencilSimpleLine,
  Plus,
  MagnifyingGlass,
  PaperPlaneRight,
  TrashSimple,
  X,
  CaretDown,
  Check,
  ChatText,
  Tray,
  Briefcase,
  CalendarBlank,
  LinkSimple,
  ArrowRight,
} from "@phosphor-icons/react"

import { applicationApi } from "@/api/applicationApi"

import {
  getCachedResource,
  getOrFetchResource,
  setCachedResource,
} from "@/services/resourceCache"

import {
  APPLICATION_STATUSES,
  type ApplicationDetail,
  type ApplicationInput,
  type ApplicationStats,
  type ApplicationStatus,
  type TrackedApplication,
} from "@/types/application"

const SOURCES = ["LinkedIn", "TopCV", "Referral", "Company Website", "Other"]

const STATUS_COLORS: Record<
  ApplicationStatus,
  { color: string; background: string; solid: string }
> = {
  Applied: { color: "#475569", background: "#F1F5F9", solid: "#64748B" },

  Screening: { color: "#1D4ED8", background: "#DBEAFE", solid: "#2563EB" },

  Interview: { color: "#B45309", background: "#FEF3C7", solid: "#F59E0B" },

  Offer: { color: "#15803D", background: "#DCFCE7", solid: "#16A34A" },

  Rejected: { color: "#B91C1C", background: "#FEE2E2", solid: "#DC2626" },
}

const EMPTY_STATS: ApplicationStats = {
  total: 0,

  remindersDue: 0,

  byStatus: { Applied: 0, Screening: 0, Interview: 0, Offer: 0, Rejected: 0 },
}

const PERSONAL_TRACKER_CACHE_KEY = "personal-tracker:summary"

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

function formatDayLabel(value: string) {
  const date = new Date(value)

  const today = new Date()

  const yesterday = new Date(today)

  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"

  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

  return date.toLocaleDateString(undefined, {
    day: "2-digit",

    month: "short",

    year: "numeric",
  })
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",

    minute: "2-digit",
  })
}

function groupNotificationsByDay(
  notifications: ApplicationDetail["notifications"],
) {
  const sorted = [...notifications].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )

  const groups: {
    key: string
    label: string
    items: ApplicationDetail["notifications"]
  }[] = []

  for (const item of sorted) {
    const key = new Date(item.createdAt).toDateString()

    const current = groups[groups.length - 1]

    if (current && current.key === key) current.items.push(item)
    else
      groups.push({
        key,
        label: formatDayLabel(item.createdAt),
        items: [item],
      })
  }

  return groups
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

/* ------------------------------------------------------------------
   Modal shell — centered dialog rendered through a portal so it never
   inherits weird layout from the table/list behind it.
------------------------------------------------------------------ */
function ModalShell({
  title,

  onClose,

  children,
}: {
  title: string

  onClose: () => void

  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", onKey)

    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div
      className="pt-modal-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pt-modal"
      >
        <header className="pt-modal__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="fc-icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} weight="light" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------
   Custom status dropdown — replaces the ugly native <select> pill.
------------------------------------------------------------------ */
function StatusDropdown({
  value,

  onChange,
}: {
  value: ApplicationStatus

  onChange: (next: ApplicationStatus) => void
}) {
  const [open, setOpen] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)

    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)

      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const colors = STATUS_COLORS[value]

  return (
    <div className="pt-status" ref={rootRef}>
      <button
        type="button"
        className="pt-status__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{ color: colors.color, background: colors.background }}
      >
        <i style={{ background: colors.solid }} aria-hidden="true" />
        {value}
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden="true"
          style={{
            transition: "transform 0.18s ease",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <ul className="pt-status__menu" role="listbox" aria-label="Set status">
          {APPLICATION_STATUSES.map((status) => {
            const option = STATUS_COLORS[status]

            const active = status === value

            return (
              <li key={status}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="pt-status__option"
                  data-active={active}
                  onClick={() => {
                    setOpen(false)

                    onChange(status)
                  }}
                >
                  <i style={{ background: option.solid }} aria-hidden="true" />
                  <span>{status}</span>
                  {active && (
                    <Check size={13} weight="bold" aria-hidden="true" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   Add / edit form modal
------------------------------------------------------------------ */
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
      <form onSubmit={submit} className="pt-form">
        {error && (
          <div className="tracker-alert tracker-alert--error" role="alert">
            <WarningCircle size={15} weight="light" /> {error}
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

        <div className="pt-form__actions">
          <button
            type="button"
            className="fitcv-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="fitcv-btn-primary" disabled={saving}>
            {saving && (
              <Spinner className="tracker-spin" size={15} weight="light" />
            )}
            {saving ? "Saving…" : "Save application"}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------
   Detail modal — notes + timeline, two clean columns
------------------------------------------------------------------ */
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
      setError(
        reason instanceof Error ? reason.message : "Could not add note.",
      )
    }
  }

  return (
    <ModalShell
      title={`${detail.companyName} — ${detail.positionTitle}`}
      onClose={onClose}
    >
      <div className="pt-detail">
        <section className="pt-detail__notes" aria-label="Notes">
          <div className="fc-eyebrow">Notes ({detail.noteCount})</div>

          <form onSubmit={addNote} className="pt-note-composer">
            <textarea
              className="fc-input"
              rows={2}
              maxLength={2000}
              placeholder="Add interview details, contacts, or next steps..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="fitcv-btn-primary pt-note-composer__send"
              disabled={busy || !note.trim()}
              aria-label="Add note"
            >
              <PaperPlaneRight size={15} weight="light" />
            </button>
          </form>

          {error && (
            <div className="tracker-alert tracker-alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="pt-note-list">
            {detail.notes.length === 0 && (
              <p className="pt-empty-hint">No notes yet.</p>
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
                    <TrashSimple size={13} weight="light" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="pt-detail__timeline" aria-label="Status timeline">
          <div className="fc-eyebrow">Activity timeline</div>

          <div className="pt-timeline">
            {detail.notifications.length === 0 && (
              <p className="pt-empty-hint">No activity yet.</p>
            )}
            {groupNotificationsByDay(detail.notifications).map((group) => (
              <div className="pt-timeline__group" key={group.key}>
                <div className="pt-timeline__day">{group.label}</div>
                {group.items.map((item) => {
                  const relatedHistory = detail.statusHistory.find(
                    (history) => history.changedAt === item.createdAt,
                  )
                  const status = relatedHistory?.newStatus ?? detail.status
                  const previousStatus = relatedHistory?.previousStatus ?? null
                  const colors = STATUS_COLORS[status]
                  const previousColors = previousStatus
                    ? STATUS_COLORS[previousStatus]
                    : null

                  return (
                    <div
                      className="pt-timeline__item"
                      key={item.notificationId}
                    >
                      <span
                        className="pt-timeline__dot"
                        aria-hidden="true"
                        style={{
                          background: colors.solid,

                          boxShadow: `0 0 0 4px ${colors.background}`,
                        }}
                      />
                      <div className="pt-timeline__body">
                        <div className="pt-timeline__row">
                          {previousColors && previousStatus ? (
                            <span className="pt-timeline__move">
                              <span
                                className="pt-timeline__stage"
                                style={{
                                  color: previousColors.color,

                                  background: previousColors.background,
                                }}
                              >
                                {previousStatus}
                              </span>
                              <ArrowRight
                                size={11}
                                weight="bold"
                                aria-hidden="true"
                              />
                              <span
                                className="pt-timeline__stage"
                                style={{
                                  color: colors.color,

                                  background: colors.background,
                                }}
                              >
                                {status}
                              </span>
                            </span>
                          ) : (
                            <span
                              className="pt-timeline__stage"
                              style={{
                                color: colors.color,

                                background: colors.background,
                              }}
                            >
                              {status}
                            </span>
                          )}
                          <time>{formatClock(item.createdAt)}</time>
                        </div>
                        <p className="pt-timeline__message">{item.message}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------
   Main screen
------------------------------------------------------------------ */
export default function PersonalApplicationTracker() {
  const cachedTracker = getCachedResource<{
    applications: TrackedApplication[]
    stats: ApplicationStats
  }>(PERSONAL_TRACKER_CACHE_KEY)

  const [applications, setApplications] = useState<TrackedApplication[]>(
    cachedTracker?.applications ?? [],
  )

  const [stats, setStats] = useState<ApplicationStats>(
    cachedTracker?.stats ?? EMPTY_STATS,
  )

  const [search, setSearch] = useState("")

  const [statusFilter, setStatusFilter] = useState<"All" | ApplicationStatus>(
    "All",
  )

  const [sourceFilter, setSourceFilter] = useState("All")

  const [remindersOnly, setRemindersOnly] = useState(false)

  const [loading, setLoading] = useState(() => !cachedTracker)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [formState, setFormState] = useState<{
    id: number | null

    initial: ApplicationInput
  } | null>(null)

  const [detail, setDetail] = useState<ApplicationDetail | null>(null)

  const load = async (force = false) => {
    setError(null)

    try {
      const snapshot = await getOrFetchResource(
        PERSONAL_TRACKER_CACHE_KEY,
        async () => {
          const [items, summary] = await Promise.all([
            applicationApi.list(),
            applicationApi.stats(),
          ])
          return { applications: items, stats: summary }
        },
        { force },
      )

      setApplications(snapshot.applications)

      setStats(snapshot.stats)
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

  const maxStageCount = Math.max(
    1,
    ...APPLICATION_STATUSES.map((stage) => stats.byStatus[stage] ?? 0),
  )

  const saveApplication = async (payload: ApplicationInput) => {
    setSaving(true)

    try {
      if (formState?.id) await applicationApi.update(formState.id, payload)
      else await applicationApi.create(payload)

      setFormState(null)

      await load(true)
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

      await load(true)
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

    await load(true)
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

      await load(true)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete application.",
      )
    }
  }

  return (
    <div className="tracker-workspace">
      <div className="fc-page-head">
        <div>
          <h1>Application Tracker</h1>
          <p>
            Track applications, follow-ups, notes, and every status change in
            one place.
          </p>
        </div>
        <button
          type="button"
          className="fitcv-btn-primary"
          onClick={() => setFormState({ id: null, initial: emptyForm() })}
        >
          <Plus size={15} weight="light" /> Add application
        </button>
      </div>

      {error && (
        <div className="tracker-alert tracker-alert--error" role="alert">
          <WarningCircle size={16} weight="light" /> <span>{error}</span>
          <button type="button" onClick={() => void load(true)}>
            Retry
          </button>
        </div>
      )}

      {/* ---- Pipeline overview: per-stage cards + slim distribution bar ---- */}
      <section className="pt-overview" aria-label="Pipeline overview">
        <div className="pt-overview__head">
          <div>
            <span className="fc-eyebrow">Pipeline overview</span>
            <h2>{stats.total} applications</h2>
          </div>
          <span
            className={`pt-due ${stats.remindersDue > 0 ? "pt-due--active" : ""}`}
          >
            <Bell size={13} weight="light" />
            {stats.remindersDue > 0
              ? `${stats.remindersDue} follow-up${stats.remindersDue === 1 ? "" : "s"} due`
              : "No follow-ups due"}
          </span>
        </div>

        {stats.total > 0 && (
          <>
            <div className="pt-stages">
              {APPLICATION_STATUSES.map((stage) => {
                const colors = STATUS_COLORS[stage]

                const count = stats.byStatus[stage] ?? 0

                const active = statusFilter === stage

                return (
                  <button
                    type="button"
                    key={stage}
                    className="pt-stage"
                    data-active={active}
                    aria-pressed={active}
                    onClick={() =>
                      setStatusFilter((current) =>
                        current === stage ? "All" : stage,
                      )
                    }
                  >
                    <span className="pt-stage__label">
                      <i style={{ background: colors.solid }} aria-hidden="true" />
                      {stage}
                    </span>
                    <strong className="pt-stage__count">{count}</strong>
                    <span
                      className="pt-stage__bar"
                      role="img"
                      aria-label={`${count} of ${stats.total}`}
                    >
                      <span
                        style={{
                          width: `${Math.round((count / maxStageCount) * 100)}%`,

                          background: colors.solid,
                        }}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* ---- Toolbar ---- */}
      <div className="tracker-filters">
        <label className="fc-search tracker-search">
          <MagnifyingGlass size={15} weight="light" />
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
          type="button"
          className={`fc-chip ${remindersOnly ? "fc-chip--active" : ""}`}
          onClick={() => setRemindersOnly((value) => !value)}
        >
          <Bell size={13} weight="light" /> Follow-ups
        </button>
      </div>

      {/* ---- Application list ---- */}
      {loading ? (
        <div className="fitcv-card tracker-empty">
          <Spinner className="tracker-spin" size={24} weight="light" />
          <strong>Loading applications…</strong>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fitcv-card tracker-empty">
          <Tray size={34} weight="light" color="#94A3B8" />
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
        <div className="pt-list">
          {filtered.map((application) => {
            const colors = STATUS_COLORS[application.status]

            return (
              <article
                key={application.applicationId}
                className="pt-card"
                style={{ borderLeftColor: colors.solid }}
              >
                <div className="pt-card__main">
                  <div className="pt-card__identity">
                    <span className="pt-card__logo" aria-hidden="true">
                      {application.companyName.charAt(0).toUpperCase()}
                    </span>
                    <div className="pt-card__heading">
                      <div className="pt-card__title-row">
                        <h3>{application.positionTitle}</h3>
                        {application.reminderDue && (
                          <span className="pt-reminder">
                            <Clock size={11} weight="light" />
                            {application.reminderReason ?? "Follow-up due"}
                          </span>
                        )}
                      </div>
                      <p>{application.companyName}</p>
                    </div>
                  </div>

                  <div className="pt-card__meta">
                    <span>
                      <CalendarBlank size={13} weight="light" />
                      Applied {formatDate(application.appliedOn)}
                    </span>
                    <span>
                      <Briefcase size={13} weight="light" />
                      {application.source}
                    </span>
                    {application.jobUrl && (
                      <a
                        href={application.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <LinkSimple size={13} weight="light" />
                        Job post
                      </a>
                    )}
                    <span className="pt-card__notes">
                      <ChatText size={13} weight="light" />
                      {application.noteCount} note
                      {application.noteCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="pt-card__side">
                  <StatusDropdown
                    value={application.status}
                    onChange={(next) => void updateStatus(application, next)}
                  />
                  <div className="tracker-actions">
                    <button
                      type="button"
                      onClick={() =>
                        void openDetail(application.applicationId)
                      }
                      aria-label="Open notes and timeline"
                      title="Notes & timeline"
                    >
                      <ChatText size={14} weight="light" />
                      <span>{application.noteCount}</span>
                    </button>
                    {application.jobUrl && (
                      <a
                        href={application.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open job posting"
                        title="Open job posting"
                      >
                        <ArrowSquareOut size={14} weight="light" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFormState({
                          id: application.applicationId,

                          initial: applicationToForm(application),
                        })
                      }
                      aria-label="Edit application"
                      title="Edit application"
                    >
                      <PencilSimpleLine size={14} weight="light" />
                    </button>
                    <button
                      type="button"
                      className="tracker-actions__danger"
                      onClick={() => void removeApplication(application)}
                      aria-label="Delete application"
                      title="Delete application"
                    >
                      <TrashSimple size={14} weight="light" />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

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
