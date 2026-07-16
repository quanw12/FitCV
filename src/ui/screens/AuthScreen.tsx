import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Briefcase, Eye, EyeOff, Lock, Mail, RotateCcw, User, Users, Zap, Sparkles, Check, Compass } from 'lucide-react'
import { authApi } from '@/api'
import { hasAuthErrors, validateEmail, validateLogin, validateRegister, validateResetPassword, validateVerifyResetCode } from '@/services'
import type { AccountRole, AuthFormErrors, AuthMode, AuthSession } from '@/types/auth'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_SCRIPT_ID = 'google-identity-services'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsId = {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
  renderButton: (
    element: HTMLElement,
    options: { theme: 'out_line'; size: 'large'; width: number; text: 'signin_with' | 'signup_with' },
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
}

const roleOptions: Array<{
  role: AccountRole
  title: string
  description: string
  icon: ReactNode
}> = [
  {
    role: 'Student',
    title: 'Student / Job Seeker',
    description: 'Analyze CVs, track applications, improve job readiness',
    icon: <User size={22} />,
  },
  {
    role: 'HR',
    title: 'HR / Recruiter',
    description: 'Screen CVs, rank candidates, and manage hiring workflows',
    icon: <Briefcase size={22} />,
  },
  {
    role: 'HiringManager',
    title: 'Hiring Manager',
    description: 'Review shortlisted candidates and support hiring decisions',
    icon: <Users size={22} />,
  },
  {
    role: 'Admin',
    title: 'System Admin',
    description: 'Manage platform access, users, and operational settings',
    icon: <Lock size={22} />,
  },
]

export default function AuthScreen({ onAuth, startInRoleSelection = false }: AuthScreenProps) {
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [step, setStep] = useState<'auth' | 'role'>(startInRoleSelection ? 'role' : 'auth')
  const [showPass, setShowPass] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AccountRole | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [errors, setErrors] = useState<AuthFormErrors>({})
  const [notice, setNotice] = useState('')
  const [googleError, setGoogleError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  const resetFeedback = () => {
    setErrors({})
    setNotice('')
  }

  const startDemo = (role: AccountRole) => {
    onAuth(authApi.createDemoSession(role))
  }

  const finishAuth = (session: AuthSession) => {
    if (session.requiresRoleSelection) {
      setStep('role')
      return
    }
    onAuth(session)
  }

  const handleGoogleCredential = async (credential?: string) => {
    resetFeedback()
    if (!credential) {
      setErrors({ general: 'Google did not return a sign-in credential.' })
      return
    }

    try {
      setLoading(true)
      finishAuth(await authApi.oauthLogin({ provider: 'google', credential }))
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : 'Google login failed.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (step !== 'auth' || (mode !== 'login' && mode !== 'register')) return

    if (!GOOGLE_CLIENT_ID) {
      setGoogleError('Google sign-in needs VITE_GOOGLE_CLIENT_ID.')
      return
    }

    let active = true

    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts.id || !googleButtonRef.current) return

      setGoogleError('')
      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: response => void handleGoogleCredential(response.credential),
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'out_line',
        size: 'large',
        width: googleButtonRef.current.clientWidth || 360,
        text: mode === 'register' ? 'signup_with' : 'signin_with',
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
      existingScript.addEventListener('load', renderGoogleButton, { once: true })
      return () => {
        active = false
        existingScript.removeEventListener('load', renderGoogleButton)
      }
    }

    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderGoogleButton
    script.onerror = () => {
      if (active) setGoogleError('Could not load Google sign-in.')
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

      if (mode === 'login') {
        const nextErrors = validateLogin({ email, password })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        finishAuth(await authApi.login({ email, password }))
      }

      if (mode === 'register') {
        const nextErrors = validateRegister({ email, password, fullName })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        finishAuth(await authApi.register({ email, password, fullName }))
      }

      if (mode === 'forgot') {
        const emailError = validateEmail(email)
        if (emailError) {
          setErrors({ email: emailError })
          return
        }
        const response = await authApi.forgotPassword({ email })
        setNotice(response.message)
        setResetCode('')
        setMode('verify')
      }

      if (mode === 'verify') {
        const nextErrors = validateVerifyResetCode({ email, code: resetCode })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        const response = await authApi.verifyResetCode({ email, code: resetCode })
        setNotice(response.message)
        setPassword('')
        setMode('reset')
      }

      if (mode === 'reset') {
        const nextErrors = validateResetPassword({ email, code: resetCode, password })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        await authApi.resetPassword({ email, code: resetCode, password })
        setNotice('Password reset successfully. Sign in with your new password.')
        setMode('login')
        setPassword('')
        setResetCode('')
      }
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : 'Authentication failed.' })
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
      setErrors({ general: error instanceof Error ? error.message : 'Role selection failed.' })
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    resetFeedback()
    setMode(nextMode)
  }

  const title =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'register'
        ? 'Create your account'
        : mode === 'forgot'
          ? 'Reset access'
          : mode === 'verify'
            ? 'Verify code'
            : 'Set new password'

  const submitLabel =
    mode === 'login'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Send verification code'
          : mode === 'verify'
            ? 'Verify code'
            : 'Reset password'

  const isAuthMode = mode === 'login' || mode === 'register'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Brand / editorial panel */}
      <div style={{
        flex: '0 0 44%',
        background: 'linear-gradient(155deg, #0B1020 0%, #161D33 55%, #1E2742 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '40px 46px', position: 'relative', overflow: 'hidden', color: 'white',
      }}>
        <div className="fc-glow" style={{ width: 380, height: 380, top: -120, right: -120, opacity: 0.9 }} />
        <div className="fc-glow" style={{ width: 260, height: 260, bottom: -90, left: -60, opacity: 0.7 }} />

        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div className="fc-brandmark" style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px var(--accent-glow)' }}>
            <Zap size={20} color="white" fill="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>FitCV</span>
        </div>

        {/* Editorial hero */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 22, color: '#c7cde0' }}>
            <Sparkles size={13} color="#a5b4fc" /> AI-powered talent intelligence
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 42, lineHeight: 1.08, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Know your fit<br />before you apply.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.66)', fontSize: 15.5, lineHeight: 1.65 }}>
            Match your CV against any job description, surface skill gaps, and rank candidates with explainable AI — built for students and recruiters alike.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26 }}>
            {[
              { label: 'Skills', tone: '#a5b4fc' },
              { label: 'Experience', tone: '#7dd3fc' },
              { label: 'Role fit', tone: '#fcd34d' },
              { label: 'Screening pass', tone: '#6ee7b7' },
            ].map(t => (
              <span key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 500, color: '#e2e8f4' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.tone }} /> {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Score signature */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg viewBox="0 0 120 120" width="92" height="92" style={{ filter: 'drop-shadow(0 8px 20px rgba(37,99,235,0.35))', transform: 'rotate(-8deg)' }}>
            <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="11" />
            <circle cx="60" cy="60" r="46" fill="none" stroke="url(#ag)" strokeWidth="11" strokeLinecap="round" strokeDasharray="289" strokeDashoffset="72" transform="rotate(-90 60 60)" />
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <text x="60" y="58" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="var(--font-display)">75</text>
            <text x="60" y="76" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="Inter">avg match</text>
          </svg>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 230 }}>
            Live AI scoring across <strong style={{ color: '#fff' }}>12,480</strong> CV–JD pairs this month.
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 48, overflowY: 'auto', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {step === 'auth' ? (
            <>
              {/* Segmented mode toggle */}
              {isAuthMode && (
                <div style={{ display: 'flex', padding: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, marginBottom: 26 }}>
                  {(['login', 'register'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                        fontSize: 14, fontWeight: 600,
                        background: mode === m ? 'var(--surface)' : 'transparent',
                        color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {m === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, minHeight: 20 }}>
                  {mode === 'login' && <>New here? <button onClick={() => switchMode('register')} style={linkButtonStyle}>Create an account</button></>}
                  {mode === 'register' && <>Already registered? <button onClick={() => switchMode('login')} style={linkButtonStyle}>Sign in</button></>}
                  {mode === 'forgot' && <>We will email a 6-digit code to {email || 'your inbox'}.</>}
                  {mode === 'verify' && <>Enter the 6-digit code sent to {email || 'your email'}.</>}
                  {mode === 'reset' && <>Code verified — choose a new password.</>}
                </p>
              </div>

              {errors.general && <Feedback tone="error" message={errors.general} />}
              {notice && <Feedback tone="success" message={notice} />}

              {(mode === 'login' || mode === 'register') && (
                <>
                  {GOOGLE_CLIENT_ID ? (
                    <div ref={googleButtonRef} style={googleButtonContainerStyle} />
                  ) : (
                    <button type="button" disabled style={{ ...googleButtonStyle, opacity: 0.6, cursor: 'not-allowed' }}>
                      Google sign-in is not configured
                    </button>
                  )}
                  {googleError && <div style={{ ...errorTextStyle, marginTop: -10, marginBottom: 12 }}>{googleError}</div>}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 20px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                </>
              )}

              <form onSubmit={handleAuthSubmit}>
                {mode === 'register' && (
                  <Field
                    label="Full name"
                    icon={<User size={16} color="var(--text-muted)" />}
                    value={fullName}
                    placeholder="Nguyen Minh"
                    error={errors.fullName}
                    onChange={setFullName}
                  />
                )}

                {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                  <Field
                    label="Email address"
                    icon={<Mail size={16} color="var(--text-muted)" />}
                    value={email}
                    type="email"
                    placeholder="you@example.com"
                    error={errors.email}
                    onChange={setEmail}
                  />
                )}

                {mode === 'verify' && (
                  <Field
                    label="Verification code"
                    icon={<RotateCcw size={16} color="var(--text-muted)" />}
                    value={resetCode}
                    placeholder="6-digit code"
                    error={errors.code}
                    onChange={value => setResetCode(value.replace(/\D/g, '').slice(0, 6))}
                  />
                )}

                {mode !== 'forgot' && mode !== 'verify' && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 42, borderColor: errors.password ? '#DC2626' : 'var(--border-strong)' }}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <div style={errorTextStyle}>{errors.password}</div>}
                  </div>
                )}

                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginBottom: 20 }}>
                    <button type="button" onClick={() => switchMode('forgot')} style={{ ...linkButtonStyle, fontSize: 13 }}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <button type="submit" className="fc-btn fc-btn--primary" disabled={loading} style={{ width: '100%', padding: '13px 20px', fontSize: 15 }}>
                  {loading ? 'Please wait…' : submitLabel} <ArrowRight size={16} />
                </button>
              </form>

              {/* Explore without backend toggle */}
              <div style={{ marginTop: 22 }}>
                {!demoOpen ? (
                  <button
                    onClick={() => setDemoOpen(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 11, border: '1px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13.5, fontWeight: 600 }}
                  >
                    <Compass size={15} /> Explore the product without an account
                  </button>
                ) : (
                  <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', animation: 'fc-pop 0.16s ease' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Preview a workspace</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button onClick={() => startDemo('Student')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '14px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={17} /></span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Job Seeker</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Analyze & improve CVs</span>
                      </button>
                      <button onClick={() => startDemo('HR')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '14px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={17} /></span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>HR Recruiter</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Rank & pipeline</span>
                      </button>
                    </div>
                    <button onClick={() => setDemoOpen(false)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', padding: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
                      <ArrowLeft size={13} /> Back to sign in
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 26 }}>
                <h2 style={{ fontSize: 25, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>Choose your workspace</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>FitCV saves your database role and routes you to the right portal.</p>
              </div>

              {errors.general && <Feedback tone="error" message={errors.general} />}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {roleOptions.map(option => {
                  const active = selectedRole === option.role
                  return (
                    <button
                      key={option.role}
                      onClick={() => setSelectedRole(option.role)}
                      style={{
                        padding: '16px 18px', borderRadius: 15, cursor: 'pointer',
                        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-soft)' : 'var(--surface)',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                        transition: 'all 0.15s', boxShadow: active ? 'var(--shadow-sm)' : 'none',
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                        background: active ? 'var(--accent)' : 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: active ? 'white' : 'var(--text-secondary)',
                      }}>
                        {option.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--text-primary)', marginBottom: 3 }}>{option.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{option.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleRoleContinue}
                disabled={!selectedRole || loading}
                className="fc-btn fc-btn--primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', fontSize: 15, marginTop: 22, opacity: selectedRole && !loading ? 1 : 0.5 }}
              >
                Continue <ArrowRight size={16} />
              </button>

              <button
                onClick={() => setStep('auth')}
                style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            </>
          )}

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 26 }}>
            By continuing, you agree to FitCV&apos;s Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  icon,
  value,
  placeholder,
  type = 'text',
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
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor: error ? '#DC2626' : 'var(--border-strong)' }}
        />
      </div>
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  )
}

function Feedback({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const color = tone === 'error' ? '#991B1B' : '#065F46'
  const bg = tone === 'error' ? '#FDEAEA' : '#DCFCE7'
  const icon = tone === 'error' ? <Lock size={15} /> : <Check size={15} />
  return (
    <div style={{ background: bg, color, borderRadius: 11, padding: '10px 13px', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}>
      {icon} {message}
    </div>
  )
}

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  display: 'block',
  marginBottom: 6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '11px 14px 11px 40px',
  borderRadius: 11,
  border: '1px solid var(--border-strong)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'var(--font-body)',
  color: 'var(--text-primary)',
  background: 'var(--surface)',
}

const errorTextStyle: CSSProperties = {
  color: '#DC2626',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 5,
}

const linkButtonStyle: CSSProperties = {
  color: 'var(--accent)',
  fontWeight: 600,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
}

const googleButtonStyle: CSSProperties = {
  width: '100%',
  padding: '11px 20px',
  borderRadius: 11,
  border: '1px solid var(--border-strong)',
  background: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  color: 'var(--text-primary)',
  marginBottom: 20,
}

const googleButtonContainerStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  marginBottom: 20,
}
