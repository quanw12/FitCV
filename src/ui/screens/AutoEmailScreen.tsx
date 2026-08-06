import { useCallback, useEffect, useMemo, useState } from "react"

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
import type { CandidateEmailDraft, EmailTemplate } from "@/types/emailWorkflow"
import type { PipelineApplication } from "@/types/pipeline"
import SmartReplyPanel from "@/ui/components/SmartReplyPanel"

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

const templatePalette = [
  { icon: "✅", color: "#10B981" },
  { icon: "⭐", color: "#4F46E5" },
  { icon: "❌", color: "#EF4444" },
  { icon: "📅", color: "#F59E0B" },
]

export default function AutoEmailScreen() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [applications, setApplications] = useState<PipelineApplication[]>([])
  const [drafts, setDrafts] = useState<CandidateEmailDraft[]>([])
  const [templateKey, setTemplateKey] = useState("")
  const [applicationId, setApplicationId] = useState<number | undefined>()
  const [activeDraft, setActiveDraft] = useState<CandidateEmailDraft | null>(
    null,
  )
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
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
      setTemplateKey((current) => current || nextTemplates[0]?.key || "")
      setApplicationId(
        (current) => current ?? nextApplications[0]?.application_id,
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

  const selectedApplication = useMemo(
    () =>
      applications.find(
        (application) => application.application_id === applicationId,
      ),
    [applicationId, applications],
  )

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
    if (!applicationId || !templateKey || generating) return
    setGenerating(true)
    setError("")
    setSuccess("")
    try {
      const created = await emailWorkflowApi.generate(
        applicationId,
        templateKey,
      )
      replaceDraft(created)
      setSuccess("AI draft created. Review and edit it before approving.")
    } catch (cause) {
      setError(errorMessage(cause, "Could not generate an AI email draft."))
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
    if (!activeDraft || activeDraft.status !== "Failed" || workflowAction) return
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

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            HR · Smart Communications
          </div>
          <h1>Auto Email &amp; Smart Reply</h1>
          <p>AI-drafted emails, personalized per candidate.</p>
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
          <div
            className="fc-stagger"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div className="fc-card fc-card--pad">
              <div className="fc-section-title" style={{ marginBottom: 14 }}>
                <Envelope size={16} color="var(--accent)" />
                <h3>Template library</h3>
              </div>

              {templates.map((template, index) => {
                const active = templateKey === template.key
                const palette =
                  templatePalette[index % templatePalette.length] ??
                  templatePalette[0]

                return (
                  <button
                    type="button"
                    key={template.key}
                    onClick={() => setTemplateKey(template.key)}
                    className="fc-chip"
                    title={template.description}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "12px 14px",
                      marginBottom: 8,
                      border: active
                        ? `1px solid ${palette.color}`
                        : "1px solid var(--border)",
                      background: active
                        ? `${palette.color}1a`
                        : "var(--surface)",
                      color: active ? palette.color : "var(--text-secondary)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{palette.icon}</span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {template.name}
                    </span>
                    {active && (
                      <span
                        className="fc-badge fc-badge--blue"
                        style={{ fontSize: 10, padding: "2px 8px" }}
                      >
                        Active
                      </span>
                    )}
                  </button>
                )
              })}

              <label style={{ display: "block", marginTop: 14 }}>
                <span className="fc-field-label">Candidate application</span>
                <select
                  className="fc-input"
                  value={applicationId ?? ""}
                  onChange={(event) =>
                    setApplicationId(
                      event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    )
                  }
                >
                  {applications.length === 0 && (
                    <option value="">No candidates available</option>
                  )}
                  {applications.map((application) => (
                    <option
                      value={application.application_id}
                      key={application.application_id}
                    >
                      {application.candidate_name} · {application.job_title}
                    </option>
                  ))}
                </select>
              </label>

              {selectedApplication && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 8,
                  }}
                >
                  {selectedApplication.candidate_email} ·{" "}
                  {selectedApplication.current_stage}
                </p>
              )}

              <button
                type="button"
                className="fc-btn fc-btn--primary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  marginTop: 12,
                }}
                disabled={!applicationId || !templateKey || generating}
                onClick={() => void generate()}
              >
                <Sparkle size={15} />
                {generating ? "Generating..." : "Generate AI draft"}
              </button>
            </div>

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
                  <span
                    className={`fc-badge ${statusClass(activeDraft.status)}`}
                  >
                    {activeDraft.status}
                  </span>
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
                      (activeDraft.status === "Failed" && activeDraft.retryable)) && (
                      <button
                        type="button"
                        className="fc-btn fc-btn--primary"
                        disabled={Boolean(workflowAction)}
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(min(100%,280px),1fr))",
                  gap: 10,
                }}
              >
                {drafts.map((draft) => {
                  const eligible =
                    draft.status === "Approved" ||
                    (draft.status === "Failed" && draft.retryable)
                  const active = activeDraft?.email_id === draft.email_id

                  return (
                    <article
                      className="fc-panel"
                      key={draft.email_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 10,
                        padding: 12,
                        borderColor: active ? "var(--accent)" : "var(--border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!eligible}
                        checked={bulkSelection.includes(draft.email_id)}
                        aria-label={`Select email for ${draft.candidate_name}`}
                        onChange={(event) =>
                          setBulkSelection((current) =>
                            event.target.checked
                              ? [...current, draft.email_id]
                              : current.filter((id) => id !== draft.email_id),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => selectDraft(draft)}
                        style={{
                          border: 0,
                          background: "transparent",
                          padding: 0,
                          textAlign: "left",
                          color: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 5,
                          }}
                        >
                          <strong>{draft.candidate_name}</strong>
                          <span
                            className={`fc-badge ${statusClass(draft.status)}`}
                          >
                            {draft.status}
                          </span>
                        </div>
                        {draft.delivery_status && (
                          <small style={{ color: "var(--text-muted)" }}>
                            Delivery: {draft.delivery_status}
                          </small>
                        )}
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginBottom: 4,
                          }}
                        >
                          {draft.job_title}
                        </p>
                        <p
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {draft.subject}
                        </p>
                      </button>
                    </article>
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
