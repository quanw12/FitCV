import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react"

import {
  WarningCircle,
  Buildings,
  CheckCircle,
  Spinner,
  Image,
  FloppyDisk,
  TrashSimple,
  UploadSimple,
  UserCircle,
} from "@phosphor-icons/react"

import { authApi, profileApi } from "@/api"

import type { AuthSession } from "@/types/auth"

import type { ProfileUpdate, UserProfile } from "@/types/profile"

interface ProfileScreenProps {
  session: AuthSession

  onSessionChange: (session: AuthSession) => void

  companyOnboarding?: boolean

  onProfileSaved?: (profile: UserProfile) => void
}

interface FormState {
  fullName: string

  phone: string

  companyName: string

  industryName: string

  companyWebsiteUrl: string

  companyLogoUrl: string
}

const blank: FormState = {
  fullName: "",

  phone: "",

  companyName: "",

  industryName: "",

  companyWebsiteUrl: "",

  companyLogoUrl: "",
}

const inputStyle = {
  width: "100%",

  boxSizing: "border-box" as const,

  border: "1px solid var(--border)",

  borderRadius: 10,

  padding: "10px 12px",

  font: "inherit",

  color: "var(--text-primary)",

  background: "white",

  outlineColor: "var(--accent)",
}

function formFrom(profile: UserProfile): FormState {
  return {
    fullName: profile.fullName,

    phone: profile.phone ?? "",

    companyName: profile.company?.companyName ?? "",

    industryName: profile.company?.industryName ?? "",

    companyWebsiteUrl: profile.company?.websiteUrl ?? "",

    companyLogoUrl: profile.company?.logoUrl ?? "",
  }
}

function Field({
  label,

  value,

  onChange,

  placeholder,

  type = "text",

  maxLength,

  minLength,

  required,
}: {
  label: string

  value: string

  onChange: (value: string) => void

  placeholder?: string

  type?: string

  maxLength?: number

  minLength?: number

  required?: boolean
}) {
  return (
    <label
      className="fitcv-profile-field"
    >
      {label}
      <input
        aria-label={label}
        style={inputStyle}
        type={type}
        value={value}
        maxLength={maxLength}
        minLength={minLength}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export default function ProfileScreen({
  session,

  onSessionChange,

  companyOnboarding = false,

  onProfileSaved,
}: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [form, setForm] = useState<FormState>(blank)

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [success, setSuccess] = useState("")

  const [avatarBusy, setAvatarBusy] = useState(false)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [avatarFile, setAvatarFile] = useState<{
    name: string
    size: number
  } | null>(null)

  const [avatarBroken, setAvatarBroken] = useState(false)

  const [dragging, setDragging] = useState(false)

  const fileInput = useRef<HTMLInputElement>(null)

  const isStudent = session.user.role === "Student"

  const hasCompanyRole =
    session.user.role === "HR" ||
    session.user.role === "HiringManager" ||
    session.user.role === "Admin"

  const initials = useMemo(
    () =>
      (form.fullName || session.user.email)

        .split(/\s+/)

        .map((part) => part[0])

        .join("")

        .slice(0, 2)

        .toUpperCase(),

    [form.fullName, session.user.email],
  )

  useEffect(() => {
    let active = true

    profileApi

      .get()

      .then((value) => {
        if (active) {
          setProfile(value)

          setForm(formFrom(value))

          setError("")
        }
      })

      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load profile.",
          )
      })

      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    },
    [avatarPreview],
  )

  const set = (key: keyof FormState) => (value: string) => {
    setSuccess("")

    setForm((current) => ({ ...current, [key]: value }))
  }

  const optional = (value: string) => value.trim() || null

  async function submit(event: FormEvent) {
    event.preventDefault()

    setError("")

    setSuccess("")

    if (form.fullName.trim().length < 2) {
      setError("Full name must be at least 2 characters.")

      return
    }

    if (
      hasCompanyRole &&
      (!form.companyName.trim() || !form.industryName.trim())
    ) {
      setError("Company name and industry are required.")

      return
    }

    setSaving(true)

    const update: ProfileUpdate = {
      fullName: form.fullName.trim(),

      ...(isStudent ? { phone: optional(form.phone) } : {}),

      ...(hasCompanyRole
        ? {
            companyName: optional(form.companyName),

            industryName: optional(form.industryName),

            companyWebsiteUrl: optional(form.companyWebsiteUrl),

            companyLogoUrl: optional(form.companyLogoUrl),
          }
        : {}),
    }

    try {
      const saved = await profileApi.update(update)

      setProfile(saved)

      setForm(formFrom(saved))

      const nextSession = authApi.getSession()

      if (nextSession) onSessionChange(nextSession)

      onProfileSaved?.(saved)

      setSuccess("Profile saved successfully.")
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save profile.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function chooseAvatar(file?: File) {
    if (!file) return

    setError("")

    setSuccess("")

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarPreview(null)

      setAvatarFile(null)

      setError("Choose a JPG, PNG, or WebP image.")

      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarPreview(null)

      setAvatarFile(null)

      setError("Avatar must be 5MB or smaller.")

      return
    }

    const preview = URL.createObjectURL(file)

    setAvatarPreview(preview)

    setAvatarFile({ name: file.name, size: file.size })

    setAvatarBroken(false)

    setAvatarBusy(true)

    try {
      const saved = await profileApi.uploadAvatar(file)

      setProfile(saved)

      setAvatarPreview(null)

      setAvatarFile(null)

      setAvatarBroken(false)

      const nextSession = authApi.getSession()

      if (nextSession) onSessionChange(nextSession)

      setSuccess("Profile photo updated.")
    } catch (reason) {
      setAvatarPreview(null)

      setAvatarFile(null)

      setError(
        reason instanceof Error ? reason.message : "Unable to upload photo.",
      )
    } finally {
      setAvatarBusy(false)

      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function removeAvatar() {
    setError("")

    setSuccess("")

    setAvatarBusy(true)

    try {
      const saved = await profileApi.deleteAvatar()

      setProfile(saved)

      setAvatarPreview(null)

      setAvatarFile(null)

      setAvatarBroken(false)

      const nextSession = authApi.getSession()

      if (nextSession) onSessionChange(nextSession)

      setSuccess("Profile photo removed.")
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to remove photo.",
      )
    } finally {
      setAvatarBusy(false)
    }
  }

  const avatarSrc = avatarPreview ?? profile?.avatarUrl ?? null

  if (loading)
    return (
      <div
        style={{
          minHeight: 300,

          display: "grid",

          placeItems: "center",

          color: "var(--text-muted)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Spinner className="fitcv-spin" size={20} weight="light" /> Loading
          profile...
        </span>
      </div>
    )

  return (
    <div className="fitcv-profile-workspace">
      <style>{`.fitcv-profile-workspace{max-width:1120px;margin:0 auto;padding:34px 28px 64px}.fitcv-profile-workspace *{box-sizing:border-box}.fitcv-profile-grid{display:grid;grid-template-columns:292px minmax(0,1fr);gap:30px;align-items:start}.fitcv-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fitcv-profile-sidebar{display:grid;align-content:start;gap:14px;position:sticky;top:18px}.fitcv-profile-card{border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:22px;box-shadow:0 12px 36px -34px rgba(15,23,42,.32)}.fitcv-profile-main{display:grid;gap:16px}.fitcv-profile-section{border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:22px;box-shadow:0 12px 36px -34px rgba(15,23,42,.24)}.fitcv-profile-section h2{margin:0 0 18px;font:700 16px/1.35 var(--font-body);letter-spacing:-.02em}.fitcv-profile-field{display:grid;gap:7px;font-size:12px;font-weight:650;color:var(--text-secondary)}.fitcv-profile-field input{border-radius:9px!important;padding:11px 12px!important;transition:border-color .16s ease,box-shadow .16s ease}.fitcv-profile-field input:focus{border-color:var(--accent)!important;box-shadow:0 0 0 3px var(--accent-soft)}.fitcv-profile-kicker{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--accent);font-size:11px;font-weight:750;letter-spacing:.11em;text-transform:uppercase}.fitcv-profile-heading h1{font-size:34px!important;letter-spacing:-.045em}.fitcv-profile-heading p{max-width:540px;font-size:14px!important;line-height:1.6}.fitcv-profile-account dt{margin-top:12px;color:var(--text-muted);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.fitcv-profile-account dd{margin:3px 0 0;color:var(--text-primary);font-size:13px;word-break:break-word}.fitcv-profile-actions{display:flex;justify-content:flex-end;padding-top:4px}.fitcv-profile-actions button{border-radius:10px!important;padding:11px 16px!important;box-shadow:none!important}.fitcv-avatar-shell{border:1px solid #dbeafe!important;border-radius:50%!important;background:linear-gradient(145deg,#2563eb,#0f172a)!important}.fitcv-upload-zone{border-radius:12px!important;background:#fbfdff!important}.fitcv-profile-empty{border-left:2px solid var(--accent)}@keyframes fitcv-spin{to{transform:rotate(360deg)}}.fitcv-spin{animation:fitcv-spin 1s linear infinite}@media(max-width:820px){.fitcv-profile-grid{grid-template-columns:1fr}.fitcv-profile-sidebar{position:static;grid-template-columns:1fr 1fr}.fitcv-profile-heading h1{font-size:29px!important}}@media(max-width:620px){.fitcv-profile-workspace{padding:24px 16px 48px}.fitcv-form-grid,.fitcv-profile-sidebar{grid-template-columns:1fr}.fitcv-profile-section,.fitcv-profile-card{padding:18px}}`}</style>
      <div className="fitcv-profile-heading" style={{ marginBottom: 28 }}>
        <div className="fitcv-profile-heading-copy">
          <div className="fitcv-profile-kicker"><UserCircle size={14} weight="fill" /> Account workspace</div>
          <h1 style={{ margin: 0, fontSize: 26, color: "var(--text-primary)" }}>
            {companyOnboarding
              ? "Complete your company profile"
              : "Profile settings"}
          </h1>
          <p
            style={{
              margin: "7px 0 0",

              color: "var(--text-muted)",

              fontSize: 14,
            }}
          >
            {companyOnboarding
              ? "Add your company details before entering the hiring workspace."
              : "Keep your professional information accurate and ready for work."}
          </p>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",

            gap: 9,

            padding: 12,

            marginBottom: 16,

            borderRadius: 10,

            background: "#FEF2F2",

            color: "#B91C1C",
          }}
        >
          <WarningCircle size={18} weight="light" />
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          style={{
            display: "flex",

            gap: 9,

            padding: 12,

            marginBottom: 16,

            borderRadius: 10,

            background: "#F0FDF4",

            color: "#15803D",
          }}
        >
          <CheckCircle size={18} weight="light" />
          {success}
        </div>
      )}
      <form onSubmit={submit} className="fitcv-profile-grid">
        <aside className="fitcv-profile-sidebar">
          <section
            className="fitcv-profile-card"
            style={{
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 88,

                height: 88,

                borderRadius: "50%",

                margin: "0 auto 14px",

                overflow: "hidden",

                display: "grid",

                placeItems: "center",

                position: "relative",

                background: "linear-gradient(135deg,#4F46E5,#7C3AED)",

                color: "white",

                fontSize: 24,

                fontWeight: 800,
              }}
              className="fitcv-avatar-shell"
            >
              {initials}
              {avatarSrc && !avatarBroken && (
                <img
                  key={avatarSrc}
                  src={avatarSrc}
                  alt="Profile avatar preview"
                  onError={() => {
                    setAvatarBroken(true)
                  }}
                  style={{
                    position: "absolute",

                    inset: 0,

                    width: "100%",

                    height: "100%",

                    objectFit: "cover",
                  }}
                />
              )}
            </div>
            <strong style={{ display: "block", color: "var(--text-primary)" }}>
              {form.fullName || "Your name"}
            </strong>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {session.user.role}
            </span>
          </section>
          <section
            className="fitcv-profile-card fitcv-profile-account"
          >
            <div
              style={{
                display: "flex",

                gap: 8,

                alignItems: "center",

                marginBottom: 12,
              }}
            >
              <UserCircle size={17} weight="light" />
              <strong>Account</strong>
            </div>
            <dl style={{ margin: 0 }}>
            {[
              ["Email", profile?.email],

              ["Account ID", profile?.accountId],

              ["Sign-in method", profile?.authProvider],

              [
                "Created",

                profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : null,
              ],
            ].map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value ?? "Not available"}</dd></div>
            ))}
            </dl>
          </section>
        </aside>
        <div className="fitcv-profile-main">
          <section className="fitcv-profile-section">
            <h2>Profile details</h2>
            <div className="fitcv-form-grid">
              <Field
                label="Full name"
                value={form.fullName}
                onChange={set("fullName")}
                minLength={2}
                maxLength={150}
                required
              />
              {isStudent && (
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={set("phone")}
                  maxLength={30}
                  placeholder="+1 555 0123"
                />
              )}
            </div>
          </section>
          {hasCompanyRole && (
            <section className="fitcv-profile-section">
              <h2
                style={{
                  fontSize: 17,
                  margin: "0 0 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Buildings size={18} weight="light" /> Company details
              </h2>
              <div className="fitcv-form-grid">
                <Field
                  label="Company name"
                  value={form.companyName}
                  onChange={set("companyName")}
                  maxLength={200}
                  required
                  placeholder="FitCV Technologies"
                />
                <Field
                  label="Industry"
                  value={form.industryName}
                  onChange={set("industryName")}
                  maxLength={100}
                  required
                  placeholder="Information Technology"
                />
                <Field
                  label="Company website"
                  value={form.companyWebsiteUrl}
                  onChange={set("companyWebsiteUrl")}
                  type="url"
                  maxLength={300}
                  placeholder="https://example.com"
                />
                <Field
                  label="Company logo URL"
                  value={form.companyLogoUrl}
                  onChange={set("companyLogoUrl")}
                  type="url"
                  maxLength={400}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </section>
          )}
          <section className="fitcv-profile-section">
            <h2
              style={{
                fontSize: 17,

                margin: "0 0 18px",

                display: "flex",

                gap: 8,

                alignItems: "center",
              }}
            >
              <Image size={18} weight="light" /> Profile photo
            </h2>
            <div
              className="fitcv-upload-zone"
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault()
                setDragging(false)
                void chooseAvatar(event.dataTransfer.files[0])
              }}
              style={{
                border: `1px dashed ${
                  dragging ? "var(--accent)" : "var(--border)"
                }`,
                borderRadius: 12,
                padding: 16,
                background: dragging ? "var(--accent-soft)" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 240px" }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: 7,
                  }}
                >
                  Drag and drop an image here, or choose one from your device.
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  JPG, PNG or WebP - maximum 5MB
                </div>
                {avatarFile && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      marginTop: 7,
                      wordBreak: "break-word",
                    }}
                  >
                    {avatarFile.name} -{" "}
                    {(avatarFile.size / 1024 / 1024).toFixed(2)}MB
                  </div>
                )}
              </div>
              <input
                ref={fileInput}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void chooseAvatar(event.target.files?.[0])}
              />
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => fileInput.current?.click()}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  background: "white",
                  padding: "9px 12px",
                  display: "flex",
                  gap: 7,
                  alignItems: "center",
                  cursor: avatarBusy ? "wait" : "pointer",
                  fontWeight: 650,
                  color: "var(--text-primary)",
                }}
              >
                {avatarBusy ? (
                  <Spinner className="fitcv-spin" size={16} weight="light" />
                ) : (
                  <UploadSimple size={16} weight="light" />
                )}{" "}
                {avatarBusy ? "Uploading..." : "Choose photo"}
              </button>
              {(profile?.avatarUrl || avatarPreview) && (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => void removeAvatar()}
                  aria-label="Remove profile photo"
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#DC2626",
                    padding: 8,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    cursor: avatarBusy ? "wait" : "pointer",
                    fontWeight: 650,
                  }}
                >
                  <TrashSimple size={16} weight="light" /> Remove
                </button>
              )}
            </div>
          </section>
          <div className="fitcv-profile-actions">
            <button
              disabled={
                saving ||
                form.fullName.trim().length < 2 ||
                (hasCompanyRole &&
                  (!form.companyName.trim() || !form.industryName.trim()))
              }
              type="submit"
              style={{
                border: 0,

                borderRadius: 10,

                padding: "11px 18px",

                background: "var(--accent)",

                color: "white",

                display: "flex",

                gap: 8,

                alignItems: "center",

                fontWeight: 700,

                cursor: saving ? "wait" : "pointer",

                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <Spinner className="fitcv-spin" size={17} weight="light" />
              ) : (
                <FloppyDisk size={17} weight="light" />
              )}
              {saving
                ? "Saving..."
                : companyOnboarding
                  ? "Continue to workspace"
                  : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
