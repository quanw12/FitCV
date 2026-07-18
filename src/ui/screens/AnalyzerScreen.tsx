import { useRef, useState } from "react"
import { AlertCircle, FileText, Trash2, Upload, Zap } from "lucide-react"

import { fitcvApi } from "@/api/fitcvApi"
import { getScoreTone } from "@/services/matchScore"
import type { AnalyzerDraftState, MatchAnalysis } from "@/types/analyzer"
import ScoreRing from "../components/ScoreRing"

const MAX_CV_BYTES = 10 * 1024 * 1024
const breakdownLabels = {
  skills: "Skills Match",
  experience: "Experience",
  education: "Education",
  soft_skills: "Soft Skills",
} as const

interface AnalyzerScreenProps {
  draft: AnalyzerDraftState
  setDraft: React.Dispatch<React.SetStateAction<AnalyzerDraftState>>
  onAnalysisComplete?: (matchResultId: string) => void
  onUploadCleared?: () => void
  onViewSuggestions?: () => void
}

export default function AnalyzerScreen({
  draft,
  setDraft,
  onAnalysisComplete,
  onUploadCleared,
  onViewSuggestions,
}: AnalyzerScreenProps) {
  const cvInputRef = useRef<HTMLInputElement>(null)
  const jdInputRef = useRef<HTMLInputElement>(null)
  const { cvFile, uploadedCvId, jdText, result } = draft
  const [cvDrag, setCvDrag] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState<string | null>(null)

  const selectCv = (file?: File) => {
    if (!file) return
    const validationError = validateCv(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setDraft((current) => ({
      ...current,
      cvFile: file,
      uploadedCvId: null,
      result: null,
    }))
    setError(null)
  }

  const clearUpload = async () => {
    if (loading || clearing) return
    setClearing(true)
    setError(null)
    try {
      if (uploadedCvId != null) await fitcvApi.deleteCv(uploadedCvId)
      if (cvInputRef.current) cvInputRef.current.value = ""
      setDraft((current) => ({
        ...current,
        cvFile: null,
        uploadedCvId: null,
        result: null,
      }))
      onUploadCleared?.()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to clear this CV upload.",
      )
    } finally {
      setClearing(false)
    }
  }

  const handleAnalyze = async () => {
    if (!cvFile) {
      setError("Choose a PDF or DOCX CV before analyzing.")
      return
    }
    if (jdText.trim().length < 50) {
      setError("Paste a job description with at least 50 characters.")
      return
    }

    setLoading(true)
    setError(null)
    setDraft((current) => ({ ...current, result: null }))
    try {
      let cvId = uploadedCvId
      if (cvId == null) {
        setProgress("Uploading CV…")
        const uploaded = await fitcvApi.uploadCv(cvFile)
        cvId = uploaded.cvId
        setDraft((current) => ({ ...current, uploadedCvId: cvId }))
        if (uploaded.parseStatus !== "Success") {
          setProgress("Parsing CV…")
          await waitForCv(cvId)
        }
      }

      setProgress("Extracting JD requirements…")
      let analysis = await fitcvApi.analyzeCv({
        cvId,
        jobDescription: jdText.trim(),
      })
      if (analysis.status !== "Success") {
        setProgress("Matching evidence…")
        analysis = await waitForMatch(analysis.matchResultId)
      }
      setDraft((current) => ({ ...current, result: analysis }))
      onAnalysisComplete?.(analysis.matchResultId)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to analyze this CV and job description.",
      )
    } finally {
      setLoading(false)
      setProgress("")
    }
  }

  const uploadJdText = async (file?: File) => {
    if (!file) return
    if (file.size > 1024 * 1024) {
      setError("JD text files must be 1 MB or smaller.")
      return
    }
    try {
      const text = await file.text()
      setDraft((current) => ({ ...current, jdText: text, result: null }))
      setError(null)
    } catch {
      setError("Unable to read this job-description text file.")
    }
  }

  const breakdowns = result
    ? Object.entries(breakdownLabels).flatMap(([key, label]) => {
        const evidence =
          result.breakdown[key as keyof MatchAnalysis["breakdown"]]
        return evidence ? [{ label, score: evidence.score }] : []
      })
    : []
  const skills = result?.breakdown.skills

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <h1>CV &amp; JD Match Analyzer</h1>
          <p>
            Upload your CV and compare it with a complete job description using
            grounded AI extraction and FitCV&apos;s evidence-based score.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="fc-card fc-card--pad fc-card--lift"
          onDragOver={(event) => {
            event.preventDefault()
            setCvDrag(true)
          }}
          onDragLeave={() => setCvDrag(false)}
          onDrop={(event) => {
            event.preventDefault()
            setCvDrag(false)
            selectCv(event.dataTransfer.files[0])
          }}
          style={{
            border: `2px dashed ${
              cvDrag
                ? "var(--accent)"
                : cvFile
                  ? "var(--success)"
                  : "var(--border-strong)"
            }`,
            background: cvDrag
              ? "var(--accent-soft)"
              : cvFile
                ? "var(--success-soft)"
                : "var(--surface)",
            minHeight: 220,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onClick={(event) => {
              event.currentTarget.value = ""
            }}
            onChange={(event) => selectCv(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={loading || clearing}
            onClick={() => cvInputRef.current?.click()}
            style={{
              width: "100%",
              minHeight: 150,
              border: 0,
              background: "transparent",
              cursor: loading || clearing ? "not-allowed" : "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-primary)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: cvFile
                  ? "var(--success-soft)"
                  : "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              {cvFile ? (
                <FileText size={26} color="var(--success)" />
              ) : (
                <Upload size={24} color="var(--accent)" />
              )}
            </div>
            <strong style={{ fontSize: 15, marginBottom: 6 }}>
              {cvFile ? cvFile.name : "Upload your CV"}
            </strong>
            <span
              style={{
                fontSize: 13,
                color: cvFile ? "var(--success)" : "var(--text-secondary)",
                fontWeight: cvFile ? 600 : 400,
                textAlign: "center",
              }}
            >
              {cvFile
                ? `Ready · ${formatFileSize(cvFile.size)}`
                : "Drag and drop or browse files"}
            </span>
            <small style={{ marginTop: 5, color: "var(--text-muted)" }}>
              {cvFile ? "Choose a different file" : "PDF or DOCX · max 10 MB"}
            </small>
          </button>
          {cvFile && (
            <button
              type="button"
              className="fc-btn fc-btn--ghost"
              disabled={loading || clearing}
              onClick={() => void clearUpload()}
              style={{ padding: "7px 12px", fontSize: 12 }}
            >
              <Trash2 size={14} aria-hidden="true" />
              {clearing ? "Clearing…" : "Clear upload"}
            </button>
          )}
        </div>

        <div
          className="fc-card fc-card--pad"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <label
              htmlFor="analyzer-jd-text"
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
              }}
            >
              Job Description
            </label>
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              disabled={loading}
              onClick={() => jdInputRef.current?.click()}
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <Upload size={12} /> Upload text
            </button>
            <input
              ref={jdInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              onClick={(event) => {
                event.currentTarget.value = ""
              }}
              onChange={(event) =>
                void uploadJdText(event.target.files?.[0])
              }
            />
          </div>
          <textarea
            id="analyzer-jd-text"
            className="fc-input"
            value={jdText}
            onChange={(event) => {
              const value = event.target.value
              setDraft((current) => ({
                ...current,
                jdText: value,
                result: null,
              }))
            }}
            placeholder="Paste the complete job description here…"
            style={{
              flex: 1,
              minHeight: 160,
              resize: "vertical",
              padding: 14,
              fontSize: 13,
              background: "var(--surface-2)",
              lineHeight: 1.6,
            }}
          />
          <div
            style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}
          >
            {jdText.trim()
              ? `${jdText.trim().split(/\s+/).length} words`
              : "Include requirements and preferred qualifications for better matching."}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "12px 14px",
            marginBottom: 16,
            borderRadius: 10,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </div>
      )}

      <div
        aria-live="polite"
        style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}
      >
        <button
          className="fc-btn fc-btn--primary"
          onClick={() => void handleAnalyze()}
          disabled={loading || clearing}
          style={{ padding: "14px 40px", fontSize: 16, gap: 10 }}
        >
          {loading ? (
            <>
              <Spinner /> {progress || "Analyzing…"}
            </>
          ) : (
            <>
              <Zap size={18} fill="white" /> Analyze match
            </>
          )}
        </button>
      </div>

      {result?.status === "Success" && result.overallScore != null && (
        <div aria-live="polite">
          <div
            className="fc-card fc-card--pad"
            style={{
              marginBottom: 16,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="fc-glow"
              style={{ width: 240, height: 240, top: -80, right: -60 }}
            />
            <div
              style={{
                textAlign: "center",
                marginBottom: 24,
                position: "relative",
                zIndex: 1,
              }}
            >
              <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
                Analysis Results
              </div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {result.title}
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 40,
                flexWrap: "wrap",
                position: "relative",
                zIndex: 1,
              }}
            >
              <ScoreRing
                score={result.overallScore}
                size={160}
                strokeWidth={14}
                label={result.matchLabel ?? "Overall Match"}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                {breakdowns.map((item) => {
                  const tone = getScoreTone(item.score)
                  return (
                    <div
                      key={item.label}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: tone.color,
                          }}
                        >
                          {Math.round(item.score)}%
                        </span>
                      </div>
                      <div className="fc-progress">
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, item.score))}%`,
                            background: tone.color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {result.passProbability != null && (
            <div
              className="fc-card fc-card--pad"
              style={{
                marginBottom: 16,
                background: "var(--warning-soft)",
                border: "1px solid #fde9cf",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "#fff",
                    border: "1px solid #fde9cf",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertCircle size={24} color="var(--warning)" />
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "var(--text-primary)",
                      marginBottom: 4,
                    }}
                  >
                    Estimated screening alignment: {Math.round(result.passProbability)}%
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      marginBottom: 10,
                    }}
                  >
                    {result.disclaimer}
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      height: 10,
                      borderRadius: 5,
                      background:
                        "linear-gradient(to right, #EF4444, #F59E0B, #10B981)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: `calc(${Math.min(100, Math.max(0, result.passProbability))}% - 2px)`,
                        top: -3,
                        width: 4,
                        height: 16,
                        background: "#1F2937",
                        borderRadius: 2,
                        boxShadow: "0 0 0 2px white",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="fc-card fc-card--pad">
            <div className="fc-section-title" style={{ marginBottom: 14 }}>
              <h3>Skills Assessment</h3>
            </div>
            <SkillTags
              title="Matched Skills"
              values={skills?.matched ?? []}
              className="fc-badge fc-badge--green"
              prefix="✓"
              empty="No explicit skill matches found."
            />
            <SkillTags
              title="Missing Skills"
              values={skills?.missing ?? []}
              className="fc-badge fc-badge--amber"
              prefix="⚠"
              empty="No explicit skill gaps found."
            />
            {result.suggestions.length > 0 && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="fc-eyebrow" style={{ marginBottom: 8 }}>
                  Prioritized Next Steps
                </div>
                <ul
                  style={{
                    paddingLeft: 20,
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  {result.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            {onViewSuggestions && (
              <button
                className="fc-btn fc-btn--primary"
                onClick={onViewSuggestions}
                style={{ marginTop: 18 }}
              >
                View improvement suggestions
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

async function waitForCv(cvId: number) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const cv = await fitcvApi.getCv(cvId)
    if (cv.parseStatus === "Success") return cv
    if (cv.parseStatus === "Failed")
      throw new Error(cv.errorMessage ?? "CV parsing failed.")
    await delay(500)
  }
  throw new Error(
    "CV parsing is taking longer than expected. Please retry shortly.",
  )
}

async function waitForMatch(matchResultId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const match = await fitcvApi.getMatchResult(matchResultId)
    if (match.status === "Success") return match
    if (match.status === "Failed")
      throw new Error(match.errorMessage ?? "CV/JD matching failed.")
    await delay(500)
  }
  throw new Error(
    "Matching is taking longer than expected. Please retry shortly.",
  )
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function validateCv(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx"))
    return "Only PDF and DOCX CV files are supported."
  if (file.size === 0) return "The selected CV is empty."
  if (file.size > MAX_CV_BYTES) return "CV files must be 10 MB or smaller."
  return null
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3" />
      <path d="M12 3a9 9 0 019 9" strokeLinecap="round" />
    </svg>
  )
}

function SkillTags({
  title,
  values,
  className,
  prefix,
  empty,
}: {
  title: string
  values: string[]
  className: string
  prefix: string
  empty: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="fc-eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {values.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {values.map((value) => (
            <span key={value} className={className}>
              {prefix} {value}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{empty}</div>
      )}
    </div>
  )
}
