import { useRef, useState } from "react"

import {
  ArrowRight,
  CheckCircle,
  CloudArrowUp,
  Download,
  FileText,
  Lightning,
  MagnifyingGlass,
  Sparkle,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { authApi } from "@/api"
import { analyzerApi } from "@/api/analyzerApi"
import {
  buildCv,
  pdfBase64ToBlob,
  profileAvatarDataUrl,
  rebuildCv,
  thumbnailDataUrl,
} from "@/api/cvRebuildApi"
import type { CvBuildPayload } from "@/api/cvRebuildApi"
import type { CvRebuildResponse } from "@/types/cvRebuild"
import type { ScreenId } from "@/types/app"
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

interface CVReBuildScreenProps {
  onNavigate?: (screen: ScreenId) => void
}

export default function CVReBuildScreen({ onNavigate }: CVReBuildScreenProps) {
  const [state, setState] = useState<BuildState>(loadCachedResult)
  const [dragOver, setDragOver] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [useAvatar, setUseAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
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

  const handleSaveToHistory = async () => {
    if (state.phase !== "done" || saving) return

    setSaving(true)

    try {
      const blob = pdfBase64ToBlob(state.result.pdf_base64)

      const file = new File([blob], state.result.filename, {
        type: "application/pdf",
      })

      await analyzerApi.uploadCv(file)

      toast.success("Saved to CV History")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save this CV to history."

      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const pdfDataUrl =
    state.phase === "done"
      ? `data:application/pdf;base64,${state.result.pdf_base64}`
      : null

  return (
    <div className="cv-workspace">
      <style>{`
        .cv-workspace{max-width:1120px;margin:0 auto;padding:34px 28px 64px}.cv-workspace *{box-sizing:border-box}.cv-workspace__intro{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;margin-bottom:28px}.cv-workspace__eyebrow{display:flex;gap:8px;align-items:center;color:var(--accent);font:700 11px/1 var(--font-body);letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px}.cv-workspace__intro h1{margin:0;color:#111827;font-size:clamp(30px,4vw,42px);letter-spacing:-.045em;line-height:1.04}.cv-workspace__intro p{max-width:620px;margin:12px 0 0;color:var(--text-secondary);font-size:15px;line-height:1.65}.cv-workspace__signal{min-width:210px;border-left:1px solid var(--border);padding:8px 0 8px 22px}.cv-workspace__signal b{display:block;font-size:14px;color:var(--text-primary)}.cv-workspace__signal span{display:block;margin-top:5px;color:var(--text-muted);font-size:12px;line-height:1.45}.cv-workspace__routes{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:12px;margin-bottom:26px}.cv-route{border:1px solid var(--border);border-radius:14px;background:var(--surface);padding:16px;min-height:138px;text-align:left;color:inherit;box-shadow:none}.cv-route--main{background:#111827;border-color:#111827;color:white}.cv-route__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.cv-route__icon{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#f1f5ff;color:var(--accent)}.cv-route--main .cv-route__icon{background:rgba(255,255,255,.12);color:white}.cv-route h2{font:700 15px/1.25 var(--font-body);letter-spacing:-.015em;margin:0}.cv-route p{margin:6px 0 0;font-size:12px;line-height:1.45;color:var(--text-muted)}.cv-route--main p{color:#aeb8cb}.cv-route button{padding:0;border:0;background:transparent;color:inherit;cursor:pointer;font:600 12px/1 var(--font-body)}.cv-route button span{display:inline-flex;align-items:center;gap:6px}.cv-workspace__build{border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:22px;box-shadow:0 16px 42px -35px rgba(15,23,42,.28)}.cv-workspace__build-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.cv-workspace__build-head h2{margin:0;font:700 17px/1.3 var(--font-body);letter-spacing:-.02em}.cv-workspace__build-head p{margin:4px 0 0;color:var(--text-muted);font-size:12px}.cv-mode-tabs{display:inline-flex;gap:3px;padding:3px;border:1px solid var(--border);border-radius:10px;background:#f8fafc}.cv-mode-tabs button{padding:8px 12px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font:600 12px var(--font-body);cursor:pointer}.cv-mode-tabs button[aria-selected=true]{background:white;color:var(--text-primary);box-shadow:0 1px 3px rgba(15,23,42,.12)}.cv-upload-zone{border:1.5px dashed #cbd5e1!important;border-radius:14px!important;background:#fbfdff!important;padding:58px 24px!important;transition:border-color .18s ease,background .18s ease}.cv-upload-zone:hover{border-color:var(--accent)!important;background:var(--accent-soft)!important}.cv-upload-zone p:first-of-type{font-size:15px!important}.cv-upload-zone p:last-of-type{font-size:12px!important}.cv-workspace .cv-stage{border:1px solid var(--border)!important;border-radius:18px!important;box-shadow:0 16px 42px -35px rgba(15,23,42,.26)}@media(max-width:850px){.cv-workspace__routes{grid-template-columns:1fr 1fr}.cv-route--main{grid-column:span 2}.cv-workspace__signal{display:none}}@media(max-width:620px){.cv-workspace{padding:24px 16px 48px}.cv-workspace__intro{display:block}.cv-workspace__routes{grid-template-columns:1fr}.cv-route--main{grid-column:auto}.cv-workspace__build-head{align-items:flex-start;flex-direction:column}.cv-mode-tabs{width:100%}.cv-mode-tabs button{flex:1}}
      `}</style>
      <header className="cv-workspace__intro">
        <div>
          <div className="cv-workspace__eyebrow"><Sparkle size={14} weight="fill" /> Career workspace</div>
          <h1>Make your next CV<br />the strongest version.</h1>
          <p>Start with the document you have, turn it into a clean PDF, then compare it against a role when you are ready.</p>
        </div>
      </header>

      <section className="cv-workspace__build">
        <div className="cv-workspace__build-head">
          <div><h2>{state.phase === "done" ? "Your CV is ready" : "Build your CV"}</h2><p>{state.phase === "done" ? "Preview it, download it, or start a new version." : "Choose the fastest starting point for this version."}</p></div>
          {state.phase === "done" && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--success)", fontSize: 12, fontWeight: 700 }}><CheckCircle size={16} weight="fill" /> Ready</span>}
        </div>

      {state.phase === "idle" && (
        <div style={{ marginBottom: 22 }}>
          <div
            role="tablist"
            aria-label="CV build mode"
            className="cv-mode-tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={state.mode === "rebuild"}
              onClick={() => setState({ phase: "idle", mode: "rebuild" })}
            >
              Rebuild from file
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={state.mode === "build"}
              onClick={() => setState({ phase: "idle", mode: "build" })}
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
            className="cv-upload-zone"
            style={{
              borderColor: dragOver ? "var(--accent)" : undefined,
              background: dragOver ? "var(--accent-soft)" : undefined,
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
          className="cv-stage"
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
          className="cv-stage"
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

      {state.phase === "done" && state.result.warnings.length > 0 && (
        <div
          role="alert"
          style={{
            border: "1px solid #FDE68A",
            borderRadius: 12,
            background: "#FFFBEB",
            padding: "14px 18px",
            marginBottom: 16,
          }}
        >
          <p style={{ fontWeight: 600, color: "#92400E", fontSize: 14, marginBottom: 6 }}>
            Some content may need your review:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#92400E", fontSize: 13 }}>
            {state.result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {state.phase === "done" && (
        <div
          className="cv-stage"
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

                <button
                  type="button"
                  onClick={() => void handleSaveToHistory()}
                  disabled={saving}
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
                    cursor: saving ? "wait" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  <FloppyDisk size={16} weight="light" />
                  {saving ? "Saving…" : "Save to History"}
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
      </section>
    </div>
  )
}
