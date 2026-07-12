import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Briefcase, Eye, EyeOff, Lock, Mail, RotateCcw, User, Users, Zap } from 'lucide-react'
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
    options: { theme: 'outline'; size: 'large'; width: number; text: 'signin_with' | 'signup_with' },
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

  const resetFeedback = () => {
    setErrors({})
    setNotice('')
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
        theme: 'outline',
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
        ? 'Create account'
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        flex: '0 0 45%',
        background: 'linear-gradient(145deg, #4F46E5 0%, #7C3AED 50%, #6D28D9 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48, alignSelf: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)',
          }}>
            <Zap size={22} color="white" fill="white" />
          </div>
          <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, color: 'white' }}>FitCV</span>
        </div>

        <div style={{ width: 260, height: 260, position: 'relative', marginBottom: 40 }}>
          <svg viewBox="0 0 260 260" width="260" height="260">
            <circle cx="130" cy="130" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" />
            <circle cx="130" cy="130" r="90" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="16"
              strokeDasharray="452" strokeDashoffset="113" strokeLinecap="round"
              transform="rotate(-90 130 130)" />
            <text x="130" y="122" textAnchor="middle" fill="white" fontSize="32" fontWeight="800" fontFamily="Plus Jakarta Sans">78%</text>
            <text x="130" y="145" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="13" fontFamily="Inter">Match Score</text>
            <circle cx="50" cy="70" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="50" y="74" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">Skills</text>
            <circle cx="210" cy="70" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="210" y="74" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">Role</text>
            <circle cx="50" cy="195" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="50" y="199" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">CV</text>
            <circle cx="210" cy="195" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="210" y="199" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">HR</text>
          </svg>
        </div>

        <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'white', textAlign: 'center', lineHeight: 1.2, marginBottom: 12 }}>
          Know your fit<br />before you apply.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', lineHeight: 1.6, maxWidth: 320 }}>
          AI-powered CV screening with role-aware experiences for students, recruiters, hiring managers, and admins.
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 48, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          {step === 'auth' ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {mode === 'login' && <>Don&apos;t have an account? <button onClick={() => switchMode('register')} style={linkButtonStyle}>Sign up</button></>}
                  {mode === 'register' && <>Already have an account? <button onClick={() => switchMode('login')} style={linkButtonStyle}>Sign in</button></>}
                  {mode === 'forgot' && <>Remember your password? <button onClick={() => switchMode('login')} style={linkButtonStyle}>Back to sign in</button></>}
                  {mode === 'verify' && <>Enter the 6-digit verification code sent to {email || 'your email'}.</>}
                  {mode === 'reset' && <>Code verified. Choose a new password.</>}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>or</span>
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
                    placeholder="Enter 6-digit code"
                    error={errors.code}
                    onChange={value => setResetCode(value.replace(/\D/g, '').slice(0, 6))}
                  />
                )}

                {mode !== 'forgot' && mode !== 'verify' && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 40, borderColor: errors.password ? '#EF4444' : 'var(--border)' }}
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

                <button type="submit" className="fitcv-btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', fontSize: 15, opacity: loading ? 0.75 : 1 }}>
                  {loading ? 'Please wait...' : submitLabel} <ArrowRight size={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Choose your workspace</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>FitCV will save your database role and route you to the right portal after this step.</p>
              </div>

              {errors.general && <Feedback tone="error" message={errors.general} />}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {roleOptions.map(option => {
                  const active = selectedRole === option.role
                  return (
                    <button
                      key={option.role}
                      onClick={() => setSelectedRole(option.role)}
                      style={{
                        padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                        border: `2px solid ${active ? 'var(--indigo)' : 'var(--border)'}`,
                        background: active ? 'var(--indigo-light)' : 'white',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                        background: active ? 'var(--indigo)' : '#F3F4F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: active ? 'white' : 'var(--text-secondary)',
                      }}>
                        {option.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{option.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{option.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleRoleContinue}
                disabled={!selectedRole || loading}
                className="fitcv-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', fontSize: 15, marginTop: 24, opacity: selectedRole && !loading ? 1 : 0.45 }}
              >
                Continue <ArrowRight size={16} />
              </button>

              <button
                onClick={() => setStep('auth')}
                style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            </>
          )}

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 32 }}>
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
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor: error ? '#EF4444' : 'var(--border)' }}
        />
      </div>
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  )
}

function Feedback({ tone, message }: { tone: 'error' | 'success', message: string }) {
  const color = tone === 'error' ? '#991B1B' : '#065F46'
  const bg = tone === 'error' ? '#FEE2E2' : '#D1FAE5'
  return (
    <div style={{ background: bg, color, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
      {message}
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
  padding: '11px 12px 11px 38px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'Inter',
  color: 'var(--text-primary)',
  background: 'var(--bg)',
}

const errorTextStyle: CSSProperties = {
  color: '#DC2626',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 5,
}

const linkButtonStyle: CSSProperties = {
  color: 'var(--indigo)',
  fontWeight: 600,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
}

const googleButtonStyle: CSSProperties = {
  width: '100%',
  padding: '11px 20px',
  borderRadius: 10,
  border: '1px solid var(--border)',
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
