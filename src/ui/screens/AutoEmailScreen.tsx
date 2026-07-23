import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit3,
  Mail,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { emailWorkflowApi } from "@/api/emailWorkflowApi"
import { pipelineApi } from "@/api/pipelineApi"
import type { CandidateEmailDraft, EmailTemplate } from "@/types/emailWorkflow"
import type { PipelineApplication } from "@/types/pipeline"

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
    useState<"approve" | "send" | "bulk" | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = useCallback(async () => {
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
      if (activeDraft) {
        const refreshed = nextDrafts.find(
          (draft) => draft.email_id === activeDraft.email_id,
        )
        if (refreshed) selectDraft(refreshed)
      }
    } catch (cause) {
      setError(errorMessage(cause, "Could not load candidate email workflow."))
    } finally {
      setLoading(false)
    }
  }, [activeDraft?.email_id])

  useEffect(() => {
    void load()
    // Initial load only; explicit Refresh keeps edits from being overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectDraft = (draft: CandidateEmailDraft) => {
    setActiveDraft(draft)
    setSubject(draft.subject)
    setBody(draft.body)
  }

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

  const generatedFor = useMemo(
    () =>
      applications.find(
        (application) => application.application_id === applicationId,
      ),
    [applicationId, applications],
  )

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
        // Preserve the original delivery error if refresh also fails.
      }
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
      const refreshed = await emailWorkflowApi.listDrafts()
      setDrafts(refreshed)
      if (activeDraft) {
        const current = refreshed.find(
          (draft) => draft.email_id === activeDraft.email_id,
        )
        if (current) selectDraft(current)
      }
    } catch (cause) {
      setError(errorMessage(cause, "Bulk delivery could not be completed."))
    } finally {
      setWorkflowAction(null)
    }
  }

  if (loading) {
    return (
      <div className="fc-card email-page-state" aria-live="polite">
        <span className="state-spinner" />
        <strong>Loading email workflow</strong>
        <p>Fetching templates, candidates, and delivery records...</p>
      </div>
    )
  }

  if (error && templates.length === 0) {
    return (
      <div className="fc-card email-page-state" role="alert">
        <AlertCircle size={30} aria-hidden="true" />
        <strong>Email workflow could not be loaded</strong>
        <p>{error}</p>
        <button
          className="fc-btn fc-btn--secondary"
          onClick={() => void load()}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow">HR · Smart communications</div>
          <h1>Candidate Email Workflow</h1>
          <p>Generate, review, approve, send, and track every message.</p>
        </div>
        <button
          className="fc-btn fc-btn--secondary"
          onClick={() => void load()}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh
        </button>
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
      {error && (
        <div className="job-alert job-alert--error" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="email-workflow-grid">
        <aside className="fc-card email-template-panel">
          <div className="fc-section-title">
            <Mail size={16} aria-hidden="true" />
            <div>
              <h2>Template library</h2>
              <p>Choose the purpose for a new draft.</p>
            </div>
          </div>
          <div className="email-template-list">
            {templates.map((template) => (
              <button
                type="button"
                key={template.key}
                className={
                  templateKey === template.key ? "is-active" : undefined
                }
                onClick={() => setTemplateKey(template.key)}
              >
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>

          <div className="email-generator">
            <label>
              <span className="fc-field-label">Candidate application</span>
              <select
                className="fc-input"
                value={applicationId ?? ""}
                onChange={(event) =>
                  setApplicationId(
                    event.target.value ? Number(event.target.value) : undefined,
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
            {generatedFor && (
              <p>
                {generatedFor.candidate_email} · {generatedFor.current_stage}
              </p>
            )}
            <button
              className="fc-btn fc-btn--primary"
              disabled={!applicationId || !templateKey || generating}
              onClick={() => void generate()}
            >
              <Sparkles size={15} aria-hidden="true" />
              {generating ? "Generating..." : "Generate AI draft"}
            </button>
          </div>
        </aside>

        <main className="fc-card email-composer">
          {!activeDraft ? (
            <div className="email-composer-empty">
              <Edit3 size={34} aria-hidden="true" />
              <strong>No draft selected</strong>
              <p>
                Generate a draft or select one from delivery tracking below.
              </p>
            </div>
          ) : (
            <>
              <div className="email-composer-head">
                <div>
                  <span
                    className={`fc-badge ${statusClass(activeDraft.status)}`}
                  >
                    {activeDraft.status}
                  </span>
                  <h2>{activeDraft.candidate_name}</h2>
                  <p>
                    {activeDraft.recipient_email} · {activeDraft.job_title}
                  </p>
                </div>
                <span className="email-ai-label">
                  <Sparkles size={13} aria-hidden="true" />
                  AI draft
                </span>
              </div>

              <div className="email-review-steps" aria-label="Email workflow">
                {["AI Draft", "HR Review", "HR Approval", "Delivery"].map(
                  (step, index) => {
                    const completed =
                      index === 0 ||
                      (index === 1 && activeDraft.status !== "Draft") ||
                      (index === 2 &&
                        ["Approved", "Sent", "Failed"].includes(
                          activeDraft.status,
                        )) ||
                      (index === 3 && activeDraft.status === "Sent")
                    return (
                      <span
                        className={completed ? "is-complete" : ""}
                        key={step}
                      >
                        {completed ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                        {step}
                      </span>
                    )
                  },
                )}
              </div>

              <label>
                <span className="fc-field-label">Subject</span>
                <input
                  className="fc-input"
                  value={subject}
                  maxLength={300}
                  readOnly={activeDraft.status !== "Draft"}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label>
                <span className="fc-field-label">Email body</span>
                <textarea
                  className="fc-input email-body-input"
                  value={body}
                  maxLength={30000}
                  readOnly={activeDraft.status !== "Draft"}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>

              {activeDraft.error_message && (
                <div className="email-delivery-error" role="status">
                  <AlertCircle size={16} aria-hidden="true" />
                  <div>
                    <strong>Last delivery failed</strong>
                    <p>{activeDraft.error_message}</p>
                  </div>
                </div>
              )}

              <div className="email-composer-actions">
                {activeDraft.status === "Draft" && (
                  <>
                    <button
                      className="fc-btn fc-btn--secondary"
                      disabled={!dirty || saving || Boolean(workflowAction)}
                      onClick={() => void saveDraft()}
                    >
                      <Save size={14} aria-hidden="true" />
                      {saving ? "Saving..." : "Save draft"}
                    </button>
                    <button
                      className="fc-btn fc-btn--primary"
                      disabled={
                        !subject.trim() ||
                        !body.trim() ||
                        Boolean(workflowAction)
                      }
                      onClick={() => void approve()}
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                      {workflowAction === "approve"
                        ? "Approving..."
                        : "Approve draft"}
                    </button>
                  </>
                )}
                {["Approved", "Failed"].includes(activeDraft.status) && (
                  <button
                    className="fc-btn fc-btn--primary"
                    disabled={Boolean(workflowAction)}
                    onClick={() => void send()}
                  >
                    <Send size={14} aria-hidden="true" />
                    {workflowAction === "send"
                      ? "Sending..."
                      : activeDraft.status === "Failed"
                        ? "Retry delivery"
                        : "Send approved email"}
                  </button>
                )}
                {activeDraft.status === "Sent" && (
                  <span className="email-sent-confirmation">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Sent {formatDate(activeDraft.sent_at)}
                  </span>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <section className="fc-card email-tracking">
        <div className="email-tracking-head">
          <div>
            <div className="fc-eyebrow">Delivery tracking</div>
            <h2>Email records</h2>
          </div>
          <button
            className="fc-btn fc-btn--secondary"
            disabled={bulkSelection.length === 0 || Boolean(workflowAction)}
            onClick={() => void bulkSend()}
          >
            <Users size={14} aria-hidden="true" />
            {workflowAction === "bulk"
              ? "Sending..."
              : `Send selected (${bulkSelection.length})`}
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="email-tracking-empty">
            <Mail size={28} aria-hidden="true" />
            <strong>No email records yet</strong>
            <p>Your generated drafts and delivery results will appear here.</p>
          </div>
        ) : (
          <div className="email-record-list">
            {drafts.map((draft) => {
              const eligible = ["Approved", "Failed"].includes(draft.status)
              return (
                <article
                  className={
                    activeDraft?.email_id === draft.email_id
                      ? "is-active"
                      : undefined
                  }
                  key={draft.email_id}
                >
                  <label>
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
                  </label>
                  <button type="button" onClick={() => selectDraft(draft)}>
                    <div>
                      <strong>{draft.candidate_name}</strong>
                      <span>{draft.job_title}</span>
                    </div>
                    <p>{draft.subject}</p>
                    <span className={`fc-badge ${statusClass(draft.status)}`}>
                      {draft.status}
                    </span>
                    <time>
                      {formatDate(
                        draft.sent_at ?? draft.updated_at ?? draft.created_at,
                      )}
                    </time>
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
