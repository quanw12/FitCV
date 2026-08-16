import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  WarningCircle,
  Briefcase,
  CalendarBlank,
  FileText,
  Tray,
  MapPin,
  ArrowsClockwise,
  MagnifyingGlass,
  X,
  Spinner,
} from "@phosphor-icons/react"

import { applicationsApi } from "@/api/applicationsApi"

import {
  getCachedResource,
  getOrFetchResource,
  setCachedResource,
} from "@/services/resourceCache"

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

const stageConfig: Record<ApplicationStage, {
  background: string
  color: string
  solid: string
}> = {
  Applied: { background: "#F1F5F9", color: "#475569", solid: "#64748B" },

  Screening: { background: "#DBEAFE", color: "#1D4ED8", solid: "#2563EB" },

  Interview: { background: "#FEF3C7", color: "#B45309", solid: "#F59E0B" },

  Offer: { background: "#DCFCE7", color: "#15803D", solid: "#16A34A" },

  Hired: { background: "#CCFBF1", color: "#0F766E", solid: "#0D9488" },

  Rejected: { background: "#FEE2E2", color: "#B91C1C", solid: "#DC2626" },
}

interface AppTrackerScreenProps {
  focusApplicationId?: number | null
}

const FITCV_APPLICATIONS_CACHE_KEY = "fitcv-applications:list"

export default function AppTrackerScreen({
  focusApplicationId = null,
}: AppTrackerScreenProps) {
  const focusedCardRef = useRef<HTMLElement | null>(null)

  const cachedApplications = getCachedResource<StudentApplication[]>(
    FITCV_APPLICATIONS_CACHE_KEY,
  )

  const [applications, setApplications] = useState<StudentApplication[]>(
    cachedApplications ?? [],
  )

  const [loading, setLoading] = useState(() => !cachedApplications)

  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")

  const [stageFilter, setStageFilter] = useState<"All" | ApplicationStage>(
    "All",
  )

  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set())

  const [retryErrors, setRetryErrors] = useState<Record<number, string>>({})

  const loadApplications = useCallback(async (force = false) => {
    const cached = getCachedResource<StudentApplication[]>(
      FITCV_APPLICATIONS_CACHE_KEY,
    )

    if (cached && !force) {
      setApplications(cached)
      setLoading(false)
      return
    }

    setLoading(!cached)

    setError(null)

    try {
      setApplications(
        await getOrFetchResource(
          FITCV_APPLICATIONS_CACHE_KEY,
          () => applicationsApi.listMine(),
          { force },
        ),
      )
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
        setCachedResource(FITCV_APPLICATIONS_CACHE_KEY, nextApplications)

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

  const maxStageCount = Math.max(1, ...stageCounts.map((item) => item.count))

  const inProgressCount = useMemo(
    () =>
      applications.filter(
        (application) =>
          application.parse_status === "Pending" ||
          application.parse_status === "Processing" ||
          application.analysis_status === "Pending" ||
          application.analysis_status === "Processing",
      ).length,

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

      setApplications((current) => {
        const next = current.map((application) =>
          application.application_id === applicationId
            ? {
                ...application,

                parse_status:
                  application.parse_status === "Success"
                    ? "Success"
                    : "Pending",

                analysis_status: "Pending",

                analysis_error: null,
              }
            : application,
        )
        setCachedResource(FITCV_APPLICATIONS_CACHE_KEY, next)
        return next
      })
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

  const hasActiveFilters = stageFilter !== "All" || search.trim().length > 0

  const clearFilters = () => {
    setSearch("")

    setStageFilter("All")
  }

  return (
    <div className="tracker-workspace">
      <div className="fc-page-head">
        <div>
          <h1>FitCV Applications</h1>
          <p>
            Jobs you applied to on FitCV — CV parsing and matching run
            automatically after you submit.
          </p>
        </div>
        <button
          type="button"
          className="fitcv-btn-secondary"
          onClick={() => void loadApplications(true)}
          disabled={loading}
        >
          {loading ? (
            <Spinner className="tracker-spin" size={15} weight="light" />
          ) : (
            <ArrowsClockwise size={15} weight="light" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="tracker-alert tracker-alert--error" role="alert">
          <WarningCircle size={16} weight="light" />
          <span>{error}</span>
          <button type="button" onClick={() => void loadApplications(true)}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="fitcv-card tracker-empty">
          <Spinner className="tracker-spin" size={24} weight="light" />
          <strong>Loading your applications…</strong>
        </div>
      ) : !error && applications.length === 0 ? (
        <div className="fitcv-card tracker-empty">
          <Tray size={34} weight="light" color="#94A3B8" />
          <strong>No applications yet</strong>
          <span>Your submitted FitCV jobs will appear here.</span>
        </div>
      ) : !error ? (
        <>
          <section className="pt-overview" aria-label="Stage overview">
            <div className="pt-overview__head">
              <div>
                <span className="fc-eyebrow">Stage overview</span>
                <h2>
                  {filteredApplications.length} of {applications.length}{" "}
                  applications
                </h2>
              </div>
              {inProgressCount > 0 && (
                <span className="pt-due">
                  <Spinner className="tracker-spin" size={13} weight="light" />
                  {inProgressCount} analyzing…
                </span>
              )}
            </div>

            <div className="pt-stages pt-stages--six">
              {stageCounts.map(({ stage, count }) => {
                const config = stageConfig[stage]

                const active = stageFilter === stage

                return (
                  <button
                    type="button"
                    key={stage}
                    className="pt-stage"
                    data-active={active}
                    aria-pressed={active}
                    onClick={() =>
                      setStageFilter((current) =>
                        current === stage ? "All" : stage,
                      )
                    }
                  >
                    <span className="pt-stage__label">
                      <i style={{ background: config.solid }} aria-hidden="true" />
                      {stage}
                    </span>
                    <strong className="pt-stage__count">{count}</strong>
                    <span
                      className="pt-stage__bar"
                      role="img"
                      aria-label={`${count} of ${applications.length}`}
                    >
                      <span
                        style={{
                          width: `${Math.round(
                            (count / maxStageCount) * 100,
                          )}%`,

                          background: config.solid,
                        }}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="tracker-filters">
            <label className="fc-search tracker-search">
              <MagnifyingGlass size={15} weight="light" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search job, company, or location..."
                aria-label="Search applications"
              />
            </label>
            {hasActiveFilters && (
              <button
                type="button"
                className="fc-chip"
                onClick={clearFilters}
                aria-label="Clear filters"
              >
                <X size={13} weight="light" /> Clear filters
              </button>
            )}
          </div>

          {filteredApplications.length === 0 ? (
            <div className="fitcv-card tracker-empty">
              <MagnifyingGlass size={34} weight="light" color="#94A3B8" />
              <strong>No matching applications</strong>
              <span>Try another search term or stage.</span>
            </div>
          ) : (
            <div className="pt-list" aria-label="Your applications">
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

                const config = stageConfig[application.current_stage]

                const companyInitial =
                  application.job.company.name.trim().charAt(0).toUpperCase() ||
                  "C"

                return (
                  <article
                    key={application.application_id}
                    ref={focused ? focusedCardRef : undefined}
                    tabIndex={-1}
                    className={`pt-card ft-card${
                      focused ? " ft-card--focused" : ""
                    }`}
                    style={{ borderLeftColor: config.solid }}
                    aria-label={`${application.job.title} at ${application.job.company.name}`}
                  >
                    <div className="ft-card__row">
                      <div className="pt-card__main">
                        <div className="pt-card__identity">
                          <span className="pt-card__logo" aria-hidden="true">
                            {application.job.company.logo_url ? (
                              <img
                                src={application.job.company.logo_url}
                                alt=""
                              />
                            ) : (
                              companyInitial
                            )}
                          </span>
                          <div className="pt-card__heading">
                            <div className="pt-card__title-row">
                              <h3>{application.job.title}</h3>
                              {focused && (
                                <span className="pt-reminder">
                                  Latest application
                                </span>
                              )}
                            </div>
                            <p>{application.job.company.name}</p>
                          </div>
                        </div>

                        <div className="pt-card__meta">
                          <span>
                            <CalendarBlank size={13} weight="light" />
                            Applied {formatDate(application.applied_at)}
                          </span>
                          <span>
                            <MapPin size={13} weight="light" />
                            {application.job.location ||
                              "Location not specified"}
                          </span>
                          <span>
                            <Briefcase size={13} weight="light" />
                            {application.job.employment_type ||
                              "Employment type not specified"}
                          </span>
                          <span>
                            <FileText size={13} weight="light" />
                            {application.cv.file_name}
                          </span>
                        </div>
                      </div>

                      <div className="ft-card__side">
                        <span
                          className="ft-stage-pill"
                          style={{
                            background: config.background,

                            color: config.color,
                          }}
                        >
                          <i
                            aria-hidden="true"
                            style={{ background: config.solid }}
                          />
                          {application.current_stage}
                        </span>
                        <div className="ft-processing">
                          <ProcessingChip
                            label="CV parsing"
                            status={application.parse_status}
                          />
                          <ProcessingChip
                            label="Matching"
                            status={application.analysis_status}
                          />
                        </div>
                        <span className="ft-updated">
                          {application.updated_at
                            ? `Updated ${formatDate(application.updated_at)}`
                            : `Job ${application.job.job_status}`}
                        </span>
                      </div>
                    </div>

                    {canReanalyze && (
                      <div className="ft-retry" role="status">
                        <div className="ft-retry__message">
                          {analysisFailed ? (
                            <WarningCircle size={15} weight="light" />
                          ) : (
                            <ArrowsClockwise size={15} weight="light" />
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
                            <Spinner
                              className="tracker-spin"
                              size={15}
                              weight="light"
                            />
                          ) : (
                            <ArrowsClockwise size={15} weight="light" />
                          )}
                          {retrying
                            ? "Analyzing..."
                            : analysisFailed
                              ? "Retry analysis"
                              : "Re-analyze"}
                        </button>
                        {retryError && (
                          <p role="alert" className="ft-retry__error">
                            {retryError}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function ProcessingChip({
  label,

  status,
}: {
  label: string
  status: ApplicationProcessingStatus
}) {
  const config: Record<
    ApplicationProcessingStatus,
    { dot: string; failed: boolean }
  > = {
    Pending: { dot: "#F59E0B", failed: false },

    Processing: { dot: "#2563EB", failed: false },

    Success: { dot: "#16A34A", failed: false },

    Failed: { dot: "#DC2626", failed: true },
  }

  const tone = config[status]

  return (
    <span className={`ft-chip${tone.failed ? " ft-chip--failed" : ""}`}>
      <i
        aria-hidden="true"
        style={{ background: tone.dot }}
        className={
          status === "Processing" || status === "Pending" ? "is-live" : ""
        }
      />
      {label} · {status}
    </span>
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
