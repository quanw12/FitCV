import { useState } from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, User, Briefcase } from 'lucide-react'

type Tab = 'login' | 'register'
type Role = 'seeker' | 'hr' | null

interface AuthScreenProps {
  onAuth: (role: 'seeker' | 'hr') => void
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  const [tab, setTab] = useState<Tab>('login')
  const [step, setStep] = useState<'auth' | 'role'>('auth')
  const [showPass, setShowPass] = useState(false)
  const [role, setRole] = useState<Role>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStep('role')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{
        flex: '0 0 45%',
        background: 'linear-gradient(145deg, #4F46E5 0%, #7C3AED 50%, #6D28D9 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', top: '30%', left: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48, alignSelf: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <Zap size={22} color="white" fill="white" />
          </div>
          <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, color: 'white' }}>FitCV</span>
        </div>

        {/* Illustration placeholder — geometric AI graphic */}
        <div style={{ width: 260, height: 260, position: 'relative', marginBottom: 40 }}>
          {/* Central score ring */}
          <svg viewBox="0 0 260 260" width="260" height="260">
            <circle cx="130" cy="130" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" />
            <circle cx="130" cy="130" r="90" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="16"
              strokeDasharray="452" strokeDashoffset="113" strokeLinecap="round"
              transform="rotate(-90 130 130)" />
            <text x="130" y="122" textAnchor="middle" fill="white" fontSize="32" fontWeight="800" fontFamily="Plus Jakarta Sans">78%</text>
            <text x="130" y="145" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="13" fontFamily="Inter">Match Score</text>

            {/* Small orbiting badges */}
            <circle cx="50" cy="70" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="50" y="67" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">Skills</text>
            <text x="50" y="80" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="Inter" fontWeight="700">92%</text>

            <circle cx="210" cy="70" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="210" y="67" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">Exp.</text>
            <text x="210" y="80" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="Inter" fontWeight="700">65%</text>

            <circle cx="50" cy="195" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="50" y="192" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">Edu.</text>
            <text x="50" y="205" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="Inter" fontWeight="700">80%</text>

            <circle cx="210" cy="195" r="28" fill="rgba(255,255,255,0.12)" />
            <text x="210" y="192" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" fontWeight="600">Soft</text>
            <text x="210" y="205" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="Inter" fontWeight="700">71%</text>
          </svg>
        </div>

        <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'white', textAlign: 'center', lineHeight: 1.2, marginBottom: 12 }}>
          Know your fit<br />before you apply.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', lineHeight: 1.6, maxWidth: 320 }}>
          AI-powered CV screening that tells you exactly where you stand — and how to get ahead.
        </p>

        {/* Feature dots */}
        <div style={{ display: 'flex', gap: 20, marginTop: 32 }}>
          {['CV Analysis', 'Smart Tips', 'Job Tracking'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {step === 'auth' ? (
            <>
              {/* Tabs */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {tab === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {tab === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
                    style={{ color: 'var(--indigo)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  >
                    {tab === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>

              {/* Google btn */}
              <button style={{
                width: '100%', padding: '11px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)', marginBottom: 20,
                transition: 'background 0.15s',
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <form onSubmit={handleSubmit}>
                {/* Email */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Email address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 14, outline: 'none',
                        fontFamily: 'Inter', color: 'var(--text-primary)', background: 'var(--bg)',
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{
                        width: '100%', padding: '11px 40px 11px 38px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 14, outline: 'none',
                        fontFamily: 'Inter', color: 'var(--text-primary)', background: 'var(--bg)',
                      }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {tab === 'login' && (
                  <div style={{ textAlign: 'right', marginBottom: 20 }}>
                    <button type="button" style={{ fontSize: 13, color: 'var(--indigo)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <button type="submit" className="fitcv-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', fontSize: 15, marginTop: tab === 'register' ? 20 : 0 }}>
                  {tab === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>You are a...</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Select your role to get the right experience</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button
                  onClick={() => setRole('seeker')}
                  style={{
                    padding: '20px 20px', borderRadius: 16, cursor: 'pointer',
                    border: `2px solid ${role === 'seeker' ? 'var(--indigo)' : 'var(--border)'}`,
                    background: role === 'seeker' ? 'var(--indigo-light)' : 'white',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: role === 'seeker' ? 'var(--indigo)' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    <User size={22} color={role === 'seeker' ? 'white' : 'var(--text-secondary)'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>I am a Job Seeker</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyze CVs, track applications, improve job readiness</div>
                  </div>
                </button>

                <button
                  onClick={() => setRole('hr')}
                  style={{
                    padding: '20px 20px', borderRadius: 16, cursor: 'pointer',
                    border: `2px solid ${role === 'hr' ? 'var(--indigo)' : 'var(--border)'}`,
                    background: role === 'hr' ? 'var(--indigo-light)' : 'white',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: role === 'hr' ? 'var(--indigo)' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    <Briefcase size={22} color={role === 'hr' ? 'white' : 'var(--text-secondary)'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>I am a Recruiter</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Screen CVs, rank candidates, manage your pipeline</div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => role && onAuth(role)}
                disabled={!role}
                className="fitcv-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', fontSize: 15, marginTop: 24, opacity: role ? 1 : 0.4 }}
              >
                Continue <ArrowRight size={16} />
              </button>

              <button
                onClick={() => setStep('auth')}
                style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: '8px' }}
              >
                ← Back
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
