import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  ScanText,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react"

import { applicationsApi } from "@/api/applicationsApi"
import { cvRankingApi } from "@/api/cvRankingApi"
import { jobsApi } from "@/api/jobsApi"
import type { RankedApplication, RankingBreakdown } from "@/types/cvRanking"
import type { JobPost } from "@/types/jobs"
import ScoreRing from "../components/ScoreRing"

type AnalysisState = "Pending" | "Processing" | "Failed" | "Success"
type CvAction = "open" | "download"

const breakdownCriteria: Array<[keyof RankingBreakdown, string]> = [
  ["skills", "Skills"],
  ["experience", "Experience"],
  ["education", "Education"],
  ["soft_skills", "Soft skills"],
]

function analysisState(value: string): AnalysisState {
  const normalized = value.trim().toLowerCase()
  if (["success", "completed", "ready"].includes(normalized)) return "Success"
  if (["failed", "error"].includes(normalized)) return "Failed"
  if (["processing", "running", "in_progress"].includes(normalized)) {
    return "Processing"
  }
  return "Pending"
}

function percentValue(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const percentage = value > 0 && value <= 1 ? value * 100 : value
  return Math.round(Math.max(0, Math.min(100, percentage)))
}

function badgeClass(status: AnalysisState): string {
  if (status === "Success") return "fc-badge--green"
  if (status === "Failed") return "fc-badge--red"
  return "fc-badge--amber"
}

function statusIcon(status: AnalysisState) {
  if (status === "Success") return <CheckCircle2 size={13} />
  if (status === "Failed") return <AlertCircle size={13} />
  if (status === "Processing") {
    return (
      <LoaderCircle
        size={13}
        style={{ animation: "fc-spin .8s linear infinite" }}
      />
    )
  }
  return <Clock3 size={13} />
}

function fileSizeLabel(sizeKb: number): string {
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1)} MB`
  return `${Math.max(0, Math.round(sizeKb))} KB`
}

function parsedList(
  parsed: Record<string, unknown> | null,
  keys: string[],
): string[] {
  if (!parsed) return []
  for (const key of keys) {
    const value = parsed[key]
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item
          if (item && typeof item === "object" && "name" in item) {
            return String(item.name)
          }
          return null
        })
        .filter((item): item is string => Boolean(item))
    }
  }
  return []
}

function parsedText(
  parsed: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!parsed) return null
  for (const key of keys) {
    const value = parsed[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return null
}

export default function JobApplicantsRankingPanel() {
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [applications, setApplications] = useState<RankedApplication[]>([])
  const [selectedApplication, setSelectedApplication] =
    useState<RankedApplication | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(() => new Set())
  const [threshold, setThreshold] = useState(70)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [jobsError, setJobsError] = useState("")
  const [applicationsError, setApplicationsError] = useState("")
  const [cvError, setCvError] = useState("")
  const [archiveError, setArchiveError] = useState("")
  const [previewError, setPreviewError] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [retryError, setRetryError] = useState("")
  const [retryingId, setRetryingId] = useState<number | null>(null)
  const [cvAction, setCvAction] = useState<{
    id: number
    action: CvAction
  } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setJobsLoading(true)
    setJobsError("")

    jobsApi
      .listManaged()
      .then((result) => {
        if (!active) return
        setJobs(result)
        setSelectedJobId((current) =>
          current != null && result.some((job) => job.job_id === current)
            ? current
            : (result[0]?.job_id ?? null),
        )
      })
      .catch((cause) => {
        if (active) {
          setJobsError(
            cause instanceof Error
              ? cause.message
              : "Could not load managed jobs.",
          )
        }
      })
      .finally(() => {
        if (active) setJobsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setSelectedIds(new Set())
    setConfirmedIds(new Set())
    setSelectedApplication(null)
  }, [selectedJobId])

  useEffect(() => {
    if (selectedJobId == null) {
      setApplications([])
      return
    }

    let active = true
    setApplicationsLoading(true)
    setApplicationsError("")

    cvRankingApi
      .listApplications(selectedJobId)
      .then((result) => {
        if (!active) return
        setApplications(result)
        setSelectedApplication((current) =>
          current
            ? (result.find(
                (item) => item.application_id === current.application_id,
              ) ?? null)
            : null,
        )
      })
      .catch((cause) => {
        if (!active) return
        setApplications([])
        setApplicationsError(
          cause instanceof Error
            ? cause.message
            : "Could not load job applicants.",
        )
      })
      .finally(() => {
        if (active) setApplicationsLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedJobId, reloadKey])

  useEffect(() => {
    const processing = applications.some((application) => {
      const state = analysisState(application.analysis_status)
      return state === "Pending" || state === "Processing"
    })
    if (!processing || selectedJobId == null) return

    const timer = window.setTimeout(
      () => setReloadKey((current) => current + 1),
      3000,
    )
    return () => window.clearTimeout(timer)
  }, [applications, selectedJobId])

  useEffect(() => {
    let active = true
    let objectUrl = ""
    setPreviewUrl("")
    setPreviewError("")

    if (!selectedApplication) {
      setPreviewLoading(false)
      return
    }

    setPreviewLoading(true)
    cvRankingApi
      .getApplicationCv(selectedApplication.application_id)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((cause) => {
        if (active) {
          setPreviewError(
            cause instanceof Error
              ? cause.message
              : "Could not preview this CV.",
          )
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedApplication?.application_id])

  const selectedJob = jobs.find((job) => job.job_id === selectedJobId) ?? null

  const rankedApplications = useMemo(
    () =>
      [...applications].sort((left, right) => {
        const leftScore =
          analysisState(left.analysis_status) === "Success"
            ? (left.overall_score ?? -1)
            : -1
        const rightScore =
          analysisState(right.analysis_status) === "Success"
            ? (right.overall_score ?? -1)
            : -1
        if (rightScore !== leftScore) return rightScore - leftScore
        return (
          new Date(right.applied_at).getTime() -
          new Date(left.applied_at).getTime()
        )
      }),
    [applications],
  )

  const statusCounts = useMemo(
    () =>
      applications.reduce<Record<AnalysisState, number>>(
        (counts, application) => {
          counts[analysisState(application.analysis_status)] += 1
          return counts
        },
        { Pending: 0, Processing: 0, Failed: 0, Success: 0 },
      ),
    [applications],
  )

  const toggleApplication = (applicationId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
    setConfirmedIds(new Set())
  }

  const selectByThreshold = () => {
    setSelectedIds(
      new Set(
        applications
          .filter(
            (application) =>
              analysisState(application.analysis_status) === "Success" &&
              (percentValue(application.overall_score) ?? -1) >= threshold,
          )
          .map((application) => application.application_id),
      ),
    )
    setConfirmedIds(new Set())
  }

  const handleCv = async (application: RankedApplication, action: CvAction) => {
    const previewWindow = action === "open" ? window.open("", "_blank") : null
    setCvAction({ id: application.application_id, action })
    setCvError("")

    try {
      const blob = await cvRankingApi.getApplicationCv(
        application.application_id,
      )
      const objectUrl = URL.createObjectURL(blob)
      if (action === "open") {
        if (previewWindow) previewWindow.location.href = objectUrl
        else window.open(objectUrl, "_blank", "noopener,noreferrer")
      } else {
        const anchor = document.createElement("a")
        anchor.href = objectUrl
        anchor.download =
          application.cv.file_name ||
          `application-${application.application_id}.pdf`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (cause) {
      previewWindow?.close()
      setCvError(
        cause instanceof Error ? cause.message : "Could not load this CV.",
      )
    } finally {
      setCvAction(null)
    }
  }

  const downloadAllCvs = async () => {
    if (selectedJobId == null || !selectedJob) return
    setArchiveLoading(true)
    setArchiveError("")
    try {
      const blob = await cvRankingApi.downloadJobCvs(selectedJobId)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = `${selectedJob.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || `job-${selectedJobId}`}-cvs.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (cause) {
      setArchiveError(
        cause instanceof Error
          ? cause.message
          : "Could not download all application CVs.",
      )
    } finally {
      setArchiveLoading(false)
    }
  }

  const retryAnalysis = async (application: RankedApplication) => {
    setRetryingId(application.application_id)
    setRetryError("")
    try {
      await applicationsApi.retryAnalysis(application.application_id)
      const pending: RankedApplication = {
        ...application,
        analysis_status: "Pending",
        analysis_error: null,
        overall_score: null,
        match_label: null,
        pass_probability: null,
        breakdown: null,
      }
      setApplications((current) =>
        current.map((item) =>
          item.application_id === application.application_id ? pending : item,
        ),
      )
      setSelectedApplication(pending)
    } catch (cause) {
      setRetryError(
        cause instanceof Error ? cause.message : "Could not re-run analysis.",
      )
    } finally {
      setRetryingId(null)
    }
  }

  const selectedState = selectedApplication
    ? analysisState(selectedApplication.analysis_status)
    : null
  const selectedSkills = selectedApplication
    ? parsedList(selectedApplication.parsed_cv, ["skills", "technical_skills"])
    : []
  const selectedExperience = selectedApplication
    ? parsedText(selectedApplication.parsed_cv, [
        "experience_summary",
        "experience",
        "total_experience_years",
      ])
    : null
  const selectedEducation = selectedApplication
    ? parsedText(selectedApplication.parsed_cv, [
        "education_summary",
        "education",
        "highest_education",
      ])
    : null

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            Job pipeline
          </div>
          <h1>Job Applicants</h1>
          <p>Rank CVs already submitted to your company job posts.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="fc-btn fc-btn--primary"
            onClick={() => void downloadAllCvs()}
            disabled={
              selectedJobId == null ||
              applications.length === 0 ||
              archiveLoading
            }
          >
            {archiveLoading ? (
              <LoaderCircle
                size={15}
                style={{ animation: "fc-spin .8s linear infinite" }}
              />
            ) : (
              <Download size={15} />
            )}
            {archiveLoading ? "Preparing ZIP..." : "Download all CVs"}
          </button>
          <button
            type="button"
            className="fc-btn fc-btn--secondary"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={selectedJobId == null || applicationsLoading}
          >
            <RefreshCw
              size={15}
              style={
                applicationsLoading
                  ? { animation: "fc-spin .8s linear infinite" }
                  : undefined
              }
            />
            Refresh
          </button>
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px,1fr) repeat(4,minmax(90px,.35fr))",
          gap: 12,
          alignItems: "end",
          overflowX: "auto",
          padding: "14px 0 18px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        <label>
          <span className="fc-field-label">Job post</span>
          <select
            className="fc-input"
            aria-label="Job post"
            value={selectedJobId ?? ""}
            onChange={(event) =>
              setSelectedJobId(
                event.target.value ? Number(event.target.value) : null,
              )
            }
            disabled={jobsLoading || jobs.length === 0}
          >
            {jobs.length === 0 && <option value="">No managed jobs</option>}
            {jobs.map((job) => (
              <option key={job.job_id} value={job.job_id}>
                {job.title} ({job.status}) - {job.application_count} applicants
              </option>
            ))}
          </select>
        </label>
        {([
          "Success",
          "Processing",
          "Pending",
          "Failed",
        ] as AnalysisState[]).map((status) => (
          <div key={status} style={{ minWidth: 90 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
              {status}
            </div>
            <strong style={{ fontSize: 20 }}>{statusCounts[status]}</strong>
          </div>
        ))}
      </section>

      {[jobsError, applicationsError, cvError, archiveError]
        .filter(Boolean)
        .map((message) => (
          <div
            key={message}
            role="alert"
            className="fc-panel"
            style={{ padding: 12, color: "var(--danger)", marginBottom: 12 }}
          >
            {message}
          </div>
        ))}

      {jobsLoading ? (
        <div className="fc-panel" style={{ padding: 24 }}>
          Loading managed jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="fc-panel" style={{ padding: 32, textAlign: "center" }}>
          <Briefcase
            size={32}
            color="var(--text-muted)"
            style={{ margin: "0 auto 10px" }}
          />
          <h3>No job posts yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Create a job post before reviewing applicants.
          </p>
        </div>
      ) : applicationsLoading ? (
        <div className="fc-panel" style={{ padding: 32, textAlign: "center" }}>
          <LoaderCircle
            size={28}
            color="var(--accent)"
            style={{
              margin: "0 auto 10px",
              animation: "fc-spin .8s linear infinite",
            }}
          />
          Loading applicants for {selectedJob?.title}...
        </div>
      ) : rankedApplications.length === 0 ? (
        <div className="fc-panel" style={{ padding: 32, textAlign: "center" }}>
          <UserRound
            size={32}
            color="var(--text-muted)"
            style={{ margin: "0 auto 10px" }}
          />
          <h3>No applications received</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Applications submitted to {selectedJob?.title} will appear here.
          </p>
        </div>
      ) : (
        <>
          <section
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
              marginBottom: 14,
            }}
          >
            <SlidersHorizontal size={16} color="var(--accent)" />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 250,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Score threshold
              </span>
              <input
                type="range"
                aria-label="Applicant score threshold"
                min={0}
                max={100}
                step={5}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                style={{ flex: 1 }}
              />
              <strong style={{ width: 30, textAlign: "right" }}>
                {threshold}
              </strong>
            </label>
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              onClick={selectByThreshold}
            >
              <Check size={15} />
              Select score &gt;= {threshold}
            </button>
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setSelectedIds(new Set())
                setConfirmedIds(new Set())
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              disabled={selectedIds.size === 0}
              onClick={() => setConfirmedIds(new Set(selectedIds))}
              style={{ marginLeft: "auto" }}
            >
              <CheckCircle2 size={16} />
              Confirm {selectedIds.size} selected
            </button>
          </section>

          {confirmedIds.size > 0 && (
            <div
              role="status"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                color: "var(--success)",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              <CheckCircle2 size={16} />
              {confirmedIds.size} applicant
              {confirmedIds.size === 1 ? "" : "s"} confirmed for HR review.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr)",
              gap: 16,
              alignItems: "start",
            }}
          >
            <section className="fc-card" style={{ overflowX: "auto" }}>
              <div
                className="fc-section-title"
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <h3>Ranked applicants</h3>
                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                  }}
                >
                  {rankedApplications.length} applications
                </span>
              </div>
              <table className="fc-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th aria-label="Select applicant" />
                    <th>Rank</th>
                    <th>Candidate</th>
                    <th>Analysis</th>
                    <th>Score</th>
                    <th>Pipeline</th>
                    <th>Applied</th>
                    <th aria-label="Open detail" />
                  </tr>
                </thead>
                <tbody>
                  {rankedApplications.map((application, index) => {
                    const state = analysisState(application.analysis_status)
                    const active =
                      selectedApplication?.application_id ===
                      application.application_id
                    const score =
                      state === "Success"
                        ? percentValue(application.overall_score)
                        : null
                    return (
                      <tr
                        key={application.application_id}
                        onClick={() => setSelectedApplication(application)}
                        style={{
                          cursor: "pointer",
                          background: active
                            ? "var(--accent-soft)"
                            : "transparent",
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${application.candidate.full_name}`}
                            checked={selectedIds.has(
                              application.application_id,
                            )}
                            disabled={state !== "Success"}
                            onChange={() =>
                              toggleApplication(application.application_id)
                            }
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                        <td>
                          <strong>
                            {state === "Success" ? `#${index + 1}` : "-"}
                          </strong>
                        </td>
                        <td>
                          <strong>{application.candidate.full_name}</strong>
                          <div
                            style={{
                              color: "var(--text-muted)",
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            {application.candidate.email}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`fc-badge ${badgeClass(state)}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {statusIcon(state)} {state}
                          </span>
                        </td>
                        <td>
                          {score == null ? (
                            <span style={{ color: "var(--text-muted)" }}>
                              Not scored
                            </span>
                          ) : (
                            <>
                              <strong>{score}%</strong>
                              <div
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: 11,
                                }}
                              >
                                {application.match_label ?? "Analyzed"}
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          <strong>{application.current_stage}</strong>
                          <div
                            style={{
                              color: "var(--text-muted)",
                              fontSize: 11,
                            }}
                          >
                            {application.status}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {new Date(
                            application.applied_at,
                          ).toLocaleDateString()}
                        </td>
                        <td>
                          <ChevronRight size={16} color="var(--text-muted)" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>

            {selectedApplication && selectedState && (
              <section
                aria-label="Applicant CV comparison"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(min(100%,420px),1fr))",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    borderRight: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      minHeight: 50,
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div className="fc-section-title">
                      <FileText size={16} />
                      <h3>Raw CV</h3>
                    </div>
                    <button
                      type="button"
                      className="fc-btn fc-btn--secondary"
                      onClick={() =>
                        previewUrl &&
                        window.open(previewUrl, "_blank", "noopener,noreferrer")
                      }
                      disabled={!previewUrl}
                    >
                      <ExternalLink size={14} />
                      Open
                    </button>
                  </div>
                  {previewLoading ? (
                    <div
                      style={{
                        minHeight: 360,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <LoaderCircle
                        size={28}
                        color="var(--accent)"
                        style={{ animation: "fc-spin .8s linear infinite" }}
                      />
                    </div>
                  ) : previewError ? (
                    <div
                      role="alert"
                      style={{
                        minHeight: 240,
                        display: "grid",
                        placeItems: "center",
                        padding: 24,
                        color: "var(--danger)",
                        textAlign: "center",
                      }}
                    >
                      {previewError}
                    </div>
                  ) : selectedApplication.cv.file_type.toUpperCase() ===
                      "PDF" && previewUrl ? (
                    <iframe
                      title={`Raw CV for ${selectedApplication.candidate.full_name}`}
                      src={previewUrl}
                      style={{
                        display: "block",
                        width: "100%",
                        height: 680,
                        border: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        minHeight: 300,
                        display: "grid",
                        placeItems: "center",
                        padding: 24,
                        color: "var(--text-secondary)",
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <FileText
                          size={34}
                          color="var(--accent)"
                          style={{ margin: "0 auto 10px" }}
                        />
                        <strong>{selectedApplication.cv.file_name}</strong>
                        <div style={{ marginTop: 5, fontSize: 13 }}>
                          Open the file to inspect the original document.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <aside style={{ minWidth: 0, padding: 18 }}>
                  <div
                    className="fc-section-title"
                    style={{
                      margin: "-18px -18px 0",
                      minHeight: 50,
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <Sparkles size={16} />
                    <h3>Parsed data and score</h3>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div className="fc-eyebrow">Applicant detail</div>
                      <h3>{selectedApplication.candidate.full_name}</h3>
                    </div>
                    <button
                      type="button"
                      className="fc-icon-btn"
                      aria-label="Close applicant detail"
                      onClick={() => setSelectedApplication(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "center",
                      padding: "16px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {selectedState === "Success" &&
                    selectedApplication.overall_score != null ? (
                      <ScoreRing
                        score={
                          percentValue(selectedApplication.overall_score) ?? 0
                        }
                        size={76}
                        strokeWidth={8}
                        label="Score"
                      />
                    ) : (
                      statusIcon(selectedState)
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          fontSize: 13,
                        }}
                      >
                        <Mail size={13} />
                        <span style={{ overflowWrap: "anywhere" }}>
                          {selectedApplication.candidate.email}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          fontSize: 13,
                          marginTop: 6,
                        }}
                      >
                        <Phone size={13} />
                        {selectedApplication.candidate.phone}
                      </div>
                    </div>
                  </div>

                  {selectedState === "Failed" && (
                    <div
                      role="alert"
                      className="fc-panel"
                      style={{
                        padding: 12,
                        color: "var(--danger)",
                        marginTop: 14,
                      }}
                    >
                      {selectedApplication.analysis_error ??
                        selectedApplication.parse_error ??
                        "The CV could not be parsed or compared."}
                    </div>
                  )}

                  {(selectedState === "Failed" ||
                    selectedState === "Success") && (
                    <button
                      type="button"
                      className="fc-btn fc-btn--secondary"
                      onClick={() => void retryAnalysis(selectedApplication)}
                      disabled={
                        retryingId === selectedApplication.application_id
                      }
                      style={{ width: "100%", marginTop: 12 }}
                    >
                      {retryingId === selectedApplication.application_id ? (
                        <LoaderCircle
                          size={15}
                          style={{ animation: "fc-spin .8s linear infinite" }}
                        />
                      ) : (
                        <ScanText size={15} />
                      )}
                      {retryingId === selectedApplication.application_id
                        ? "Analyzing..."
                        : "Re-analyze"}
                    </button>
                  )}

                  {retryError && (
                    <div
                      role="alert"
                      style={{ color: "var(--danger)", marginTop: 8 }}
                    >
                      {retryError}
                    </div>
                  )}

                  {selectedState === "Success" && (
                    <div
                      className="fc-panel"
                      style={{ padding: 14, marginTop: 14 }}
                    >
                      {breakdownCriteria.map(([key, label]) => {
                        const score = percentValue(
                          selectedApplication.breakdown?.[key],
                        )
                        return (
                          <div key={key} style={{ marginBottom: 10 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 12,
                                marginBottom: 5,
                              }}
                            >
                              <span>{label}</span>
                              <strong>
                                {score == null ? "N/A" : `${score}%`}
                              </strong>
                            </div>
                            <div className="fc-progress">
                              <div style={{ width: `${score ?? 0}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {(selectedSkills.length > 0 ||
                    selectedExperience ||
                    selectedEducation) && (
                    <div style={{ marginTop: 16 }}>
                      <div className="fc-section-title">
                        <Sparkles size={15} />
                        <h3>Parsed CV</h3>
                      </div>
                      {selectedSkills.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 5,
                            flexWrap: "wrap",
                            margin: "10px 0",
                          }}
                        >
                          {selectedSkills.slice(0, 12).map((skill) => (
                            <span key={skill} className="fc-chip">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      {selectedExperience && (
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            fontSize: 13,
                            marginTop: 8,
                          }}
                        >
                          <Briefcase size={14} />
                          {selectedExperience}
                        </div>
                      )}
                      {selectedEducation && (
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            fontSize: 13,
                            marginTop: 8,
                          }}
                        >
                          <GraduationCap size={14} />
                          {selectedEducation}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className="fc-panel"
                    style={{ padding: 12, marginTop: 14 }}
                  >
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <FileText size={18} color="var(--accent)" />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ overflowWrap: "anywhere" }}>
                          {selectedApplication.cv.file_name}
                        </strong>
                        <div
                          style={{ color: "var(--text-muted)", fontSize: 11 }}
                        >
                          {selectedApplication.cv.file_type} -{" "}
                          {fileSizeLabel(selectedApplication.cv.file_size_kb)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    <button
                      type="button"
                      className="fc-btn fc-btn--primary"
                      onClick={() => void handleCv(selectedApplication, "open")}
                      disabled={
                        cvAction?.id === selectedApplication.application_id
                      }
                      style={{ flex: 1 }}
                    >
                      <ExternalLink size={15} />
                      Open CV
                    </button>
                    <button
                      type="button"
                      className="fc-btn fc-btn--secondary"
                      onClick={() =>
                        void handleCv(selectedApplication, "download")
                      }
                      disabled={
                        cvAction?.id === selectedApplication.application_id
                      }
                    >
                      <Download size={15} />
                      Download
                    </button>
                  </div>
                </aside>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
