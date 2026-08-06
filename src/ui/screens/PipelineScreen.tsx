import { useCallback, useEffect, useMemo, useState } from "react"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowClockwise,
  CalendarBlank,
  ChatCircle,
  CheckCircle,
  Clock,
  Envelope,
  PaperPlaneRight,
  Phone,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react"

import { jobsApi } from "@/api/jobsApi"
import { pipelineApi } from "@/api/pipelineApi"
import type { JobPost } from "@/types/jobs"
import type {
  PipelineApplication,
  PipelineNote,
  PipelineStage,
  PipelineStageHistory,
} from "@/types/pipeline"
import BezelCard from "@/ui/components/BezelCard"

const stages: PipelineStage[] = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
]

type ScoreFilter = "all" | "strong" | "moderate" | "weak" | "pending"

const stageColors: Record<PipelineStage, {
  dot: string
  text: string
  soft: string
}> = {
  Applied: {
    dot: "var(--text-muted)",
    text: "var(--text-secondary)",
    soft: "var(--gray-soft)",
  },
  Screening: {
    dot: "var(--accent)",
    text: "var(--accent-ink)",
    soft: "var(--accent-soft)",
  },
  Interview: {
    dot: "var(--warning)",
    text: "#92400e",
    soft: "var(--warning-soft)",
  },
  Offer: {
    dot: "var(--accent)",
    text: "var(--accent-ink)",
    soft: "var(--accent-soft)",
  },
  Hired: {
    dot: "var(--success)",
    text: "var(--success)",
    soft: "var(--success-soft)",
  },
  Rejected: {
    dot: "var(--danger)",
    text: "var(--danger)",
    soft: "var(--danger-soft)",
  },
}

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

const scoreColor = (score: number | null) => {
  if (score == null) {
    return { color: "var(--text-muted)", soft: "var(--gray-soft)" }
  }
  if (score >= 80) {
    return { color: "var(--success)", soft: "var(--success-soft)" }
  }
  if (score >= 50) {
    return { color: "var(--warning)", soft: "var(--warning-soft)" }
  }
  return { color: "var(--danger)", soft: "var(--danger-soft)" }
}

function SortableCard({
  application,
  children,
  onOpen,
}: {
  application: PipelineApplication
  children: React.ReactNode
  onOpen: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(application.application_id) })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
      {...attributes}
      {...listeners}
      aria-label={`${application.candidate_name}, ${application.job_title}`}
      onClick={onOpen}
    >
      {children}
    </div>
  )
}

function ColumnArea({
  stage,
  children,
}: {
  stage: PipelineStage
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 132,
        padding: 4,
        margin: -4,
        borderRadius: "var(--r-md)",
        background: isOver ? stageColors[stage].soft : "transparent",
        transition: "background 140ms ease",
      }}
    >
      {children}
    </div>
  )
}

export default function PipelineScreen() {
  const [applications, setApplications] = useState<PipelineApplication[]>([])
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>()
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all")
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkStage, setBulkStage] = useState<PipelineStage>("Screening")
  const [selected, setSelected] = useState<PipelineApplication | null>(null)
  const [activeCard, setActiveCard] = useState<PipelineApplication | null>(null)
  const [notes, setNotes] = useState<PipelineNote[]>([])
  const [history, setHistory] = useState<PipelineStageHistory[]>([])
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [bulkMoving, setBulkMoving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState("")
  const [detailError, setDetailError] = useState("")
  const [success, setSuccess] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

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

  useEffect(() => {
    const availableIds = new Set(applications.map((item) => item.application_id))
    setSelectedIds((current) =>
      current.filter((applicationId) => availableIds.has(applicationId)),
    )
  }, [applications])

  const visibleApplications = useMemo(
    () =>
      applications.filter((application) => {
        if (
          stageFilter !== "all" &&
          application.current_stage !== stageFilter
        ) {
          return false
        }
        if (scoreFilter === "pending") return application.overall_score == null
        if (application.overall_score == null) return false
        if (scoreFilter === "strong") return application.overall_score >= 80
        if (scoreFilter === "moderate") {
          return application.overall_score >= 50 && application.overall_score < 80
        }
        if (scoreFilter === "weak") return application.overall_score < 50
        return true
      }),
    [applications, scoreFilter, stageFilter],
  )

  const visibleIds = useMemo(
    () => visibleApplications.map((application) => application.application_id),
    [visibleApplications],
  )

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))

  const toggleSelection = (applicationId: number) => {
    setSelectedIds((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId],
    )
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id))
      }
      return [...new Set([...current, ...visibleIds])]
    })
  }

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        stages.map((stage) => [
          stage,
          visibleApplications.filter((item) => item.current_stage === stage),
        ]),
      ) as Record<PipelineStage, PipelineApplication[]>,
    [visibleApplications],
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
      setNotes((current) => [
        ...current,
        ...nextNotes.filter(
          (item) =>
            !current.some((existing) => existing.note_id === item.note_id),
        ),
      ])
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

  const bulkMove = async () => {
    if (selectedIds.length === 0 || bulkMoving) return
    setBulkMoving(true)
    setError("")
    setSuccess("")

    try {
      const result = await pipelineApi.bulkMoveStage(selectedIds, bulkStage)
      const updatedById = new Map(
        result.updated.map((application) => [
          application.application_id,
          application,
        ]),
      )
      setApplications((current) =>
        current.map((application) =>
          updatedById.get(application.application_id) ?? application,
        ),
      )
      setSelected((current) =>
        current ? updatedById.get(current.application_id) ?? current : current,
      )
      if (
        selected &&
        updatedById.has(selected.application_id)
      ) {
        setHistory(await pipelineApi.listHistory(selected.application_id))
      }
      setSelectedIds([])
      const skippedMessage = result.skipped_application_ids.length
        ? ` ${result.skipped_application_ids.length} already in ${bulkStage}.`
        : ""
      setSuccess(
        `Moved ${result.updated.length} candidate${result.updated.length === 1 ? "" : "s"} to ${bulkStage}.${skippedMessage}`,
      )
    } catch (cause) {
      setError(errorMessage(cause, "Could not move selected candidates."))
    } finally {
      setBulkMoving(false)
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

  const handleDragStart = (event: DragStartEvent) => {
    const applicationId = Number(event.active.id)
    setActiveCard(
      applications.find((item) => item.application_id === applicationId) ??
        null,
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const application = applications.find(
      (item) => item.application_id === Number(active.id),
    )
    if (!application) return

    const overId = String(over.id)
    const destination = stages.includes(overId as PipelineStage)
      ? overId as PipelineStage
      : applications.find((item) => item.application_id === Number(overId))
          ?.current_stage

    if (destination) void move(application, destination)
  }

  const renderCard = (application: PipelineApplication, clickable: boolean) => {
    const score = scoreColor(application.overall_score)

    return (
      <div
        style={{
          width: "100%",
          padding: 0,
          textAlign: "left",
          color: "inherit",
          cursor: clickable ? "pointer" : undefined,
          opacity: movingId === application.application_id ? 0.65 : 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            aria-label={`Select ${application.candidate_name}`}
            checked={selectedIds.includes(application.application_id)}
            onChange={() => toggleSelection(application.application_id)}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            style={{ flexShrink: 0 }}
          />
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: score.soft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              color: score.color,
              flexShrink: 0,
            }}
          >
            {initials(application.candidate_name)}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {application.candidate_name}
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {application.job_title}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: score.color,
              fontFamily: "var(--font-display)",
            }}
          >
            {application.overall_score == null
              ? "Pending"
              : `${Math.round(application.overall_score)}%`}
          </span>
          {application.note_count > 0 && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <ChatCircle size={11} /> {application.note_count}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            Hiring Pipeline
          </div>
          <h1>Candidate Pipeline</h1>
          <p>Drag candidates through your hiring stages.</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            className="fc-input"
            aria-label="Filter pipeline by job"
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
          <select
            className="fc-input"
            aria-label="Filter pipeline by stage"
            value={stageFilter}
            onChange={(event) =>
              setStageFilter(event.target.value as PipelineStage | "all")
            }
          >
            <option value="all">All stages</option>
            {stages.map((stage) => (
              <option value={stage} key={stage}>
                {stage}
              </option>
            ))}
          </select>
          <select
            className="fc-input"
            aria-label="Filter pipeline by score"
            value={scoreFilter}
            onChange={(event) =>
              setScoreFilter(event.target.value as ScoreFilter)
            }
          >
            <option value="all">All scores</option>
            <option value="strong">Strong match (80+)</option>
            <option value="moderate">Moderate match (50–79)</option>
            <option value="weak">Weak match (0–49)</option>
            <option value="pending">Score pending</option>
          </select>
          <button
            type="button"
            className="fc-btn fc-btn--secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            <ArrowClockwise size={15} />
            Refresh
          </button>
        </div>
      </div>

      {!loading && applications.length > 0 && (
        <div
          className="fc-card fc-card--pad"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <strong>Bulk selection</strong>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              {selectedIds.length} selected · {visibleApplications.length} shown
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              className="fc-input"
              aria-label="Bulk target stage"
              value={bulkStage}
              onChange={(event) =>
                setBulkStage(event.target.value as PipelineStage)
              }
            >
              {stages.map((stage) => (
                <option value={stage} key={stage}>
                  Move to {stage}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={() => void bulkMove()}
              disabled={selectedIds.length === 0 || bulkMoving}
            >
              {bulkMoving ? "Moving..." : "Move selected"}
            </button>
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              onClick={toggleAllVisible}
              disabled={visibleIds.length === 0}
            >
              {allVisibleSelected ? "Clear visible" : "Select all visible"}
            </button>
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="job-alert job-alert--success" role="status">
          <CheckCircle size={17} />
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && applications.length > 0 && (
        <div className="job-alert job-alert--error" role="alert">
          <WarningCircle size={17} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="fc-card fc-card--pad" aria-live="polite">
          Loading candidate pipeline...
        </div>
      ) : error ? (
        <div
          className="fc-card fc-card--pad"
          role="alert"
          style={{ textAlign: "center" }}
        >
          <WarningCircle size={30} color="var(--danger)" />
          <strong style={{ display: "block", margin: "8px 0" }}>
            Pipeline could not be loaded
          </strong>
          <p>{error}</p>
          <button
            type="button"
            className="fc-btn fc-btn--secondary"
            onClick={() => void load()}
            style={{ marginTop: 12 }}
          >
            <ArrowClockwise size={15} />
            Retry
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div
          className="fc-card fc-card--pad"
          style={{ textAlign: "center", color: "var(--text-secondary)" }}
        >
          <UserCircle size={34} style={{ marginBottom: 8 }} />
          <strong style={{ display: "block", color: "var(--text-primary)" }}>
            No candidates in this pipeline
          </strong>
          <p>
            Applications submitted to a published FitCV job will appear here.
          </p>
        </div>
      ) : visibleApplications.length === 0 ? (
        <div
          className="fc-card fc-card--pad"
          style={{ textAlign: "center", color: "var(--text-secondary)" }}
        >
          <UserCircle size={34} style={{ marginBottom: 8 }} />
          <strong style={{ display: "block", color: "var(--text-primary)" }}>
            No candidates match the current filters
          </strong>
          <p>Clear a filter to see more candidates.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            aria-label="Candidate pipeline board"
            style={{
              display: "flex",
              gap: 14,
              overflowX: "auto",
              padding: "4px 2px 12px",
            }}
          >
            {stages.map((stage) => (
              <section key={stage} style={{ minWidth: 210, flex: "0 0 210px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                    padding: "0 2px",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: stageColors[stage].dot,
                    }}
                  />
                  <span className="fc-eyebrow">{stage}</span>
                  <span
                    className="fc-badge fc-badge--gray"
                    style={{ marginLeft: "auto" }}
                  >
                    {grouped[stage].length}
                  </span>
                </div>

                <ColumnArea stage={stage}>
                  <SortableContext
                    items={grouped[stage].map((item) =>
                      String(item.application_id),
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {grouped[stage].map((application) => (
                        <SortableCard
                          key={application.application_id}
                          application={application}
                          onOpen={() => {
                            if (movingId !== application.application_id) {
                              void openDetails(application)
                            }
                          }}
                        >
                          <BezelCard className="fc-card fc-card--lift">
                            {renderCard(application, true)}
                          </BezelCard>
                        </SortableCard>
                      ))}
                    </div>
                  </SortableContext>
                </ColumnArea>
              </section>
            ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <BezelCard
                className="fc-card fc-card--lift"
                style={{ width: 210 }}
              >
                {renderCard(activeCard, false)}
              </BezelCard>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selected && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 16, 32, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
            backdropFilter: "blur(4px)",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <div
            className="fc-card fc-card--pad"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-candidate-title"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "86vh",
              overflowY: "auto",
              animation: "fc-pop 0.16s ease",
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
              <div>
                <div className="fc-eyebrow">Candidate detail</div>
                <h2 id="pipeline-candidate-title">{selected.candidate_name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="fc-icon-btn"
                aria-label="Close candidate detail"
              >
                <X size={18} />
              </button>
            </div>

            {detailError && (
              <div
                className="job-alert job-alert--error"
                role="alert"
                style={{ marginBottom: 16 }}
              >
                <WarningCircle size={16} />
                <span>{detailError}</span>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <span className="fc-panel" style={{ padding: "10px 12px" }}>
                <Envelope size={14} />{" "}
                {selected.candidate_email || "Email unavailable"}
              </span>
              <span className="fc-panel" style={{ padding: "10px 12px" }}>
                <Phone size={14} />{" "}
                {selected.candidate_phone || "Phone unavailable"}
              </span>
              <span className="fc-panel" style={{ padding: "10px 12px" }}>
                <CalendarBlank size={14} /> Applied{" "}
                {formatDate(selected.applied_at)}
              </span>
            </div>

            <div
              className="fc-panel"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                alignItems: "end",
                padding: 14,
                marginBottom: 20,
              }}
            >
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
              <strong
                style={{
                  fontSize: 22,
                  color: scoreColor(selected.overall_score).color,
                  paddingBottom: 8,
                }}
              >
                {selected.overall_score == null
                  ? "Pending"
                  : `${Math.round(selected.overall_score)}%`}
              </strong>
            </div>

            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>
                Notes &amp; Comments
              </h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a factual recruiter note..."
                  maxLength={5000}
                  className="fc-input"
                />
                <button
                  type="button"
                  className="fc-btn fc-btn--primary"
                  disabled={savingNote || !note.trim()}
                  onClick={() => void addNote()}
                  aria-label="Add note"
                >
                  <PaperPlaneRight size={15} />
                </button>
              </div>

              {detailLoading ? (
                <p>Loading activity...</p>
              ) : notes.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>
                  No recruiter notes for this candidate.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {notes.map((item) => (
                    <article
                      className="fc-panel"
                      style={{ padding: "11px 13px" }}
                      key={item.note_id}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <strong>{item.author_name}</strong>
                        <time style={{ color: "var(--text-muted)" }}>
                          {formatDate(item.created_at)}
                        </time>
                      </div>
                      <p style={{ marginTop: 5 }}>{item.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Stage history</h3>
              {!detailLoading && history.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>
                  Stage changes will be recorded here.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {history.map((item) => (
                    <div
                      className="fc-panel"
                      key={item.stage_history_id}
                      style={{
                        display: "flex",
                        gap: 9,
                        alignItems: "flex-start",
                        padding: "10px 12px",
                      }}
                    >
                      <Clock size={14} style={{ marginTop: 2 }} />
                      <p>
                        <strong>{item.new_stage}</strong>
                        <span
                          style={{
                            display: "block",
                            color: "var(--text-muted)",
                          }}
                        >
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
