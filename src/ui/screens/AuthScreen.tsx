import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Briefcase, Eye, EyeOff, Lock, Mail, RotateCcw, User, Zap } from 'lucide-react'
import { authApi } from '@/api'
import { hasAuthErrors, validateEmail, validateLogin, validateRegister, validateResetPassword } from '@/services'
import type { AuthFormErrors, AuthMode, AuthSession } from '@/types/auth'
import type { Portal } from '@/types/app'

interface AuthScreenProps {
  onAuth: (session: AuthSession) => void
  startInRoleSelection?: boolean
}

const roleOptions: Array<{
  role: Portal
  title: string
  description: string
  icon: ReactNode
}> = [
  {
    role: 'seeker',
    title: 'I am a Job Seeker',
    description: 'Analyze CVs, track applications, improve job readiness',
    icon: <User size={22} />,
  },
  {
    role: 'hr',
    title: 'I am a Recruiter',
    description: 'Screen CVs, rank candidates, manage your pipeline',
    icon: <Briefcase size={22} />,
  },
]

export default function AuthScreen({ onAuth, startInRoleSelection = false }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [step, setStep] = useState<'auth' | 'role'>(startInRoleSelection ? 'role' : 'auth')
  const [showPass, setShowPass] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Portal | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [errors, setErrors] = useState<AuthFormErrors>({})
  const [notice, setNotice] = useState('')
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
        setNotice(response.resetToken ? `${response.message} Demo token: ${response.resetToken}` : response.message)
        if (response.resetToken) {
          setResetToken(response.resetToken)
          setMode('reset')
        }
      }

      if (mode === 'reset') {
        const nextErrors = validateResetPassword({ token: resetToken, password })
        if (hasAuthErrors(nextErrors)) {
          setErrors(nextErrors)
          return
        }
        await authApi.resetPassword({ token: resetToken, password })
        setNotice('Password reset successfully. Sign in with your new password.')
        setMode('login')
        setPassword('')
        setResetToken('')
      }
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : 'Authentication failed.' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    resetFeedback()
    try {
      setLoading(true)
      const oauthEmail = validateEmail(email) ? 'google.user@fitcv.dev' : email
      const oauthName = fullName.trim() || 'Google Demo User'
      finishAuth(await authApi.oauthLogin({
        provider: 'google',
        email: oauthEmail,
        fullName: oauthName,
      }))
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : 'Google login failed.' })
    } finally {
      setLoading(false)
    }
  }

  const handleRoleContinue = async () => {
    if (!selectedRole) return
    resetFeedback()
    try {
      setLoading(true)
      const session = await authApi.selectRole({ role: authApi.accountRoleFromPortal(selectedRole) })
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
          : 'Set new password'

  const submitLabel =
    mode === 'login'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Send reset link'
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
          AI-powered CV screening with role-aware experiences for students and recruiters.
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {step === 'auth' ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {mode === 'login' && <>Don&apos;t have an account? <button onClick={() => switchMode('register')} style={linkButtonStyle}>Sign up</button></>}
                  {mode === 'register' && <>Already have an account? <button onClick={() => switchMode('login')} style={linkButtonStyle}>Sign in</button></>}
                  {mode === 'forgot' && <>Remember your password? <button onClick={() => switchMode('login')} style={linkButtonStyle}>Back to sign in</button></>}
                  {mode === 'reset' && <>Paste the reset token and choose a new password.</>}
                </p>
              </div>

              {errors.general && <Feedback tone="error" message={errors.general} />}
              {notice && <Feedback tone="success" message={notice} />}

              {(mode === 'login' || mode === 'register') && (
                <>
                  <button onClick={handleGoogleLogin} disabled={loading} style={googleButtonStyle}>
                    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                    Continue with Google
                  </button>

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

                {mode === 'reset' && (
                  <Field
                    label="Reset token"
                    icon={<RotateCcw size={16} color="var(--text-muted)" />}
                    value={resetToken}
                    placeholder="Paste token from reset email"
                    error={errors.general}
                    onChange={setResetToken}
                  />
                )}

                {mode !== 'forgot' && (
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
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>FitCV will route you to the right portal after this step.</p>
              </div>

              {errors.general && <Feedback tone="error" message={errors.general} />}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {roleOptions.map(option => {
                  const active = selectedRole === option.role
                  return (
                    <button
                      key={option.role}
                      onClick={() => setSelectedRole(option.role)}
                      style={{
                        padding: '20px 20px', borderRadius: 16, cursor: 'pointer',
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
