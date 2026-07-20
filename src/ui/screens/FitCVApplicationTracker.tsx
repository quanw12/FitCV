import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Inbox,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react"

import { applicationsApi } from "@/api/applicationsApi"
import type {
  ApplicationProcessingStatus,
  ApplicationStage,
  StudentApplication,
} from "@/types/applications"

const STAGES: ApplicationStage[] = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
]

const stageConfig: Record<
  ApplicationStage,
  { background: string; color: string }
> = {
  Applied: { background: "#F1F5F9", color: "#475569" },
  Screening: { background: "#DBEAFE", color: "#1D4ED8" },
  Interview: { background: "#FEF3C7", color: "#A16207" },
  Offer: { background: "#DCFCE7", color: "#15803D" },
  Hired: { background: "#CCFBF1", color: "#0F766E" },
  Rejected: { background: "#FEE2E2", color: "#B91C1C" },
}
interface AppTrackerScreenProps {
  focusApplicationId?: number | null
}

export default function AppTrackerScreen({
  focusApplicationId = null,
}: AppTrackerScreenProps) {
  const focusedCardRef = useRef<HTMLElement | null>(null)
  const [applications, setApplications] = useState<StudentApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState<"All" | ApplicationStage>("All")
  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set())
  const [retryErrors, setRetryErrors] = useState<Record<number, string>>({})

  const loadApplications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setApplications(await applicationsApi.listMine())
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load your applications.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  useEffect(() => {
    const hasInProgressApplication = applications.some(
      (application) =>
        application.parse_status === "Pending" ||
        application.parse_status === "Processing" ||
        application.analysis_status === "Pending" ||
        application.analysis_status === "Processing",
    )
    if (!hasInProgressApplication) return

    let cancelled = false
    let timerId: number | undefined

    const pollApplications = async () => {
      try {
        const nextApplications = await applicationsApi.listMine()
        if (cancelled) return

        setApplications(nextApplications)
        const shouldContinue = nextApplications.some(
          (application) =>
            application.parse_status === "Pending" ||
            application.parse_status === "Processing" ||
            application.analysis_status === "Pending" ||
            application.analysis_status === "Processing",
        )
        if (shouldContinue) {
          timerId = window.setTimeout(pollApplications, 3000)
        }
      } catch {
        if (!cancelled) {
          timerId = window.setTimeout(pollApplications, 3000)
        }
      }
    }

    timerId = window.setTimeout(pollApplications, 3000)
    return () => {
      cancelled = true
      if (timerId !== undefined) {
        window.clearTimeout(timerId)
      }
    }
  }, [applications])

  useEffect(() => {
    if (focusApplicationId == null) return
    setSearch("")
    setStageFilter("All")
  }, [focusApplicationId])

  useEffect(() => {
    if (loading || focusApplicationId == null) return
    const frame = window.requestAnimationFrame(() => {
      focusedCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      focusedCardRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [applications, focusApplicationId, loading])

  const stageCounts = useMemo(
    () =>
      STAGES.map((stage) => ({
        stage,
        count: applications.filter(
          (application) => application.current_stage === stage,
        ).length,
      })),
    [applications],
  )

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return applications.filter((application) => {
      const matchesStage =
        stageFilter === "All" || application.current_stage === stageFilter
      const matchesSearch =
        query.length === 0 ||
        application.job.title.toLocaleLowerCase().includes(query) ||
        application.job.company.name.toLocaleLowerCase().includes(query) ||
        (application.job.location ?? "").toLocaleLowerCase().includes(query)
      return matchesStage && matchesSearch
    })
  }, [applications, search, stageFilter])

  const retryAnalysis = useCallback(async (applicationId: number) => {
    setRetryingIds((current) => new Set(current).add(applicationId))
    setRetryErrors((current) => {
      const next = { ...current }
      delete next[applicationId]
      return next
    })

    try {
      await applicationsApi.retryAnalysis(applicationId)
      setApplications((current) =>
        current.map((application) =>
          application.application_id === applicationId
            ? {
                ...application,
                parse_status:
                  application.parse_status === "Success" ? "Success" : "Pending",
                analysis_status: "Pending",
                analysis_error: null,
              }
            : application,
        ),
      )
    } catch (caught) {
      setRetryErrors((current) => ({
        ...current,
        [applicationId]:
          caught instanceof Error
            ? caught.message
            : "Unable to retry OCR analysis.",
      }))
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current)
        next.delete(applicationId)
        return next
      })
    }
  }, [])

  return (
    <div>
      <style>{`
        .tracker-header,
        .tracker-toolbar,
        .tracker-card__heading,
        .tracker-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .tracker-header {
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .tracker-overview {
          display: grid;
          grid-template-columns: repeat(6, minmax(110px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }
        .tracker-overview__item {
          min-width: 0;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .tracker-toolbar {
          align-items: stretch;
          margin-bottom: 18px;
        }
        .tracker-search {
          min-width: 220px;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .tracker-search:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .tracker-filters {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 1px;
        }
        .tracker-list {
          display: grid;
          gap: 12px;
        }
        .tracker-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          transition: border-color 150ms ease, box-shadow 150ms ease;
          outline: none;
        }
        .tracker-card--focused {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow-sm);
        }
        .tracker-card__identity {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .tracker-card__logo {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text-secondary);
          font-weight: 800;
        }
        .tracker-card__logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .tracker-card__title {
          margin: 0 0 3px;
          overflow-wrap: anywhere;
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 750;
        }
        .tracker-card__company {
          overflow-wrap: anywhere;
          color: var(--text-secondary);
          font-size: 13px;
        }
        .tracker-card__meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px 16px;
          margin: 16px 0;
          color: var(--text-secondary);
          font-size: 12px;
        }
        .tracker-meta-item {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          overflow-wrap: anywhere;
        }
        .tracker-card__footer {
          align-items: flex-end;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }
        .tracker-processing {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tracker-retry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
          padding: 10px 11px;
          border: 1px solid #FECACA;
          border-radius: 7px;
          background: #FEF2F2;
        }
        .tracker-retry__message {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 7px;
          color: #B91C1C;
          overflow-wrap: anywhere;
          font-size: 12px;
        }
        .tracker-retry__error {
          width: 100%;
          margin: 0;
          color: #B91C1C;
          font-size: 12px;
          font-weight: 650;
        }
        @media (max-width: 980px) {
          .tracker-overview {
            grid-template-columns: repeat(3, minmax(110px, 1fr));
          }
          .tracker-toolbar {
            flex-direction: column;
          }
        }
        @media (max-width: 620px) {
          .tracker-header,
          .tracker-card__heading,
          .tracker-card__footer {
            align-items: stretch;
            flex-direction: column;
          }
          .tracker-header .fitcv-btn-secondary {
            align-self: flex-start;
          }
          .tracker-overview {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .tracker-card__meta {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <header className="tracker-header">
        <div>
          <h1
            style={{
              margin: "0 0 4px",
              color: "var(--text-primary)",
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            Application Tracker
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            Follow every application from submission to final decision.
          </p>
        </div>
        <button
          type="button"
          className="fitcv-btn-secondary"
          onClick={() => void loadApplications()}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      {!loading && applications.length > 0 && (
        <section aria-label="Application stage overview">
          <h2 style={sectionHeadingStyle}>Stage overview</h2>
          <div className="tracker-overview">
            {stageCounts.map(({ stage, count }) => (
              <div className="tracker-overview__item" key={stage}>
                <div
                  style={{
                    marginBottom: 7,
                    color: stageConfig[stage].color,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {stage}
                </div>
                <div
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div role="alert" style={alertStyle}>
          <AlertCircle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            className="fitcv-btn-secondary"
            onClick={() => void loadApplications()}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="tracker-toolbar">
          <label className="tracker-search">
            <Search size={16} color="var(--text-muted)" />
            <span className="sr-only">Search applications</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search job, company, or location"
              style={{
                width: "100%",
                minWidth: 0,
                border: 0,
                outline: 0,
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          </label>
          <div className="tracker-filters" aria-label="Filter by stage">
            {(["All", ...STAGES] as const).map((stage) => {
              const active = stageFilter === stage
              return (
                <button
                  type="button"
                  key={stage}
                  aria-pressed={active}
                  onClick={() => setStageFilter(stage)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 12px",
                    border: `1px solid ${
                      active ? "var(--accent)" : "var(--border)"
                    }`,
                    borderRadius: 8,
                    background: active ? "var(--accent)" : "var(--surface)",
                    color: active ? "#FFFFFF" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {stage}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <StatePanel>
          <RefreshCw className="state-spinner" size={30} />
          <strong>Loading your applications</strong>
        </StatePanel>
      ) : error ? null : applications.length === 0 ? (
        <StatePanel>
          <Inbox size={36} color="#94A3B8" />
          <strong>No applications yet</strong>
          <span>Your submitted jobs will appear here.</span>
        </StatePanel>
      ) : filteredApplications.length === 0 ? (
        <StatePanel>
          <Search size={34} color="#94A3B8" />
          <strong>No matching applications</strong>
          <span>Try another search term or stage.</span>
        </StatePanel>
      ) : (
        <section className="tracker-list" aria-label="Your applications">
          {filteredApplications.map((application) => {
            const focused =
              application.application_id === focusApplicationId
            const retrying = retryingIds.has(application.application_id)
            const retryError = retryErrors[application.application_id]
            const analysisFailed =
              application.parse_status === "Failed" ||
              application.analysis_status === "Failed"
            const canReanalyze =
              analysisFailed || application.analysis_status === "Success"
            const companyInitial =
              application.job.company.name.trim().charAt(0).toUpperCase() || "C"
            return (
              <article
                key={application.application_id}
                ref={focused ? focusedCardRef : undefined}
                tabIndex={-1}
                className={`tracker-card${
                  focused ? " tracker-card--focused" : ""
                }`}
                aria-label={`${application.job.title} at ${application.job.company.name}`}
              >
                <div className="tracker-card__heading">
                  <div className="tracker-card__identity">
                    <div className="tracker-card__logo" aria-hidden="true">
                      {application.job.company.logo_url ? (
                        <img
                          src={application.job.company.logo_url}
                          alt=""
                        />
                      ) : (
                        companyInitial
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 className="tracker-card__title">
                        {application.job.title}
                      </h3>
                      <div className="tracker-card__company">
                        {application.job.company.name}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {focused && (
                      <span
                        style={{
                          padding: "4px 9px",
                          borderRadius: 999,
                          background: "var(--accent-soft)",
                          color: "var(--accent-ink)",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        Latest application
                      </span>
                    )}
                    <StageBadge stage={application.current_stage} />
                  </div>
                </div>

                <div className="tracker-card__meta">
                  <span className="tracker-meta-item">
                    <CalendarDays size={14} />
                    Applied {formatDate(application.applied_at)}
                  </span>
                  <span className="tracker-meta-item">
                    <MapPin size={14} />
                    {application.job.location || "Location not specified"}
                  </span>
                  <span className="tracker-meta-item">
                    <BriefcaseBusiness size={14} />
                    {application.job.employment_type ||
                      "Employment type not specified"}
                  </span>
                  <span className="tracker-meta-item">
                    <FileText size={14} />
                    {application.cv.file_name}
                  </span>
                </div>

                <div className="tracker-card__footer">
                  <div className="tracker-processing">
                    <ProcessingBadge
                      label="CV parsing"
                      status={application.parse_status}
                    />
                    <ProcessingBadge
                      label="Application analysis"
                      status={application.analysis_status}
                    />
                  </div>
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  >
                    {application.updated_at
                      ? `Updated ${formatDate(application.updated_at)}`
                      : `Job ${application.job.job_status}`}
                  </div>
                </div>

                {canReanalyze && (
                  <div className="tracker-retry">
                    <div role="status" className="tracker-retry__message">
                      {analysisFailed ? (
                        <AlertCircle size={15} />
                      ) : (
                        <RefreshCw size={15} />
                      )}
                      <span>
                        {analysisFailed
                          ? application.analysis_error ||
                            "The CV could not be parsed or compared."
                          : "Run the latest matching logic for this application."}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="fitcv-btn-secondary"
                      onClick={() =>
                        void retryAnalysis(application.application_id)
                      }
                      disabled={retrying}
                    >
                      {retrying ? (
                        <RefreshCw className="state-spinner" size={15} />
                      ) : (
                        <RefreshCw size={15} />
                      )}
                      {retrying
                        ? "Analyzing..."
                        : analysisFailed
                          ? "Retry analysis"
                          : "Re-analyze"}
                    </button>
                    {retryError && (
                      <p role="alert" className="tracker-retry__error">
                        {retryError}
                      </p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

function StageBadge({ stage }: { stage: ApplicationStage }) {
  const config = stageConfig[stage]
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 10px",
        borderRadius: 999,
        background: config.background,
        color: config.color,
        fontSize: 12,
        fontWeight: 750,
      }}
    >
      {stage}
    </span>
  )
}

function ProcessingBadge({
  label,
  status,
}: {
  label: string
  status: ApplicationProcessingStatus
}) {
  const config: Record<
    ApplicationProcessingStatus,
    { background: string; color: string }
  > = {
    Pending: { background: "#FEF3C7", color: "#92400E" },
    Processing: { background: "#DBEAFE", color: "#1D4ED8" },
    Success: { background: "#DCFCE7", color: "#166534" },
    Failed: { background: "#FEE2E2", color: "#B91C1C" },
  }
  const tone = config[status]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 8px",
        borderRadius: 6,
        background: tone.background,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}: {status}
    </span>
  )
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="fitcv-card" style={statePanelStyle}>
      {children}
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: "0 0 10px",
  color: "var(--text-primary)",
  fontSize: 14,
  fontWeight: 750,
}

const alertStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  marginBottom: 18,
  padding: "12px 14px",
  border: "1px solid #FECACA",
  borderRadius: 8,
  background: "#FEF2F2",
  color: "#B91C1C",
  fontSize: 13,
}

const statePanelStyle: React.CSSProperties = {
  minHeight: 230,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: 24,
  color: "var(--text-secondary)",
  textAlign: "center",
}
