import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  CaretLeft,
  CaretRight,
  Briefcase,
  Eye,
  EyeClosed,
  Lock,
  Envelope,
  ArrowClockwise,
  User,
  Check,
} from "@phosphor-icons/react"
import { authApi } from "@/api"
import BrandMark from "@/ui/components/BrandMark"
import {
  hasAuthErrors,
  validateEmail,
  validateLogin,
  validateRegister,
  validateResetPassword,
  validateVerifyResetCode,
} from "@/services"
import type {
  AccountRole,
  AuthFormErrors,
  AuthMode,
  AuthSession,
} from "@/types/auth"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
const GOOGLE_SCRIPT_ID = "google-identity-services"

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }) => void
  renderButton: (
    element: HTMLElement,
    options: {
      theme: "out_line"
      size: "large"
      width: number
      text: "signin_with" | "signup_with"
    },
  ) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId
      }
    }
  }
}

interface AuthScreenProps {
  onAuth: (session: AuthSession) => void
  startInRoleSelection?: boolean
  onBackToLanding?: () => void
}

const roleOptions: Array<{
  role: AccountRole
  title: string
  description: string
  icon: ReactNode
}> = [
  {
    role: "Student",
    title: "Student / Job Seeker",
    description: "Analyze CVs, track applications, improve job readiness",
    icon: <User size={22} />,
  },
  {
    role: "HR",
    title: "HR / Recruiter",
    description: "Screen CVs, rank candidates, and manage hiring workflows",
    icon: <Briefcase size={22} />,
  },
]

const authCss = `
  .fitcv-auth { min-height: 100vh; background: #f8fafc; color: #101828; font-family: var(--font-body, Geist, system-ui, sans-serif); }
  .fitcv-auth *, .fitcv-auth *::before, .fitcv-auth *::after { box-sizing: border-box; }
  .auth-shell { --auth-accent: #2563eb; --auth-accent-soft: #eff6ff; position: relative; display: grid; min-height: 100vh; place-items: center; overflow: hidden; isolation: isolate; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }.auth-shell--register { --auth-accent: #c25a05; --auth-accent-soft: #fff7ed; }.auth-shell--forgot, .auth-shell--verify, .auth-shell--reset { --auth-accent: #7c3aed; --auth-accent-soft: #f5f3ff; }.auth-shell--role { --auth-accent: #047857; --auth-accent-soft: #ecfdf5; }
  .auth-shell::before { position: absolute; z-index: -1; width: min(72vw, 760px); height: min(72vw, 760px); border: 1px solid rgba(148,163,184,.17); border-radius: 50%; content: ""; transform: translate(43vw, -42vh); }.auth-shell::after { position: absolute; z-index: -1; width: 42vw; height: 42vw; min-width: 440px; min-height: 440px; border-radius: 50%; background: var(--auth-accent-soft); content: ""; filter: blur(4px); opacity: .58; transform: translate(-42vw, 44vh); transition: background .32s ease; }
  .auth-hero { display: none; }
  .auth-panel { display: grid; width: 100%; min-height: 100vh; place-items: center; padding: 48px 24px; }.auth-content { width: min(100%, 438px); animation: auth-card-enter .28s cubic-bezier(.2,.8,.2,1) both; }.auth-brand { margin-bottom: 25px !important; text-align: center !important; }.auth-brand > div { margin-bottom: 7px !important; justify-content: center; }.auth-brand > div > span { letter-spacing: -.05em !important; }.auth-brand > div + div { color: #667085 !important; }
  .auth-card { position: relative; overflow: hidden; border: 1px solid #e4e7ec !important; border-radius: 20px !important; background: rgba(255,255,255,.94) !important; padding: 30px !important; box-shadow: 0 22px 54px -38px rgba(16,24,40,.28) !important; }.auth-card::before { position: absolute; inset: 0 0 auto; height: 2px; background: var(--auth-accent); content: ""; transition: background .28s ease; }.auth-card input { transition: border-color .16s ease, box-shadow .16s ease; }.auth-card input:focus { border-color: var(--auth-accent) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--auth-accent) 14%, transparent); }.auth-card .fc-btn--primary { border-radius: 10px; background: var(--auth-accent) !important; box-shadow: none; transition: transform .18s ease, background .28s ease; }.auth-card .fc-btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--auth-accent) 88%, #000) !important; transform: translateY(-1px); }.auth-card .fc-btn--primary:disabled { transform: none; }.auth-mode-tab.is-active.login { background: #eff6ff !important; color: #1d4ed8 !important; }.auth-mode-tab.is-active.register { background: #fff7ed !important; color: #b45309 !important; }
  @keyframes auth-card-enter { from { opacity: .18; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @media (max-width: 480px) { .auth-panel { padding: 34px 16px; }.auth-card { padding: 23px !important; border-radius: 17px !important; }.auth-shell::after { min-width: 340px; min-height: 340px; } }
  @media (prefers-reduced-motion: reduce) { .fitcv-auth *, .fitcv-auth *::before, .fitcv-auth *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; } }
`

export default function AuthScreen({
  onAuth,
  startInRoleSelection = false,
  onBackToLanding,
}: AuthScreenProps) {
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<AuthMode>("login")
  const [step, setStep] = useState<"auth" | "role">(
    startInRoleSelection ? "role" : "auth",
  )
  const [showPass, setShowPass] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AccountRole | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [errors, setErrors] = useState<AuthFormErrors>({})
  const [notice, setNotice] = useState("")
  const [googleError, setGoogleError] = useState("")
  const [loading, setLoading] = useState(false)

  const resetFeedback = () => {
    setErrors({})
    setNotice("")
  }

  const transitionToMode = (nextMode: AuthMode) => {
    setMode(nextMode)
  }

  const finishAuth = (session: AuthSession) => {
    if (session.requiresRoleSelection) {
      setStep("role")
      return
    }
    onAuth(session)
  }

  const handleGoogleCredential = async (credential?: string) => {
    resetFeedback()
    if (!credential) {
      setErrors({ general: "Google did not return a sign-in credential." })
      return
    }

    try {
      setLoading(true)
      finishAuth(await authApi.oauthLogin({ provider: "google", credential }))
    } catch (error) {
      setErrors({
        general:
          error instanceof Error ? error.message : "Google login failed.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (step !== "auth" || (mode !== "login" && mode !== "register")) return

    if (!GOOGLE_CLIENT_ID) {
      setGoogleError("Google sign-in needs VITE_GOOGLE_CLIENT_ID.")
      return
    }

    let active = true

    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts.id || !googleButtonRef.current)
        return

      setGoogleError("")
      googleButtonRef.current.innerHTML = ""
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) =>
          void handleGoogleCredential(response.credential),
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "out_line",
        size: "large",
        width: googleButtonRef.current.clientWidth || 360,
        text: mode === "register" ? "signup_with" : "signin_with",
      })
    }

    if (window.google?.accounts.id) {
      renderGoogleButton()
      return () => {
        active = false
      }
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton, {
        once: true,
      })
      return () => {
        active = false
        existingScript.removeEventListener("load", renderGoogleButton)
      }
    }

    const script = document.createElement("script")
    script.id = GOOGLE_SCRIPT_ID
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = renderGoogleButton
    script.onerror = () => {
      if (active) setGoogleError("Could not load Google sign-in.")
    }
    document.head.appendChild(script)

    return () => {
      active = false
    }
  }, [mode, step])

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault()
    resetFeedback()

    try {
      setLoading(true)

      if (mode === "login") {
        const nextErrors = validateLogin({ email, password })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        finishAuth(await authApi.login({ email, password }))
      }

      if (mode === "register") {
        const nextErrors = validateRegister({ email, password, fullName })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        finishAuth(await authApi.register({ email, password, fullName }))
      }

      if (mode === "forgot") {
        const emailError = validateEmail(email)
        if (emailError) {
          setErrors({ email: emailError })
          return
        }
        const response = await authApi.forgotPassword({ email })
        setNotice(response.message)
        setResetCode("")
        transitionToMode("verify")
      }

      if (mode === "verify") {
        const nextErrors = validateVerifyResetCode({ email, code: resetCode })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        const response = await authApi.verifyResetCode({
          email,
          code: resetCode,
        })
        setNotice(response.message)
        setPassword("")
        transitionToMode("reset")
      }

      if (mode === "reset") {
        const nextErrors = validateResetPassword({
          email,
          code: resetCode,
          password,
        })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        await authApi.resetPassword({ email, code: resetCode, password })
        setNotice(
          "Password reset successfully. Sign in with your new password.",
        )
        transitionToMode("login")
        setPassword("")
        setResetCode("")
      }
    } catch (error) {
      setErrors({
        general:
          error instanceof Error ? error.message : "Authentication failed.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRoleContinue = async () => {
    if (!selectedRole) return
    resetFeedback()
    try {
      setLoading(true)
      const session = await authApi.selectRole({ role: selectedRole })
      onAuth(session)
    } catch (error) {
      setErrors({
        general:
          error instanceof Error ? error.message : "Role selection failed.",
      })
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    resetFeedback()
    transitionToMode(nextMode)
  }

  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "register"
        ? "Create your account"
        : mode === "forgot"
          ? "Reset access"
          : mode === "verify"
            ? "Verify code"
            : "Set new password"

  const submitLabel =
    mode === "login"
      ? "Sign in"
      : mode === "register"
        ? "Create account"
        : mode === "forgot"
          ? "Send verification code"
          : mode === "verify"
            ? "Verify code"
            : "Reset password"

  const isAuthMode = mode === "login" || mode === "register"
  const screenPhase = step === "role" ? "role" : mode

  return (
    <div className="fitcv-auth">
      <style>{authCss}</style>
      <div className={`auth-shell auth-shell--${screenPhase}`}>
        <main className="auth-panel">
          <div key={`${step}-${mode}`} className="auth-content">
        <div className="auth-brand" style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <BrandMark size={38} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 21,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              FitCV
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            AI-powered talent intelligence
          </div>
        </div>

        {onBackToLanding && (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={onBackToLanding}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 0",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              <CaretLeft size={13} weight="bold" /> Back to home
            </button>
          </div>
        )}

        <div
          className="fc-glass auth-card"
          style={{
            borderRadius: "var(--r-lg)",
            padding: 32,
          }}
        >
          {step === "auth" ? (
            <>
              {isAuthMode && (
                <div
                  style={{
                    display: "flex",
                    padding: 3,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    marginBottom: 24,
                  }}
                >
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`auth-mode-tab ${m} ${mode === m ? "is-active" : ""}`}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 9,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13.5,
                        fontWeight: 600,
                        background:
                          mode === m ? "var(--surface)" : "transparent",
                        color:
                          mode === m
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        boxShadow:
                          mode === m ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {m === "login" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 13.5,
                    minHeight: 18,
                  }}
                >
                  {mode === "login" && (
                    <>
                      New here?{" "}
                      <button
                        onClick={() => switchMode("register")}
                        style={linkBtn}
                      >
                        Create an account
                      </button>
                    </>
                  )}
                  {mode === "register" && (
                    <>
                      Already registered?{" "}
                      <button
                        onClick={() => switchMode("login")}
                        style={linkBtn}
                      >
                        Sign in
                      </button>
                    </>
                  )}
                  {mode === "forgot" && <>We&apos;ll email a 6-digit code.</>}
                  {mode === "verify" && (
                    <>Enter the code sent to {email || "your email"}.</>
                  )}
                  {mode === "reset" && (
                    <>Code verified — choose a new password.</>
                  )}
                </p>
              </div>

              {errors.general && (
                <Feedback tone="error" message={errors.general} />
              )}
              {notice && <Feedback tone="success" message={notice} />}

              {(mode === "login" || mode === "register") && (
                <>
                  {GOOGLE_CLIENT_ID ? (
                    <div ref={googleButtonRef} style={googleBoxStyle} />
                  ) : (
                    <button
                      type="button"
                      disabled
                      style={{
                        ...googleBtnStyle,
                        opacity: 0.6,
                        cursor: "not-allowed",
                        justifyContent: "center",
                      }}
                    >
                      Google sign-in is not configured
                    </button>
                  )}
                  {googleError && (
                    <div
                      style={{
                        ...errTxt,
                        marginTop: -12,
                        marginBottom: 12,
                        textAlign: "center",
                      }}
                    >
                      {googleError}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "0 0 18px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "var(--border)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                      }}
                    >
                      OR
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "var(--border)",
                      }}
                    />
                  </div>
                </>
              )}

              <form onSubmit={handleAuthSubmit}>
                {mode === "register" && (
                  <Field
                    label="Full name"
                    icon={
                      <User
                        size={15}
                        weight="light"
                        color="var(--text-muted)"
                      />
                    }
                    value={fullName}
                    placeholder="Nguyen Minh"
                    error={errors.fullName}
                    onChange={setFullName}
                  />
                )}

                {(mode === "login" ||
                  mode === "register" ||
                  mode === "forgot") && (
                  <Field
                    label="Email address"
                    icon={
                      <Envelope
                        size={15}
                        weight="light"
                        color="var(--text-muted)"
                      />
                    }
                    value={email}
                    type="email"
                    placeholder="you@example.com"
                    error={errors.email}
                    onChange={setEmail}
                  />
                )}

                {mode === "verify" && (
                  <Field
                    label="Verification code"
                    icon={
                      <ArrowClockwise
                        size={15}
                        weight="light"
                        color="var(--text-muted)"
                      />
                    }
                    value={resetCode}
                    placeholder="6-digit code"
                    error={errors.code}
                    onChange={(value) =>
                      setResetCode(value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                )}

                {mode !== "forgot" && mode !== "verify" && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={lbl}>Password</label>
                    <div style={{ position: "relative" }}>
                      <Lock
                        size={15}
                        weight="light"
                        color="var(--text-muted)"
                        style={{
                          position: "absolute",
                          left: 13,
                          top: "50%",
                          transform: "translateY(-50%)",
                          zIndex: 1,
                        }}
                      />
                      <input
                        aria-label="Password"
                        type={showPass ? "text" : "password"}
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                          ...inp,
                          borderColor: errors.password
                            ? "#DC2626"
                            : "var(--border-strong)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        style={{
                          position: "absolute",
                          right: 11,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          lineHeight: 0,
                        }}
                      >
                        {showPass ? (
                          <EyeClosed size={16} weight="light" />
                        ) : (
                          <Eye size={16} weight="light" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <div style={errTxt}>{errors.password}</div>
                    )}
                  </div>
                )}

                {mode === "login" && (
                  <div style={{ textAlign: "right", marginBottom: 18 }}>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      style={{ ...linkBtn, fontSize: 12.5 }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="fc-btn fc-btn--primary"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    fontSize: 14.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    "Please wait…"
                  ) : (
                    <>
                      {submitLabel} <CaretRight size={14} weight="bold" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 21,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  Choose your workspace
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>
                  FitCV saves your role and routes you to the right portal.
                </p>
              </div>

              {errors.general && (
                <Feedback tone="error" message={errors.general} />
              )}

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {roleOptions.map((option) => {
                  const active = selectedRole === option.role
                  return (
                    <button
                      key={option.role}
                      onClick={() => setSelectedRole(option.role)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        cursor: "pointer",
                        border: `2px solid ${
                          active ? "var(--accent)" : "var(--border)"
                        }`,
                        background: active
                          ? "var(--accent-soft)"
                          : "var(--surface)",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        transition: "all 0.15s",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          flexShrink: 0,
                          background: active
                            ? "var(--accent)"
                            : "var(--surface-2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: active ? "white" : "var(--text-secondary)",
                        }}
                      >
                        {option.icon}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14.5,
                            color: "var(--text-primary)",
                            marginBottom: 2,
                          }}
                        >
                          {option.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {option.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleRoleContinue}
                disabled={!selectedRole || loading}
                className="fc-btn fc-btn--primary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "12px 20px",
                  fontSize: 14.5,
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: selectedRole && !loading ? 1 : 0.5,
                }}
              >
                Continue <CaretRight size={14} weight="bold" />
              </button>

              <button
                onClick={() => setStep("auth")}
                style={{
                  width: "100%",
                  marginTop: 10,
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: 13.5,
                  cursor: "pointer",
                  padding: 8,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CaretLeft size={13} weight="bold" /> Back
              </button>
            </>
          )}

          <p
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 11.5,
              marginTop: 24,
            }}
          >
            By continuing, you agree to FitCV&apos;s Terms of Service and
            Privacy Policy
          </p>
        </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function Field({
  label,
  icon,
  value,
  placeholder,
  type = "text",
  error,
  onChange,
}: {
  label: string
  icon: ReactNode
  value: string
  placeholder: string
  type?: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 13,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1,
          }}
        >
          {icon}
        </span>
        <input
          aria-label={label}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inp,
            borderColor: error ? "#DC2626" : "var(--border-strong)",
          }}
        />
      </div>
      {error && <div style={errTxt}>{error}</div>}
    </div>
  )
}

function Feedback({
  tone,
  message,
}: {
  tone: "error" | "success"
  message: string
}) {
  const color = tone === "error" ? "#991B1B" : "#065F46"
  const bg = tone === "error" ? "#FDEAEA" : "#DCFCE7"
  const icon =
    tone === "error" ? (
      <Lock size={14} weight="light" />
    ) : (
      <Check size={14} weight="bold" />
    )
  return (
    <div
      style={{
        background: bg,
        color,
        borderRadius: 10,
        padding: "9px 12px",
        fontSize: 12.5,
        fontWeight: 600,
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon} {message}
    </div>
  )
}

const lbl: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-primary)",
  display: "block",
  marginBottom: 5,
}

const inp: CSSProperties = {
  width: "100%",
  padding: "10px 14px 10px 38px",
  borderRadius: 10,
  border: "1px solid var(--border-strong)",
  fontSize: 13.5,
  outline: "none",
  fontFamily: "var(--font-body)",
  color: "var(--text-primary)",
  background: "var(--surface)",
}

const errTxt: CSSProperties = {
  color: "#DC2626",
  fontSize: 11.5,
  fontWeight: 600,
  marginTop: 4,
}

const linkBtn: CSSProperties = {
  color: "var(--accent)",
  fontWeight: 600,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 13.5,
}

const googleBtnStyle: CSSProperties = {
  width: "100%",
  padding: "10px 20px",
  borderRadius: 10,
  border: "1px solid var(--border-strong)",
  background: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  color: "var(--text-primary)",
  marginBottom: 18,
}

const googleBoxStyle: CSSProperties = {
  width: "100%",
  minHeight: 40,
  marginBottom: 18,
}
