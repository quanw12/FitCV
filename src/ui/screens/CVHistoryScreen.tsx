import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Check,
  FileText,
  GitCompare,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"

import { analyzerApi } from "@/api/analyzerApi"
import type { CvVersion } from "@/types/analyzer"

const MAX_CV_BYTES = 10 * 1024 * 1024

export default function CVHistoryScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cvs, setCvs] = useState<CvVersion[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCvs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCvs(await analyzerApi.listCvs())
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load CV history.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCvs()
  }, [loadCvs])

  const uploadVersion = async (file?: File) => {
    if (!file) return
    const validationError = validateCv(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setUploading(true)
    setError(null)
    try {
      await analyzerApi.uploadCv(file)
      await loadCvs()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to upload this CV.",
      )
    } finally {
      setUploading(false)
    }
  }

  const deleteVersion = async (cv: CvVersion) => {
    if (!window.confirm(`Delete ${cv.fileName} and its saved match results?`))
      return
    setDeletingId(cv.cvId)
    setError(null)
    try {
      await analyzerApi.deleteCv(cv.cvId)
      setSelected((current) => current.filter((id) => id !== cv.cvId))
      await loadCvs()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete this CV.",
      )
    } finally {
      setDeletingId(null)
    }
  }

  const toggleSelect = (cvId: number) => {
    setSelected((current) => {
      if (current.includes(cvId)) return current.filter((id) => id !== cvId)
      return current.length < 2 ? [...current, cvId] : current
    })
  }

  const compareItems = cvs.filter((cv) => selected.includes(cv.cvId))

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            CV History
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Review every uploaded CV version and its parser status.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="fitcv-btn-secondary"
            onClick={() => void loadCvs()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            type="button"
            className="fitcv-btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={15} />
            {uploading ? "Uploading…" : "Upload new version"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onClick={(event) => {
              event.currentTarget.value = ""
            }}
            onChange={(event) => void uploadVersion(event.target.files?.[0])}
          />
        </div>
      </div>

      {error && (
        <div role="alert" style={alertStyle}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {selected.length === 1 && (
        <div style={selectionHintStyle}>
          Select one more CV to compare metadata.
        </div>
      )}

      {loading ? (
        <div className="fitcv-card" style={emptyStyle}>
          Loading CV history…
        </div>
      ) : cvs.length === 0 ? (
        <div className="fitcv-card" style={emptyStyle}>
          <FileText size={34} color="#94A3B8" />
          <strong>No CV versions yet</strong>
          <span>Upload a PDF or DOCX (max 10 MB) to create version 1.</span>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {cvs.map((cv) => {
            const isSelected = selected.includes(cv.cvId)
            return (
              <article
                key={cv.cvId}
                className="fitcv-card"
                style={{
                  padding: 20,
                  border: `2px solid ${
                    isSelected ? "#2563EB" : "var(--border)"
                  }`,
                  background: isSelected ? "#EFF6FF" : "white",
                  position: "relative",
                }}
              >
                {cv.isLatest && (
                  <span
                    className="badge-green"
                    style={{ position: "absolute", top: 12, right: 12 }}
                  >
                    Latest
                  </span>
                )}
                <div style={fileIconStyle}>
                  <FileText size={22} />
                </div>
                <div
                  title={cv.fileName}
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 6,
                    overflowWrap: "anywhere",
                    paddingRight: cv.isLatest ? 48 : 0,
                  }}
                >
                  {cv.fileName}
                </div>
                <div style={metadataStyle}>
                  Version {cv.versionNumber} · {cv.fileType} ·{" "}
                  {formatFileSize(cv.fileSizeKb)}
                </div>
                <div style={metadataStyle}>{formatDate(cv.uploadedAt)}</div>
                <div style={{ marginTop: 14 }}>
                  <StatusBadge cv={cv} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    className="fitcv-btn-secondary"
                    onClick={() => toggleSelect(cv.cvId)}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {isSelected ? (
                      <Check size={14} />
                    ) : (
                      <GitCompare size={14} />
                    )}
                    {isSelected ? "Selected" : "Compare"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${cv.fileName}`}
                    onClick={() => void deleteVersion(cv)}
                    disabled={deletingId === cv.cvId}
                    style={deleteButtonStyle}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {compareItems.length === 2 && (
        <div className="fitcv-card" style={{ padding: 24 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 16,
            }}
          >
            Version comparison
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 24,
            }}
          >
            {compareItems.map((cv) => (
              <div key={cv.cvId}>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {cv.fileName}
                </strong>
                <ComparisonRow label="Version" value={`v${cv.versionNumber}`} />
                <ComparisonRow
                  label="Uploaded"
                  value={formatDate(cv.uploadedAt)}
                />
                <ComparisonRow label="Type" value={cv.fileType} />
                <ComparisonRow
                  label="Size"
                  value={formatFileSize(cv.fileSizeKb)}
                />
                <ComparisonRow
                  label="Parser"
                  value={cv.parserVersion ?? "Pending"}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ cv }: { cv: CvVersion }) {
  const config = {
    Success: { label: "Parsed", color: "#166534", background: "#DCFCE7" },
    Failed: { label: "Parse failed", color: "#B91C1C", background: "#FEE2E2" },
    Processing: { label: "Parsing", color: "#1D4ED8", background: "#DBEAFE" },
    Pending: { label: "Queued", color: "#92400E", background: "#FEF3C7" },
  }[cv.parseStatus]
  return (
    <span
      title={cv.errorMessage ?? undefined}
      style={{
        display: "inline-flex",
        color: config.color,
        background: config.background,
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {config.label}
    </span>
  )
}

interface ComparisonRowProps {
  label: string
  value: string
}

function ComparisonRow({ label, value }: ComparisonRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        {label}
      </span>
      <span
        style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  )
}

function validateCv(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx"))
    return "Only PDF and DOCX CV files are supported."
  if (file.size === 0) return "The selected CV is empty."
  if (file.size > MAX_CV_BYTES) return "CV files must be 10 MB or smaller."
  return null
}

function formatFileSize(kilobytes: number | null) {
  if (kilobytes == null) return "Unknown size"
  return kilobytes >= 1024
    ? `${(kilobytes / 1024).toFixed(1)} MB`
    : `${kilobytes} KB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const alertStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#B91C1C",
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  borderRadius: 10,
  padding: "11px 14px",
  marginBottom: 16,
  fontSize: 13,
}
const selectionHintStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "#EFF6FF",
  borderRadius: 10,
  marginBottom: 14,
  fontSize: 13,
  color: "#1D4ED8",
  fontWeight: 600,
}
const emptyStyle: React.CSSProperties = {
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "var(--text-secondary)",
  textAlign: "center",
  padding: 24,
}
const fileIconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "#DBEAFE",
  color: "#2563EB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
}
const metadataStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
}
const deleteButtonStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#B91C1C",
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  borderRadius: 8,
  cursor: "pointer",
}
