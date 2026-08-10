import { useCallback, useEffect, useMemo, useState } from "react"

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Mail,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react"

import { emailWorkflowApi } from "@/api/emailWorkflowApi"

import type {
  CandidateEmailDraft,
  CandidateEmailStatus,
  EmailThreadDetail,
  EmailThreadSummary,
  SmartReplyIntent,
  SmartReplyTone,
} from "@/types/emailWorkflow"

interface ReplyComposer {
  emailId: number

  status: CandidateEmailStatus

  subject: string

  body: string

  deliveryStatus: string | null

  retryable: boolean
}

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",

        month: "short",

        hour: "2-digit",

        minute: "2-digit",
      })
    : "No candidate reply yet"

const composerFromDraft = (draft: CandidateEmailDraft): ReplyComposer => ({
  emailId: draft.email_id,

  status: draft.status,

  subject: draft.subject,

  body: draft.body,

  deliveryStatus: draft.delivery_status,

  retryable: draft.retryable,
})

const actionableReply = (detail: EmailThreadDetail): ReplyComposer | null => {
  const message = [...detail.messages]

    .reverse()

    .find(
      (item) =>
        item.direction === "Outbound" &&
        item.email_id != null &&
        ["Draft", "Approved", "Failed"].includes(item.status),
    )

  if (!message?.email_id) return null

  return {
    emailId: message.email_id,

    status: message.status as CandidateEmailStatus,

    subject: message.subject,

    body: message.body,

    deliveryStatus: message.delivery_status,

    retryable: message.retryable,
  }
}

export default function SmartReplyPanel() {
  const [threads, setThreads] = useState<EmailThreadSummary[]>([])

  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null)

  const [detail, setDetail] = useState<EmailThreadDetail | null>(null)

  const [composer, setComposer] = useState<ReplyComposer | null>(null)

  const [subject, setSubject] = useState("")

  const [body, setBody] = useState("")

  const [tone, setTone] = useState<SmartReplyTone>("professional")
  const [intent, setIntent] = useState<SmartReplyIntent>("general")
  const [guidance, setGuidance] = useState("")
  const [batchSelection, setBatchSelection] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const [detailLoading, setDetailLoading] = useState(false)

  const [action, setAction] =
    useState<"generate" | "batch" | "save" | "approve" | "send" | "reopen" | null>(
      null,
    )

  const [error, setError] = useState("")

  const [success, setSuccess] = useState("")

  const loadThreads = useCallback(async () => {
    setLoading(true)

    setError("")

    try {
      const nextThreads = await emailWorkflowApi.listThreads()
      setThreads(nextThreads)
      setBatchSelection((current) =>
        current.filter((threadId) =>
          nextThreads.some(
            (thread) =>
              thread.thread_id === threadId &&
              thread.last_inbound_at != null &&
              thread.has_fetched_inbound !== false,
          ),
        ),
      )
      setSelectedThreadId((current) => {
        if (current && nextThreads.some((item) => item.thread_id === current)) {
          return current
        }

        return nextThreads[0]?.thread_id ?? null
      })
    } catch (cause) {
      setError(errorMessage(cause, "Could not load candidate conversations."))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (threadId: number) => {
    setDetailLoading(true)

    setError("")

    try {
      const nextDetail = await emailWorkflowApi.getThread(threadId)

      setDetail(nextDetail)

      const nextComposer = actionableReply(nextDetail)

      setComposer(nextComposer)

      setSubject(nextComposer?.subject ?? "")

      setBody(nextComposer?.body ?? "")

      if (nextDetail.unread_count > 0) {
        await emailWorkflowApi.markThreadRead(threadId)

        setThreads((current) =>
          current.map((item) =>
            item.thread_id === threadId ? { ...item, unread_count: 0 } : item,
          ),
        )
      }
    } catch (cause) {
      setError(errorMessage(cause, "Could not load this conversation."))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (selectedThreadId) void loadDetail(selectedThreadId)
  }, [loadDetail, selectedThreadId])

  const hasInbound = useMemo(
    () =>
      detail?.messages.some(
        (message) =>
          message.direction === "Inbound" &&
          message.fetch_status !== "Pending" &&
          message.fetch_status !== "Fetching" &&
          message.fetch_status !== "FetchFailed",
      ),

    [detail],
  )
  const inboundRepliesEnabled =
    detail?.inbound_replies_enabled !== false &&
    !threads.some((thread) => thread.inbound_replies_enabled === false)

  const dirty =
    composer?.status === "Draft" &&
    (subject !== composer.subject || body !== composer.body)

  const replaceComposer = (draft: CandidateEmailDraft) => {
    const next = composerFromDraft(draft)

    setComposer(next)

    setSubject(next.subject)

    setBody(next.body)
  }

  const generate = async () => {
    if (!selectedThreadId || !hasInbound || !inboundRepliesEnabled || action)
      return

    setAction("generate")

    setError("")

    setSuccess("")

    try {
      const draft = await emailWorkflowApi.generateSmartReply(
        selectedThreadId,
        tone,
        intent,
        guidance,
      )

      replaceComposer(draft)

      setSuccess("Smart Reply drafted. HR review is required before sending.")

      await loadThreads()
    } catch (cause) {
      setError(errorMessage(cause, "Could not generate Smart Reply."))
    } finally {
      setAction(null)
    }
  }

  const generateBatch = async () => {
    if (batchSelection.length < 2 || !inboundRepliesEnabled || action) return
    setAction("batch")
    setError("")
    setSuccess("")
    try {
      const result = await emailWorkflowApi.generateSmartReplyBatch(
        batchSelection,
        tone,
        intent,
        guidance,
      )
      const skippedSummary = result.skipped.length
        ? ` (${result.skipped.map((item) => item.reason).join("; ")})`
        : ""
      setSuccess(
        `${result.drafts.length} drafted, ${result.skipped.length} skipped${skippedSummary}.`,
      )
      setBatchSelection([])
      await loadThreads()
      if (selectedThreadId) await loadDetail(selectedThreadId)
    } catch (cause) {
      setError(errorMessage(cause, "Could not generate batch Smart Replies."))
    } finally {
      setAction(null)
    }
  }

  const save = async () => {
    if (!composer || composer.status !== "Draft" || action) return null

    if (!subject.trim() || !body.trim()) {
      setError("Subject and reply body are required.")

      return null
    }

    setAction("save")

    setError("")

    setSuccess("")

    try {
      const draft = await emailWorkflowApi.update(
        composer.emailId,

        subject.trim(),

        body.trim(),
      )

      replaceComposer(draft)

      setSuccess("Smart Reply changes saved.")

      return draft
    } catch (cause) {
      setError(errorMessage(cause, "Could not save Smart Reply."))

      return null
    } finally {
      setAction(null)
    }
  }

  const approve = async () => {
    if (!composer || composer.status !== "Draft" || action) return

    setAction("approve")

    setError("")

    setSuccess("")

    try {
      let emailId = composer.emailId

      if (dirty) {
        const saved = await emailWorkflowApi.update(
          composer.emailId,

          subject.trim(),

          body.trim(),
        )

        emailId = saved.email_id
      }

      const approved = await emailWorkflowApi.approve(emailId)

      replaceComposer(approved)

      setSuccess("Smart Reply approved. It can now be sent by HR.")
    } catch (cause) {
      setError(errorMessage(cause, "Could not approve Smart Reply."))
    } finally {
      setAction(null)
    }
  }

  const send = async () => {
    if (
      !composer ||
      !["Approved", "Failed"].includes(composer.status) ||
      action
    ) {
      return
    }

    setAction("send")

    setError("")

    setSuccess("")

    try {
      const sent = await emailWorkflowApi.send(composer.emailId)

      replaceComposer(sent)

      setSuccess(`Reply sent to ${detail?.candidate_email ?? "candidate"}.`)

      if (selectedThreadId) await loadDetail(selectedThreadId)

      await loadThreads()
    } catch (cause) {
      setError(
        errorMessage(cause, "Reply delivery failed. Review and retry."),
      )

      if (selectedThreadId) await loadDetail(selectedThreadId)
    } finally {
      setAction(null)
    }
  }

  const reopen = async () => {
    if (!composer || composer.status !== "Failed" || action) return

    setAction("reopen")

    setError("")

    setSuccess("")

    try {
      const reopened = await emailWorkflowApi.reopen(composer.emailId)

      replaceComposer(reopened)

      setSuccess("Reply reopened. Review and approve it again before sending.")
    } catch (cause) {
      setError(errorMessage(cause, "Could not reopen this failed reply."))
    } finally {
      setAction(null)
    }
  }

  return (
    <section className="fc-card fc-card--pad" style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",

          alignItems: "flex-start",

          justifyContent: "space-between",

          gap: 14,

          marginBottom: 16,
        }}
      >
        <div>
          <div className="fc-eyebrow">Inbound conversations</div>
          <h2>Smart Reply Inbox</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Candidate replies are routed to their Job Applicant thread. AI only
            drafts; HR reviews, approves, and sends.
          </p>
        </div>
        <button
          type="button"
          className="fc-btn fc-btn--secondary"
          disabled={loading}
          onClick={() => void loadThreads()}
        >
          <RefreshCw size={14} />
          Refresh inbox
        </button>
      </div>

      {!inboundRepliesEnabled && (
        <div className="job-alert job-alert--error" role="alert">
          <AlertTriangle size={16} />
          <span>
            Inbound reply routing is disabled. Configure
            RESEND_INBOUND_DOMAIN before using Smart Reply.
          </span>
        </div>
      )}

      {error && (
        <div className="job-alert job-alert--error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="job-alert job-alert--success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="fc-panel" style={{ padding: 24 }}>
          Loading candidate conversations...
        </div>
      ) : threads.length === 0 ? (
        <div className="fc-panel" style={{ padding: 28, textAlign: "center" }}>
          <Mail size={30} style={{ marginBottom: 8 }} />
          <strong style={{ display: "block" }}>No email threads yet</strong>
          <p>
            Generate an outbound email for a Job Applicant to create its reply
            thread.
          </p>
        </div>
      ) : (
        <div className="smart-reply-grid">
          <div className="smart-reply-thread-list">
            {batchSelection.length >= 2 && (
              <div className="smart-reply-batch-bar" role="status">
                <div>
                  <UsersRound size={16} />
                  <strong>
                    {batchSelection.length} conversations selected
                  </strong>
                </div>
                <button
                  type="button"
                  className="fc-btn fc-btn--primary"
                  disabled={Boolean(action)}
                  onClick={() => void generateBatch()}
                >
                  <Sparkles size={14} />
                  {action === "batch"
                    ? "Drafting replies..."
                    : `Generate reply for ${batchSelection.length} conversations`}
                </button>
              </div>
            )}
            {threads.map((thread) => {
              const canBatch =
                inboundRepliesEnabled &&
                thread.last_inbound_at != null &&
                thread.has_fetched_inbound !== false
              return (
                <article
                  key={thread.thread_id}
                  className="fc-panel smart-reply-thread-row"
                  style={{
                    background:
                      selectedThreadId === thread.thread_id
                        ? "var(--accent-soft)"
                        : "var(--surface)",
                    borderColor:
                      selectedThreadId === thread.thread_id
                        ? "var(--accent)"
                        : "var(--border)",
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={!canBatch}
                    checked={batchSelection.includes(thread.thread_id)}
                    title={
                      canBatch
                        ? "Include in batch Smart Reply"
                        : "A verified inbound reply is required"
                    }
                    aria-label={`Select conversation with ${thread.candidate_name}`}
                    onChange={(event) =>
                      setBatchSelection((current) =>
                        event.target.checked
                          ? [...new Set([...current, thread.thread_id])]
                          : current.filter((id) => id !== thread.thread_id),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(thread.thread_id)}
                  >
                    <div>
                      <strong>{thread.candidate_name}</strong>
                      {thread.unread_count > 0 && (
                        <span className="fc-badge fc-badge--blue">
                          {thread.unread_count} new
                        </span>
                      )}
                    </div>
                    <p>
                      {thread.job_title} · {thread.current_stage}
                    </p>
                    <p>{thread.last_message_preview ?? "No messages yet"}</p>
                    <time>{formatDate(thread.last_inbound_at)}</time>
                  </button>
                </article>
              )
            })}
          </div>

          <div className="smart-reply-detail">
            {detailLoading || !detail ? (
              <div className="fc-panel" style={{ padding: 24 }}>
                Loading conversation...
              </div>
            ) : (
              <>
                <div className="fc-panel" style={{ padding: 16 }}>
                  <div
                    style={{
                      display: "flex",

                      justifyContent: "space-between",

                      gap: 12,

                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{detail.candidate_name}</strong>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {detail.candidate_email} · {detail.job_title}
                      </p>
                    </div>
                    {detail.reply_to_email && (
                      <span
                        className="fc-badge fc-badge--blue"
                        title={detail.reply_to_email}
                      >
                        Reply routing active
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="fc-panel"
                  style={{
                    padding: 16,

                    display: "grid",

                    gap: 10,

                    maxHeight: 430,

                    overflowY: "auto",
                  }}
                >
                  {detail.messages.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }}>
                      No messages in this thread.
                    </p>
                  ) : (
                    detail.messages.map((message) => (
                      <article
                        key={message.message_id}
                        style={{
                          justifySelf:
                            message.direction === "Inbound" ? "start" : "end",

                          width: "min(88%, 680px)",

                          padding: 13,

                          borderRadius: 12,

                          background:
                            message.direction === "Inbound"
                              ? "var(--surface-2)"
                              : "var(--accent-soft)",

                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",

                            alignItems: "center",

                            justifyContent: "space-between",

                            gap: 8,

                            marginBottom: 6,
                          }}
                        >
                          <strong
                            style={{
                              display: "flex",

                              alignItems: "center",

                              gap: 5,

                              fontSize: 12,
                            }}
                          >
                            {message.direction === "Inbound" ? (
                              <UserRound size={13} />
                            ) : (
                              <Bot size={13} />
                            )}
                            {message.direction}
                          </strong>
                          <span style={{ fontSize: 10.5 }}>
                            {message.delivery_status ?? message.status}
                          </span>
                        </div>
                        <strong style={{ fontSize: 12 }}>
                          {message.subject}
                        </strong>
                        <p
                          style={{
                            marginTop: 7,

                            whiteSpace: "pre-wrap",

                            fontSize: 12.5,
                          }}
                        >
                          {message.body}
                        </p>
                        {message.direction === "Inbound" &&
                          message.fetch_error && (
                            <p
                              style={{
                                color: "var(--danger)",
                                fontSize: 11,
                                marginTop: 6,
                              }}
                            >
                              Fetch failed: {message.fetch_error}
                            </p>
                          )}
                        <time
                          style={{ fontSize: 10.5, color: "var(--text-muted)" }}
                        >
                          {formatDate(message.occurred_at)}
                        </time>
                      </article>
                    ))
                  )}
                </div>

                <div className="fc-panel" style={{ padding: 16 }}>
                  {!hasInbound ? (
                    <div style={{ textAlign: "center", padding: 14 }}>
                      <strong style={{ display: "block" }}>
                        Waiting for candidate reply
                      </strong>
                      <p>
                        Smart Reply becomes available after a verified inbound
                        email arrives.
                      </p>
                    </div>
                  ) : composer ? (
                    <>
                      <div
                        style={{
                          display: "flex",

                          justifyContent: "space-between",

                          marginBottom: 12,
                        }}
                      >
                        <strong>HR review</strong>
                        <span className="fc-badge fc-badge--amber">
                          {composer.deliveryStatus ?? composer.status}
                        </span>
                      </div>
                      <label style={{ display: "block", marginBottom: 10 }}>
                        <span className="fc-field-label">Subject</span>
                        <input
                          className="fc-input"
                          value={subject}
                          readOnly={composer.status !== "Draft"}
                          maxLength={300}
                          onChange={(event) => setSubject(event.target.value)}
                        />
                      </label>
                      <label style={{ display: "block" }}>
                        <span className="fc-field-label">Reply body</span>
                        <textarea
                          className="fc-input"
                          value={body}
                          readOnly={composer.status !== "Draft"}
                          maxLength={30000}
                          style={{ minHeight: 180, lineHeight: 1.6 }}
                          onChange={(event) => setBody(event.target.value)}
                        />
                      </label>
                      <div
                        style={{
                          display: "flex",

                          gap: 8,

                          flexWrap: "wrap",

                          marginTop: 12,
                        }}
                      >
                        {composer.status === "Draft" && (
                          <>
                            <button
                              type="button"
                              className="fc-btn fc-btn--secondary"
                              disabled={!dirty || Boolean(action)}
                              onClick={() => void save()}
                            >
                              <Save size={14} />
                              {action === "save" ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="fc-btn fc-btn--primary"
                              disabled={
                                !subject.trim() ||
                                !body.trim() ||
                                Boolean(action)
                              }
                              onClick={() => void approve()}
                            >
                              <CheckCircle2 size={14} />
                              {action === "approve"
                                ? "Approving..."
                                : "Approve reply"}
                            </button>
                          </>
                        )}
                        {(composer.status === "Approved" ||
                          (composer.status === "Failed" &&
                            composer.retryable)) && (
                          <button
                            type="button"
                            className="fc-btn fc-btn--primary"
                            disabled={Boolean(action)}
                            onClick={() => void send()}
                          >
                            <Send size={14} />
                            {action === "send"
                              ? "Sending..."
                              : composer.status === "Failed"
                                ? "Retry reply"
                                : "Send approved reply"}
                          </button>
                        )}
                        {composer.status === "Failed" && (
                          <button
                            type="button"
                            className="fc-btn fc-btn--secondary"
                            disabled={Boolean(action)}
                            onClick={() => void reopen()}
                          >
                            <RefreshCw size={14} />
                            {action === "reopen"
                              ? "Reopening..."
                              : "Reopen for review"}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fc-section-title">
                        <Sparkles size={16} color="var(--accent)" />
                        <h3>Generate Smart Reply</h3>
                      </div>
                      <div
                        className="smart-reply-options"
                        style={{ marginTop: 12 }}
                      >
                        <label>
                          <span className="fc-field-label">Tone</span>
                          <select
                            className="fc-input"
                            value={tone}
                            onChange={(event) =>
                              setTone(event.target.value as SmartReplyTone)
                            }
                          >
                            <option value="professional">Professional</option>
                            <option value="warm">Warm</option>
                            <option value="concise">Concise</option>
                          </select>
                        </label>
                        <label>
                          <span className="fc-field-label">Reply purpose</span>
                          <select
                            className="fc-input"
                            value={intent}
                            onChange={(event) =>
                              setIntent(event.target.value as SmartReplyIntent)
                            }
                          >
                            <option value="general">General reply</option>
                            <option value="answer_question">
                              Answer a question
                            </option>
                            <option value="interview_details">
                              Share interview details
                            </option>
                            <option value="application_update">
                              Application update
                            </option>
                            <option value="rejection_follow_up">
                              Rejection follow-up
                            </option>
                          </select>
                        </label>
                        <label>
                          <span className="fc-field-label">
                            Candidate-visible details (optional)
                          </span>
                          <input
                            className="fc-input"
                            value={guidance}
                            maxLength={1000}
                            placeholder="Example: Interview Tue 19 Aug, 10:00 ICT; Google Meet link..."
                            onChange={(event) =>
                              setGuidance(event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="fc-btn fc-btn--primary"
                        style={{ marginTop: 12 }}
                        disabled={Boolean(action)}
                        onClick={() => void generate()}
                      >
                        <Sparkles size={14} />
                        {action === "generate"
                          ? "Drafting..."
                          : "Generate Smart Reply"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
