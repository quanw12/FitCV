import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  ArrowClockwise,
  Check,
  CheckCircle,
  Envelope,
  FloppyDisk,
  PaperPlaneRight,
  Sparkle,
  Users,
  WarningCircle,
  X,
} from "@phosphor-icons/react"

import { emailWorkflowApi } from "@/api/emailWorkflowApi"

import { pipelineApi } from "@/api/pipelineApi"

import type {
  CampaignPreview,
  CandidateEmailDraft,
  EmailAudienceItem,
  EmailAudienceResponse,
  EmailStage,
  EmailTemplate,
} from "@/types/emailWorkflow"

import type { PipelineApplication } from "@/types/pipeline"

import SmartReplyPanel from "@/ui/components/SmartReplyPanel"

const stages: EmailStage[] = [
  "Applied",

  "Screening",

  "Interview",

  "Offer",

  "Hired",

  "Rejected",
]

const stageTemplates: Record<EmailStage, string> = {
  Applied: "confirmation",

  Screening: "shortlist",

  Interview: "interview",

  Offer: "offer_discussion",

  Hired: "onboarding_welcome",

  Rejected: "rejection",
}

const SAME_STAGE_RESEND_REASON = "Already emailed for this stage."

const isResendableBlocked = (item: EmailAudienceItem) =>
  item.already_emailed_for_stage &&
  item.blocked_reason === SAME_STAGE_RESEND_REASON &&
  item.pending_draft_email_id == null &&
  item.has_email_address

const stageColors: Record<EmailStage, {
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

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",

        month: "short",

        year: "numeric",

        hour: "2-digit",

        minute: "2-digit",
      })
    : "Not yet"

const statusClass = (status: CandidateEmailDraft["status"]) => {
  if (status === "Sent") return "fc-badge--green"

  if (status === "Approved") return "fc-badge--blue"

  if (status === "Failed") return "fc-badge--red"

  return "fc-badge--amber"
}

export default function AutoEmailScreen() {
  const audienceRequestRef = useRef(0)

  const [templates, setTemplates] = useState<EmailTemplate[]>([])

  const [applications, setApplications] = useState<PipelineApplication[]>([])

  const [drafts, setDrafts] = useState<CandidateEmailDraft[]>([])

  const [templateKey, setTemplateKey] = useState("")

  const [stage, setStage] = useState<EmailStage>("Applied")

  const [jobId, setJobId] = useState<number | undefined>()

  const [audience, setAudience] = useState<EmailAudienceResponse | null>(null)

  const [audienceSelection, setAudienceSelection] = useState<number[]>([])

  const [audienceLoading, setAudienceLoading] = useState(false)

  const [audienceError, setAudienceError] = useState("")

  const [campaignPreview, setCampaignPreview] =
    useState<CampaignPreview | null>(null)

  const [interviewLeadDays, setInterviewLeadDays] = useState(3)

  const [interviewWindow, setInterviewWindow] = useState("09:00-17:00 ICT")

  const [activeDraft, setActiveDraft] = useState<CandidateEmailDraft | null>(
    null,
  )

  const [subject, setSubject] = useState("")

  const [body, setBody] = useState("")

  const [guidance, setGuidance] = useState("")
  const [allowResend, setAllowResend] = useState(false)
  const [bulkSelection, setBulkSelection] = useState<number[]>([])

  const [loading, setLoading] = useState(true)

  const [generating, setGenerating] = useState(false)

  const [saving, setSaving] = useState(false)

  const [workflowAction, setWorkflowAction] =
    useState<"approve" | "send" | "reopen" | "bulk" | null>(null)

  const [error, setError] = useState("")

  const [success, setSuccess] = useState("")

  const selectDraft = (draft: CandidateEmailDraft | null) => {
    setActiveDraft(draft)

    setSubject(draft?.subject ?? "")

    setBody(draft?.body ?? "")
  }

  const load = useCallback(async (preferredDraftId?: number) => {
    setLoading(true)

    setError("")

    try {
      const [nextTemplates, nextApplications, nextDrafts] = await Promise.all([
        emailWorkflowApi.listTemplates(),

        pipelineApi.list(),

        emailWorkflowApi.listDrafts(),
      ])

      setTemplates(nextTemplates)

      setApplications(nextApplications)

      setDrafts(nextDrafts)

      const sendableIds = new Set(
        nextDrafts

          .filter(
            (draft) =>
              !draft.stage_changed_since_generation &&
              (draft.status === "Approved" ||
                (draft.status === "Failed" && draft.retryable)),
          )

          .map((draft) => draft.email_id),
      )

      setBulkSelection((current) =>
        current.filter((emailId) => sendableIds.has(emailId)),
      )

      const firstStage =
        nextTemplates[0]?.default_stage ??
        (stages.includes(nextApplications[0]?.current_stage as EmailStage)
          ? nextApplications[0].current_stage as EmailStage
          : "Applied")

      setStage(firstStage)

      const mappedTemplate = stageTemplates[firstStage]

      setTemplateKey(
        nextTemplates.some((template) => template.key === mappedTemplate)
          ? mappedTemplate
          : (nextTemplates.find(
              (template) =>
                template.allowed_stages == null ||
                template.allowed_stages.includes(firstStage),
            )?.key ?? ""),
      )

      const nextActive =
        nextDrafts.find((draft) => draft.email_id === preferredDraftId) ??
        nextDrafts[0] ??
        null

      setActiveDraft(nextActive)

      setSubject(nextActive?.subject ?? "")

      setBody(nextActive?.body ?? "")
    } catch (cause) {
      setError(errorMessage(cause, "Could not load candidate email workflow."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loadAudience = useCallback(async () => {
    if (loading) return

    const requestId = ++audienceRequestRef.current

    setAudienceLoading(true)

    setAudienceError("")

    try {
      const nextAudience = await emailWorkflowApi.listAudience(
        stage,
        jobId,
        templateKey,
      )

      if (requestId !== audienceRequestRef.current) return

      setAudience(nextAudience)

      setAudienceSelection((current) =>
        current.filter((id) =>
          [
            ...nextAudience.eligible,
            ...nextAudience.blocked.filter(isResendableBlocked),
          ].some((item) => item.application_id === id),
        ),
      )
    } catch (cause) {
      if (requestId !== audienceRequestRef.current) return

      setAudience(null)

      setAudienceSelection([])

      setAudienceError(errorMessage(cause, "Could not load this audience."))
    } finally {
      if (requestId === audienceRequestRef.current) {
        setAudienceLoading(false)
      }
    }
  }, [jobId, loading, stage, templateKey])

  useEffect(() => {
    void loadAudience()
  }, [loadAudience])

  const replaceDraft = (updated: CandidateEmailDraft) => {
    setDrafts((current) => [
      updated,

      ...current.filter((draft) => draft.email_id !== updated.email_id),
    ])

    selectDraft(updated)
  }

  const dirty =
    activeDraft?.status === "Draft" &&
    (subject !== activeDraft.subject || body !== activeDraft.body)

  const jobOptions = useMemo(() => {
    const jobs = new Map<number, string>()

    applications.forEach((application) =>
      jobs.set(application.job_id, application.job_title),
    )

    return [...jobs.entries()].sort((left, right) =>
      left[1].localeCompare(right[1]),
    )
  }, [applications])

  const selectedTemplate = templates.find(
    (template) => template.key === templateKey,
  )

  const requiresInterviewDate = templateKey === "interview"
  const selectableAudience = [
    ...(audience?.eligible ?? []),
    ...(allowResend
      ? (audience?.blocked.filter(isResendableBlocked) ?? [])
      : []),
  ]

  const chooseStage = (nextStage: EmailStage) => {
    audienceRequestRef.current += 1

    setStage(nextStage)

    setAudience(null)

    setAudienceSelection([])
    setAllowResend(false)
    setCampaignPreview(null)

    const mappedTemplate = stageTemplates[nextStage]

    const nextTemplate =
      templates.find((template) => template.key === mappedTemplate) ??
      templates.find(
        (template) =>
          template.allowed_stages == null ||
          template.allowed_stages.includes(nextStage),
      )

    setTemplateKey(nextTemplate?.key ?? "")
  }

  const workflowSteps = useMemo(() => {
    const status = activeDraft?.status

    return [
      { label: "AI Draft", done: Boolean(activeDraft) },

      {
        label: "HR Review",

        done: status === "Approved" || status === "Sent" || status === "Failed",
      },

      { label: "Approve & Send", done: status === "Sent" },
    ]
  }, [activeDraft])

  const generate = async () => {
    if (audienceSelection.length === 0 || !templateKey || generating) return

    setGenerating(true)

    setError("")

    setSuccess("")

    try {
      const created = await emailWorkflowApi.createCampaign({
        application_ids: audienceSelection,
        template_key: templateKey,
        allow_resend: allowResend,
        guidance,
        interview_lead_days: interviewLeadDays,

        interview_window: interviewWindow,
      })

      setCampaignPreview(created)

      setDrafts((current) => [
        ...created.drafts,

        ...current.filter(
          (draft) =>
            !created.drafts.some(
              (createdDraft) => createdDraft.email_id === draft.email_id,
            ),
        ),
      ])

      selectDraft(created.drafts[0] ?? null)
      setAudienceSelection([])
      setAllowResend(false)
      await loadAudience()

      setSuccess("AI draft created. Review and edit it before approving.")
    } catch (cause) {
      setError(errorMessage(cause, "Could not generate this email campaign."))
    } finally {
      setGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!activeDraft || activeDraft.status !== "Draft" || saving) return null

    if (!subject.trim() || !body.trim()) {
      setError("Subject and email body are required.")

      return null
    }

    setSaving(true)

    setError("")

    setSuccess("")

    try {
      const updated = await emailWorkflowApi.update(
        activeDraft.email_id,

        subject.trim(),

        body.trim(),
      )

      replaceDraft(updated)

      setSuccess("Draft changes saved.")

      return updated
    } catch (cause) {
      setError(errorMessage(cause, "Could not save this email draft."))

      return null
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    if (!activeDraft || workflowAction) return

    if (!subject.trim() || !body.trim()) {
      setError("Subject and email body are required.")

      return
    }

    setWorkflowAction("approve")

    setError("")

    setSuccess("")

    try {
      let draft = activeDraft

      if (dirty) {
        draft = await emailWorkflowApi.update(
          activeDraft.email_id,

          subject.trim(),

          body.trim(),
        )
      }

      const approved = await emailWorkflowApi.approve(draft.email_id)

      replaceDraft(approved)

      setSuccess("Draft approved. It is now eligible to send.")
    } catch (cause) {
      setError(errorMessage(cause, "Could not approve this email draft."))
    } finally {
      setWorkflowAction(null)
    }
  }

  const send = async () => {
    if (!activeDraft || workflowAction) return

    setWorkflowAction("send")

    setError("")

    setSuccess("")

    try {
      const sent = await emailWorkflowApi.send(activeDraft.email_id)

      replaceDraft(sent)

      setSuccess(`Email sent to ${sent.recipient_email}.`)
    } catch (cause) {
      setError(
        errorMessage(
          cause,

          "Email delivery failed. Review the error and retry.",
        ),
      )

      try {
        const refreshed = await emailWorkflowApi.listDrafts()

        setDrafts(refreshed)

        const failed = refreshed.find(
          (draft) => draft.email_id === activeDraft.email_id,
        )

        if (failed) selectDraft(failed)
      } catch {
        // Keep the original delivery error if refresh also fails.
      }
    } finally {
      setWorkflowAction(null)
    }
  }

  const reopen = async () => {
    if (!activeDraft || activeDraft.status !== "Failed" || workflowAction)
      return

    setWorkflowAction("reopen")

    setError("")

    setSuccess("")

    try {
      const reopened = await emailWorkflowApi.reopen(activeDraft.email_id)

      replaceDraft(reopened)

      setSuccess("Draft reopened. Review it and approve again before sending.")
    } catch (cause) {
      setError(errorMessage(cause, "Could not reopen this failed email draft."))
    } finally {
      setWorkflowAction(null)
    }
  }

  const bulkSend = async () => {
    if (bulkSelection.length === 0 || workflowAction) return

    setWorkflowAction("bulk")

    setError("")

    setSuccess("")

    try {
      const result = await emailWorkflowApi.bulkSend(bulkSelection)

      setSuccess(
        `Bulk delivery finished: ${result.sent_count} sent, ${result.failed_count} failed.`,
      )

      setBulkSelection([])

      await load(activeDraft?.email_id)
    } catch (cause) {
      setError(errorMessage(cause, "Bulk delivery could not be completed."))
    } finally {
      setWorkflowAction(null)
    }
  }

  const approvedCount = drafts.filter(
    (draft) => draft.status === "Approved",
  ).length

  const sentCount = drafts.filter((draft) => draft.status === "Sent").length

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(
      stages.map((item) => [item, 0]),
    ) as Record<EmailStage, number>

    applications.forEach((application) => {
      if (
        stages.includes(application.current_stage as EmailStage) &&
        (jobId == null || application.job_id === jobId)
      ) {
        counts[(application.current_stage as EmailStage)] += 1
      }
    })

    return counts
  }, [applications, jobId])

  const campaignGroups = useMemo(() => {
    const grouped = new Map<string, CandidateEmailDraft[]>()

    drafts.forEach((draft) => {
      const key =
        draft.campaign_id == null
          ? `individual-${draft.email_id}`
          : `campaign-${draft.campaign_id}`

      grouped.set(key, [...(grouped.get(key) ?? []), draft])
    })

    return [...grouped.entries()]
  }, [drafts])

  const templateName = (key: string) =>
    templates.find((template) => template.key === key)?.name ??
    key

      .replace(/_/g, " ")

      .replace(/^./, (letter: string) => letter.toUpperCase())

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            HR · Smart Communications
          </div>
          <h1>Auto Email &amp; Smart Reply</h1>
          <p>
            Stage-aware campaigns with one reviewed message for each audience.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="fc-badge fc-badge--amber">
            <Sparkle size={12} /> AI-Powered
          </span>
          <button
            type="button"
            className="fc-btn fc-btn--secondary"
            disabled={loading}
            onClick={() => void load(activeDraft?.email_id)}
          >
            <ArrowClockwise size={15} />
            Refresh
          </button>
        </div>
      </div>

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

      {error && templates.length > 0 && (
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
          Loading templates, candidates, and delivery records...
        </div>
      ) : error && templates.length === 0 ? (
        <div
          className="fc-card fc-card--pad"
          role="alert"
          style={{ textAlign: "center" }}
        >
          <WarningCircle size={30} color="var(--danger)" />
          <strong style={{ display: "block", margin: "8px 0" }}>
            Email workflow could not be loaded
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
      ) : (
        <div
          className="fc-stagger"
          style={{
            display: "grid",

            gridTemplateColumns: "minmax(240px,280px) minmax(0,1fr)",

            gap: 20,

            alignItems: "start",
          }}
        >
          <section
            className="fc-card fc-card--pad email-campaign-builder"
            style={{ gridColumn: "1 / -1" }}
          >
            <div className="email-campaign-heading">
              <div>
                <div className="fc-eyebrow">Stage-driven campaign</div>
                <h2>Create a candidate email campaign</h2>
              </div>
              <label className="email-campaign-job-filter">
                <span className="fc-field-label">Filter by job</span>
                <select
                  className="fc-input"
                  value={jobId ?? ""}
                  onChange={(event) => {
                    audienceRequestRef.current += 1

                    setJobId(
                      event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    )

                    setAudience(null)
                    setAudienceSelection([])
                    setAllowResend(false)
                  }}
                >
                  <option value="">All jobs</option>
                  {jobOptions.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="email-campaign-step">
              <div className="email-campaign-step__number">1</div>
              <div className="email-campaign-step__content">
                <strong>Choose pipeline stage</strong>
                <p>Recipients are loaded from their current pipeline stage.</p>
                <div
                  className="email-stage-chips"
                  role="group"
                  aria-label="Pipeline stage"
                >
                  {stages.map((item) => {
                    const colors = stageColors[item]

                    const active = stage === item

                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={active}
                        className="email-stage-chip"
                        onClick={() => chooseStage(item)}
                        style={{
                          color: colors.text,

                          background: active ? colors.soft : "var(--surface)",

                          borderColor: active ? colors.dot : "var(--border)",
                        }}
                      >
                        <span style={{ background: colors.dot }} />
                        {item}
                        <b>{stageCounts[item]}</b>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="email-campaign-step">
              <div className="email-campaign-step__number">2</div>
              <div className="email-campaign-step__content">
                <div className="email-audience-toolbar">
                  <div>
                    <strong>Choose recipients</strong>
                    <p>
                      Only eligible applications can be selected. Blocked rows
                      explain what needs attention.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="fc-btn fc-btn--secondary"
                      disabled={selectableAudience.length === 0}
                      onClick={() =>
                        setAudienceSelection(
                          selectableAudience.map((item) => item.application_id),
                        )
                      }
                    >
                      Select all eligible
                    </button>
                    <button
                      type="button"
                      className="fc-btn fc-btn--ghost"
                      disabled={audienceSelection.length === 0}
                      onClick={() => setAudienceSelection([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {audienceLoading ? (
                  <div className="email-audience-empty">
                    Loading audience...
                  </div>
                ) : audienceError ? (
                  <div className="job-alert job-alert--error" role="alert">
                    <WarningCircle size={16} />
                    <span>{audienceError}</span>
                    <button type="button" onClick={() => void loadAudience()}>
                      Retry
                    </button>
                  </div>
                ) : (audience?.eligible.length ?? 0) === 0 &&
                  (audience?.blocked.length ?? 0) === 0 ? (
                  <div className="email-audience-empty">
                    <Envelope size={26} />
                    <strong>No candidates in {stage}</strong>
                    <p>Move candidates in Pipeline or choose another stage.</p>
                  </div>
                ) : (
                  <div className="email-audience-table-wrap">
                    <table className="email-audience-table">
                      <thead>
                        <tr>
                          <th aria-label="Select recipient" />
                          <th>Candidate</th>
                          <th>Job</th>
                          <th>Match</th>
                          <th>Email status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audience?.eligible.map((item) => (
                          <tr key={item.application_id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${item.candidate_name}`}
                                checked={audienceSelection.includes(
                                  item.application_id,
                                )}
                                onChange={(event) =>
                                  setAudienceSelection((current) =>
                                    event.target.checked
                                      ? [...current, item.application_id]
                                      : current.filter(
                                          (id) => id !== item.application_id,
                                        ),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <strong>{item.candidate_name}</strong>
                              <small>{item.candidate_email}</small>
                            </td>
                            <td>{item.job_title}</td>
                            <td>
                              {item.overall_score == null
                                ? "Pending"
                                : `${Math.round(item.overall_score)} · ${item.match_label ?? "Scored"}`}
                            </td>
                            <td>
                              {item.already_emailed_for_stage ? (
                                <span className="fc-badge fc-badge--blue">
                                  Already emailed
                                </span>
                              ) : (
                                <span className="fc-badge fc-badge--green">
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {audience?.blocked.map((item) => {
                          const resendable =
                            allowResend && isResendableBlocked(item)
                          return (
                            <tr
                              key={item.application_id}
                              className={resendable ? undefined : "is-blocked"}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  disabled={!resendable}
                                  aria-label={`Select ${item.candidate_name}`}
                                  checked={audienceSelection.includes(
                                    item.application_id,
                                  )}
                                  onChange={(event) =>
                                    setAudienceSelection((current) =>
                                      event.target.checked
                                        ? [...current, item.application_id]
                                        : current.filter(
                                            (id) => id !== item.application_id,
                                          ),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <strong>{item.candidate_name}</strong>
                                <small>
                                  {item.candidate_email || "No email"}
                                </small>
                              </td>
                              <td>{item.job_title}</td>
                              <td>
                                {item.overall_score == null
                                  ? "Pending"
                                  : Math.round(item.overall_score)}
                              </td>
                              <td>
                                <span className="fc-badge fc-badge--red">
                                  {item.blocked_reason ?? "Unavailable"}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="email-campaign-step">
              <div className="email-campaign-step__number">3</div>
              <div className="email-campaign-step__content">
                <strong>Generate shared content</strong>
                <p>
                  Every recipient gets the same approved wording; only safe
                  placeholders such as name and job title change.
                </p>
                <div className="email-campaign-form">
                  <label>
                    <span className="fc-field-label">Template</span>
                    <select
                      className="fc-input"
                      value={templateKey}
                      onChange={(event) => {
                        setTemplateKey(event.target.value)
                        setAudienceSelection([])
                        setAllowResend(false)
                        setCampaignPreview(null)
                      }}
                    >
                      {templates.map((template) => {
                        const allowed =
                          template.allowed_stages == null ||
                          template.allowed_stages.includes(stage)

                        return (
                          <option
                            key={template.key}
                            value={template.key}
                            disabled={!allowed}
                            title={
                              allowed
                                ? template.description
                                : `${template.name} is not available for ${stage}.`
                            }
                          >
                            {template.name}
                            {!allowed ? ` — unavailable for ${stage}` : ""}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  {requiresInterviewDate && (
                    <>
                      <label>
                        <span className="fc-field-label">
                          Interview lead days
                        </span>
                        <input
                          className="fc-input"
                          type="number"
                          min={1}
                          max={30}
                          value={interviewLeadDays}
                          onChange={(event) =>
                            setInterviewLeadDays(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span className="fc-field-label">Interview window</span>
                        <input
                          className="fc-input"
                          maxLength={120}
                          value={interviewWindow}
                          onChange={(event) =>
                            setInterviewWindow(event.target.value)
                          }
                        />
                      </label>
                    </>
                  )}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label="Allow resend to candidates already emailed for this stage"
                      checked={allowResend}
                      onChange={(event) => {
                        const nextValue = event.target.checked
                        setAllowResend(nextValue)
                        if (!nextValue) {
                          const overrideIds = new Set(
                            (audience?.blocked ?? [])
                              .filter(isResendableBlocked)
                              .map((item) => item.application_id),
                          )
                          setAudienceSelection((current) =>
                            current.filter((id) => !overrideIds.has(id)),
                          )
                        }
                      }}
                    />
                    <span>
                      Allow resend to candidates already emailed for this stage
                    </span>
                  </label>
                  <label className="email-campaign-guidance">
                    <span className="fc-field-label">
                      Candidate-visible guidance (optional)
                    </span>
                    <textarea
                      className="fc-input"
                      value={guidance}
                      maxLength={2000}
                      rows={4}
                      placeholder="Add only facts that every selected candidate may receive."
                      onChange={(event) => setGuidance(event.target.value)}
                    />
                    <small>
                      The draft will not invent reasons, links, compensation, or
                      offer terms.
                    </small>
                  </label>
                </div>
                <button
                  type="button"
                  className="fc-btn fc-btn--primary"
                  disabled={
                    audienceSelection.length === 0 ||
                    !selectedTemplate ||
                    generating ||
                    (requiresInterviewDate &&
                      (interviewLeadDays < 1 || interviewLeadDays > 30))
                  }
                  onClick={() => void generate()}
                >
                  <Sparkle size={15} />
                  {generating
                    ? "Generating campaign..."
                    : `Generate for ${audienceSelection.length} candidate${
                        audienceSelection.length === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </div>

            {campaignPreview && (
              <div className="email-campaign-shared">
                <div className="email-campaign-shared__head">
                  <div>
                    <div className="fc-eyebrow">Shared content</div>
                    <strong>
                      {campaignPreview.recipient_count} recipient
                      {campaignPreview.recipient_count === 1 ? "" : "s"}
                    </strong>
                  </div>
                  <span
                    className={`fc-badge ${
                      campaignPreview.ai_generated
                        ? "fc-badge--blue"
                        : "fc-badge--amber"
                    }`}
                  >
                    {campaignPreview.ai_generated
                      ? "AI-generated"
                      : "Standard template"}
                  </span>
                </div>
                <pre>{campaignPreview.shared_body_skeleton}</pre>
                <div className="email-campaign-draft-list">
                  {campaignPreview.drafts.map((draft) => (
                    <button
                      type="button"
                      key={draft.email_id}
                      onClick={() => selectDraft(draft)}
                    >
                      <strong>{draft.candidate_name}</strong>
                      <span>{draft.subject}</span>
                    </button>
                  ))}
                </div>
                {campaignPreview.skipped.length > 0 && (
                  <small>
                    {campaignPreview.skipped.length} recipient
                    {campaignPreview.skipped.length === 1 ? " was" : "s were"}{" "}
                    skipped because they are no longer eligible.
                  </small>
                )}
              </div>
            )}
          </section>

          <div
            className="fc-stagger"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div className="fc-card fc-card--pad">
              <div className="fc-eyebrow" style={{ marginBottom: 14 }}>
                Workflow Summary
              </div>
              {[
                { label: "All drafts", value: drafts.length },

                { label: "Ready to send", value: approvedCount },

                { label: "Sent", value: sentCount },
              ].map((stat, index) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",

                    alignItems: "center",

                    padding: "11px 0",

                    borderBottom:
                      index < 2 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span
                    style={{
                      flex: 1,

                      fontSize: 13,

                      color: "var(--text-secondary)",
                    }}
                  >
                    {stat.label}
                  </span>
                  <strong className="fc-stat__value" style={{ fontSize: 20 }}>
                    {stat.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div
            className="fc-stagger"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div className="fc-card fc-card--pad">
              <div
                className="fc-eyebrow"
                style={{ marginBottom: 16, textAlign: "center" }}
              >
                Review Workflow
              </div>
              <div
                style={{
                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",
                }}
              >
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.label}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <div
                      style={{
                        display: "flex",

                        flexDirection: "column",

                        alignItems: "center",

                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 40,

                          height: 40,

                          borderRadius: "50%",

                          background: step.done
                            ? "var(--accent)"
                            : "var(--surface)",

                          border: step.done
                            ? "none"
                            : "2px solid var(--accent-soft-2)",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          color: step.done ? "#fff" : "var(--accent)",

                          boxShadow: step.done
                            ? "0 6px 16px var(--accent-glow)"
                            : "none",
                        }}
                      >
                        {step.done ? (
                          <Check size={17} />
                        ) : index === 0 ? (
                          <Sparkle size={16} />
                        ) : index === 1 ? (
                          <Envelope size={16} />
                        ) : (
                          <PaperPlaneRight size={16} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,

                          fontWeight: step.done ? 700 : 500,

                          color: step.done
                            ? "var(--text-primary)"
                            : "var(--accent)",

                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                    {index < workflowSteps.length - 1 && (
                      <div
                        style={{
                          width: 78,

                          height: 2,

                          background: step.done
                            ? "var(--accent)"
                            : "var(--border)",

                          margin: "0 10px 24px",

                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="fc-card fc-card--pad">
              <div className="fc-section-title" style={{ marginBottom: 16 }}>
                <PaperPlaneRight size={16} color="var(--accent)" />
                <h3>Email Preview</h3>
                {activeDraft && (
                  <>
                    {activeDraft.stage_changed_since_generation && (
                      <span className="fc-badge fc-badge--red">
                        Stage changed
                      </span>
                    )}
                    <span
                      className={`fc-badge ${statusClass(activeDraft.status)}`}
                    >
                      {activeDraft.status}
                    </span>
                  </>
                )}
              </div>

              {!activeDraft ? (
                <div
                  className="fc-panel"
                  style={{ padding: 28, textAlign: "center" }}
                >
                  <Envelope size={30} style={{ marginBottom: 8 }} />
                  <strong style={{ display: "block" }}>
                    No draft selected
                  </strong>
                  <p>Generate an AI draft or select a delivery record below.</p>
                </div>
              ) : (
                <>
                  <div
                    className="fc-panel"
                    style={{ padding: "14px 18px", marginBottom: 18 }}
                  >
                    <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 12,

                          color: "var(--text-muted)",

                          width: 54,

                          fontWeight: 600,
                        }}
                      >
                        To:
                      </span>
                      <span
                        style={{
                          fontSize: 13.5,

                          fontWeight: 600,

                          color: "var(--text-primary)",
                        }}
                      >
                        {activeDraft.candidate_name} &lt;
                        {activeDraft.recipient_email}&gt;
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span
                        style={{
                          fontSize: 12,

                          color: "var(--text-muted)",

                          width: 54,

                          fontWeight: 600,
                        }}
                      >
                        Job:
                      </span>
                      <span
                        style={{
                          fontSize: 13.5,

                          fontWeight: 600,

                          color: "var(--text-primary)",
                        }}
                      >
                        {activeDraft.job_title}
                      </span>
                    </div>
                  </div>

                  {!activeDraft.recipient_email_valid && (
                    <div
                      className="job-alert job-alert--error"
                      role="status"
                      style={{ marginBottom: 14 }}
                    >
                      <WarningCircle size={16} />
                      <span>
                        Candidate email address is missing or invalid. Update it
                        before sending.
                      </span>
                    </div>
                  )}

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span className="fc-field-label">Subject</span>
                    <input
                      className="fc-input"
                      value={subject}
                      maxLength={300}
                      readOnly={activeDraft.status !== "Draft"}
                      onChange={(event) => setSubject(event.target.value)}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <span className="fc-field-label">Email body</span>
                    <textarea
                      className="fc-input"
                      style={{ minHeight: 270, lineHeight: 1.65 }}
                      value={body}
                      maxLength={30000}
                      readOnly={activeDraft.status !== "Draft"}
                      onChange={(event) => setBody(event.target.value)}
                    />
                  </label>

                  {activeDraft.error_message && (
                    <div
                      className="job-alert job-alert--error"
                      role="status"
                      style={{ marginTop: 14 }}
                    >
                      <WarningCircle size={16} />
                      <span>{activeDraft.error_message}</span>
                    </div>
                  )}

                  {activeDraft.stage_changed_since_generation && (
                    <div
                      className="job-alert job-alert--error"
                      role="status"
                      style={{ marginTop: 14 }}
                    >
                      <WarningCircle size={16} />
                      <span>
                        This candidate moved from{" "}
                        {activeDraft.stage_at_generation} to{" "}
                        {activeDraft.current_stage}. Reopen and regenerate the
                        email before sending it.
                      </span>
                    </div>
                  )}

                  {activeDraft.delivery_status && (
                    <p
                      style={{
                        marginTop: 10,

                        color: "var(--text-muted)",

                        fontSize: 12,
                      }}
                    >
                      Provider delivery status: {activeDraft.delivery_status}
                      {activeDraft.retry_count > 0 &&
                        ` · attempt ${activeDraft.retry_count}`}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",

                      alignItems: "center",

                      gap: 10,

                      marginTop: 18,

                      flexWrap: "wrap",
                    }}
                  >
                    {activeDraft.status === "Draft" && (
                      <>
                        <button
                          type="button"
                          className="fc-btn fc-btn--secondary"
                          disabled={!dirty || saving || Boolean(workflowAction)}
                          onClick={() => void saveDraft()}
                        >
                          <FloppyDisk size={15} />
                          {saving ? "Saving..." : "Save draft"}
                        </button>
                        <button
                          type="button"
                          className="fc-btn fc-btn--primary"
                          disabled={
                            !subject.trim() ||
                            !body.trim() ||
                            Boolean(workflowAction)
                          }
                          onClick={() => void approve()}
                        >
                          <CheckCircle size={15} />
                          {workflowAction === "approve"
                            ? "Approving..."
                            : "Approve draft"}
                        </button>
                      </>
                    )}

                    {(activeDraft.status === "Approved" ||
                      (activeDraft.status === "Failed" &&
                        activeDraft.retryable)) && (
                      <button
                        type="button"
                        className="fc-btn fc-btn--primary"
                        disabled={
                          Boolean(workflowAction) ||
                          activeDraft.stage_changed_since_generation
                        }
                        onClick={() => void send()}
                      >
                        <PaperPlaneRight size={15} />
                        {workflowAction === "send"
                          ? "Sending..."
                          : activeDraft.status === "Failed"
                            ? "Retry delivery"
                            : "Send approved email"}
                      </button>
                    )}

                    {activeDraft.status === "Failed" && (
                      <button
                        type="button"
                        className="fc-btn fc-btn--secondary"
                        disabled={Boolean(workflowAction)}
                        onClick={() => void reopen()}
                      >
                        <ArrowClockwise size={15} />
                        {workflowAction === "reopen"
                          ? "Reopening..."
                          : "Reopen for review"}
                      </button>
                    )}

                    {activeDraft.status === "Sent" && (
                      <div
                        className="fc-panel"
                        style={{
                          display: "flex",

                          alignItems: "center",

                          gap: 8,

                          padding: "11px 14px",

                          background: "var(--success-soft)",
                        }}
                      >
                        <CheckCircle size={18} color="var(--success)" />
                        <span
                          style={{
                            color: "var(--success)",

                            fontWeight: 700,
                          }}
                        >
                          Sent {formatDate(activeDraft.sent_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <section
            className="fc-card fc-card--pad"
            style={{ gridColumn: "1 / -1" }}
          >
            <div
              style={{
                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                gap: 14,

                marginBottom: 14,
              }}
            >
              <div>
                <div className="fc-eyebrow">Delivery tracking</div>
                <h2>Email records</h2>
              </div>
              <button
                type="button"
                className="fc-btn fc-btn--secondary"
                disabled={bulkSelection.length === 0 || Boolean(workflowAction)}
                onClick={() => void bulkSend()}
              >
                <Users size={14} />
                {workflowAction === "bulk"
                  ? "Sending..."
                  : `Send selected (${bulkSelection.length})`}
              </button>
            </div>

            {drafts.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>
                <strong
                  style={{ display: "block", color: "var(--text-primary)" }}
                >
                  No email records yet
                </strong>
                <p>Generated drafts and delivery results will appear here.</p>
              </div>
            ) : (
              <div className="email-campaign-records">
                {campaignGroups.map(([groupKey, groupDrafts]) => {
                  const sendable = groupDrafts.filter(
                    (draft) =>
                      !draft.stage_changed_since_generation &&
                      (draft.status === "Approved" ||
                        (draft.status === "Failed" && draft.retryable)),
                  )

                  const selectedCount = sendable.filter((draft) =>
                    bulkSelection.includes(draft.email_id),
                  ).length

                  const sent = groupDrafts.filter(
                    (draft) => draft.status === "Sent",
                  ).length

                  const firstDraft = groupDrafts[0]

                  return (
                    <section
                      className="email-campaign-record-group"
                      key={groupKey}
                    >
                      <div className="email-campaign-record-group__head">
                        <input
                          type="checkbox"
                          disabled={sendable.length === 0}
                          checked={
                            sendable.length > 0 &&
                            selectedCount === sendable.length
                          }
                          aria-label={`Select ${templateName(firstDraft.template_key)} campaign`}
                          onChange={(event) => {
                            const ids = sendable.map((draft) => draft.email_id)

                            setBulkSelection((current) =>
                              event.target.checked
                                ? [...new Set([...current, ...ids])]
                                : current.filter((id) => !ids.includes(id)),
                            )
                          }}
                        />
                        <strong>{templateName(firstDraft.template_key)}</strong>
                        <span>
                          {groupDrafts.length} recipient
                          {groupDrafts.length === 1 ? "" : "s"} · {sent} sent ·{" "}
                          {groupDrafts.length - sent} pending
                        </span>
                        {firstDraft.campaign_id != null && (
                          <small>Campaign #{firstDraft.campaign_id}</small>
                        )}
                      </div>
                      <div className="email-campaign-record-list">
                        {groupDrafts.map((draft) => {
                          const eligible =
                            !draft.stage_changed_since_generation &&
                            (draft.status === "Approved" ||
                              (draft.status === "Failed" && draft.retryable))

                          const active =
                            activeDraft?.email_id === draft.email_id

                          return (
                            <article
                              className={active ? "is-active" : undefined}
                              key={draft.email_id}
                            >
                              <input
                                type="checkbox"
                                disabled={!eligible}
                                checked={bulkSelection.includes(draft.email_id)}
                                aria-label={`Select email for ${draft.candidate_name}`}
                                onChange={(event) =>
                                  setBulkSelection((current) =>
                                    event.target.checked
                                      ? [
                                          ...new Set([
                                            ...current,

                                            draft.email_id,
                                          ]),
                                        ]
                                      : current.filter(
                                          (id) => id !== draft.email_id,
                                        ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                onClick={() => selectDraft(draft)}
                              >
                                <div>
                                  <strong>{draft.candidate_name}</strong>
                                  <span>{draft.job_title}</span>
                                </div>
                                <p>{draft.subject}</p>
                                {draft.stage_changed_since_generation && (
                                  <span className="fc-badge fc-badge--red">
                                    Stage changed
                                  </span>
                                )}
                                <span
                                  className={`fc-badge ${statusClass(draft.status)}`}
                                >
                                  {draft.status}
                                </span>
                              </button>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
      <SmartReplyPanel />
    </div>
  )
}
