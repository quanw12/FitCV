import { useRef, useState } from "react"

import { CloudArrowUp, Download, FileText, X } from "@phosphor-icons/react"
import { toast } from "sonner"

import { authApi } from "@/api"
import {
  buildCv,
  pdfBase64ToBlob,
  profileAvatarDataUrl,
  rebuildCv,
  thumbnailDataUrl,
} from "@/api/cvRebuildApi"
import type { CvBuildPayload } from "@/api/cvRebuildApi"
import type { CvRebuildResponse } from "@/types/cvRebuild"
import CVBuildForm from "@/ui/components/CVBuildForm"

const ACCEPTED_TYPES =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const MAX_BYTES = 10 * 1024 * 1024

const CACHE_KEY = "fitcv:rebuild:last-result"

type BuildMode = "rebuild" | "build"

type CachedResult = { fileName: string; result: CvRebuildResponse }

type BuildState =
  | { phase: "idle"; mode: BuildMode }
  | { phase: "processing"; mode: BuildMode; file: File | null }
  | { phase: "done"; mode: BuildMode; file: File | null; result: CvRebuildResponse }
  | { phase: "error"; mode: BuildMode; file: File | null; message: string }

function loadCachedResult(): BuildState {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)

    if (!raw) return { phase: "idle", mode: "rebuild" }

    const cached = JSON.parse(raw) as CachedResult

    if (!cached?.result?.pdf_base64 || !cached.result.filename) {
      return { phase: "idle", mode: "rebuild" }
    }

    const fileName =
      cached.fileName || cached.result.filename || "rebuilt_cv.pdf"

    const file = new File([], fileName, { type: "application/pdf" })

    return { phase: "done", mode: "rebuild", file, result: cached.result }
  } catch {
    return { phase: "idle", mode: "rebuild" }
  }
}

function saveResult(file: File | null, result: CvRebuildResponse) {
  try {
    const payload: CachedResult = {
      fileName: file?.name || result.filename,
      result,
    }

    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Session storage may be full or unavailable; the result stays in memory.
  }
}

function clearSavedResult() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore storage errors; state still resets in memory.
  }
}

function isValidFile(file: File): string | null {
  if (!/\.(pdf|docx)$/i.test(file.name)) {
    return "Only PDF and DOCX files are supported."
  }

  if (file.size > MAX_BYTES) {
    return "CV file must be 10 MB or smaller."
  }

  return null
}

export default function CVReBuildScreen() {
  const [state, setState] = useState<BuildState>(loadCachedResult)
  const [dragOver, setDragOver] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [useAvatar, setUseAvatar] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const profileAvatarUrl = authApi.getSession()?.user.avatarUrl ?? null

  const runRebuild = async (file: File) => {
    const validationError = isValidFile(file)

    if (validationError) {
      setState({ phase: "idle", mode: "rebuild" })

      toast.error(validationError)

      return
    }

    setState({ phase: "processing", mode: "rebuild", file })

    clearSavedResult()

    try {
      const avatar = useAvatar
        ? await profileAvatarDataUrl(profileAvatarUrl)
        : undefined

      if (useAvatar && !avatar) {
        toast.warning("Couldn't load your profile avatar — building without it.")
      }

      const result = await rebuildCv(file, avatar ?? undefined)

      saveResult(file, result)

      setState({ phase: "done", mode: "rebuild", file, result })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Rebuild failed. Try again later."

      setState({ phase: "error", mode: "rebuild", file, message })

      toast.error(message)
    }
  }

  const runBuild = async (payload: CvBuildPayload) => {
    setState({ phase: "processing", mode: "build", file: null })

    clearSavedResult()

    try {
      const avatar = payload.avatar
        ? await profileAvatarDataUrl(payload.avatar)
        : undefined

      if (payload.avatar && !avatar) {
        toast.warning("Couldn't load your profile avatar — building without it.")
      }

      const result = await buildCv({ ...payload, avatar: avatar ?? undefined })

      saveResult(null, result)

      setState({ phase: "done", mode: "build", file: null, result })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Build failed. Try again later."

      setState({ phase: "error", mode: "build", file: null, message })

      toast.error(message)
    }
  }

  const handleReset = () => {
    clearSavedResult()

    setState({ phase: "idle", mode: "rebuild" })
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]

    if (file) void runRebuild(file)
  }

  const handleDownload = () => {
    if (state.phase !== "done") return

    const blob = pdfBase64ToBlob(state.result.pdf_base64)

    const url = URL.createObjectURL(blob)

    const anchor = document.createElement("a")

    anchor.href = url

    anchor.download = state.result.filename

    document.body.appendChild(anchor)

    anchor.click()

    anchor.remove()

    URL.revokeObjectURL(url)
  }

  const pdfDataUrl =
    state.phase === "done"
      ? `data:application/pdf;base64,${state.result.pdf_base64}`
      : null

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 56px" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        CV Build
      </h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
        Rebuild your existing CV with AI polishing, or build a fresh one from a
        form — then preview and download the rendered PDF.
      </p>

      {state.phase === "idle" && (
        <div style={{ marginBottom: 22 }}>
          <div
            role="tablist"
            aria-label="CV build mode"
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: "var(--border)",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={state.mode === "rebuild"}
              onClick={() => setState({ phase: "idle", mode: "rebuild" })}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "none",
                background: state.mode === "rebuild" ? "white" : "transparent",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: state.mode === "rebuild" ? "0 1px 4px rgba(15,23,42,0.12)" : "none",
              }}
            >
              Rebuild from file
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={state.mode === "build"}
              onClick={() => setState({ phase: "idle", mode: "build" })}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "none",
                background: state.mode === "build" ? "white" : "transparent",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: state.mode === "build" ? "0 1px 4px rgba(15,23,42,0.12)" : "none",
              }}
            >
              Build from form
            </button>
          </div>
        </div>
      )}

      {state.phase === "idle" && state.mode === "rebuild" && (
        <>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
              fontSize: 14,
              color: profileAvatarUrl
                ? "var(--text-primary)"
                : "var(--text-secondary)",
              cursor: profileAvatarUrl ? "pointer" : "not-allowed",
            }}
          >
            <input
              type="checkbox"
              data-testid="cv-rebuild-avatar"
              checked={useAvatar}
              disabled={!profileAvatarUrl}
              onChange={(event) => setUseAvatar(event.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "inherit" }}
            />
            Use my profile avatar on the CV
          </label>
          {!profileAvatarUrl && (
            <p style={{ marginBottom: 14, fontSize: 12, color: "var(--text-secondary)" }}>
              No profile avatar yet — add one in Profile to use it on your CV.
            </p>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                inputRef.current?.click()
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()

              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()

              setDragOver(false)

              handleFiles(event.dataTransfer.files)
            }}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 16,
              background: dragOver ? "color-mix(in srgb, var(--accent) 6%, white)" : "white",
              padding: "64px 24px",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <CloudArrowUp size={40} weight="light" color="var(--text-secondary)" />

            <p style={{ marginTop: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Drag and drop your CV here, or browse files
            </p>

            <p style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 13 }}>
              PDF or DOCX, up to 10 MB
            </p>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              aria-label="Upload your CV"
              data-testid="cv-rebuild-input"
              style={{ display: "none" }}
              onChange={(event) => {
                handleFiles(event.target.files)

                event.target.value = ""
              }}
            />
          </div>
        </>
      )}

      {state.phase === "idle" && state.mode === "build" && (
        <CVBuildForm
          avatarUrl={profileAvatarUrl}
          busy={false}
          onSubmit={(payload) => void runBuild(payload)}
        />
      )}

      {state.phase === "processing" && (
        <div
          aria-label="Building CV"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            background: "white",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div
              style={{
                width: 116,
                height: 164,
                borderRadius: 8,
                background:
                  "linear-gradient(100deg, #EEF2F7 40%, #F8FAFC 50%, #EEF2F7 60%)",
                backgroundSize: "200% 100%",
                animation: "fitcv-shimmer 1.4s infinite",
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {state.mode === "rebuild" ? "Rebuilding CV…" : "Building CV…"}{" "}
                {state.file && (
                  <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                    ({state.file.name})
                  </span>
                )}
              </p>

              <p
                style={{
                  marginTop: 8,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                {state.mode === "rebuild"
                  ? "Extracting details, polishing wording, and rendering the PDF. This usually takes a few seconds."
                  : "Polishing your information with AI and rendering the PDF. This usually takes a few seconds."}
              </p>

              <div
                style={{
                  marginTop: 16,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "45%",
                    height: "100%",
                    borderRadius: 999,
                    background: "var(--accent)",
                    animation: "fitcv-progress 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fitcv-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @keyframes fitcv-progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(320%); }
            }
          `}</style>
        </div>
      )}

      {state.phase === "error" && (
        <div
          style={{
            border: "1px solid #FECACA",
            borderRadius: 16,
            background: "#FEF2F2",
            padding: 20,
            textAlign: "center",
          }}
        >
          <p style={{ color: "#B91C1C", fontWeight: 600 }}>
            CV creation failed: {state.message}
          </p>

          <button
            type="button"
            onClick={handleReset}
            style={{
              marginTop: 14,
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text-primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            background: "white",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <img
              src={thumbnailDataUrl(state.result.thumbnail_base64)}
              alt="Built CV preview"
              role="img"
              onClick={() => setModalOpen(true)}
              style={{
                width: 150,
                borderRadius: 8,
                border: "1px solid var(--border)",
                cursor: "zoom-in",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
              }}
            />

            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                {state.result.preview_json.name || "Your built CV"}
              </h2>

              <p
                style={{
                  marginTop: 6,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                {state.result.preview_json.summary ||
                  "Your CV is ready. Click the preview to inspect the full document."}
              </p>

              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <FileText size={16} weight="light" /> View full CV
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Download size={16} weight="light" /> Download PDF
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              marginTop: 18,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create another CV
          </button>
        </div>
      )}

      {modalOpen && state.phase === "done" && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false)
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(880px, 100%)",
              height: "min(92vh, 100%)",
              background: "white",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                {state.result.preview_json.name || "Built CV"}
              </strong>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Download size={15} weight="light" /> Download PDF
                </button>

                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setModalOpen(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <iframe
              title="Built CV"
              src={pdfDataUrl ?? undefined}
              style={{ flex: 1, border: "none", width: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
