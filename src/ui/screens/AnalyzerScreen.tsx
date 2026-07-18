import { useState } from 'react'
import { Upload, FileText, Zap, AlertCircle } from 'lucide-react'
import ScoreRing from '../components/ScoreRing'
import { getScoreTone } from '@/services/matchScore'

const breakdowns = [
  { label: 'Skills Match', score: 85 },
  { label: 'Experience', score: 68 },
  { label: 'Education', score: 90 },
  { label: 'Soft Skills', score: 62 },
]

export default function AnalyzerScreen() {
  const [analyzed, setAnalyzed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cvFile, setCvFile] = useState<string | null>(null)
  const [jdText, setJdText] = useState('')
  const [cvDrag, setCvDrag] = useState(false)

  const handleAnalyze = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setAnalyzed(true)
    }, 1800)
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <h1>CV &amp; JD Match Analyzer</h1>
          <p>Upload your CV and paste a Job Description to get your AI-powered match score.</p>
        </div>
      </div>

      {/* Upload area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* CV upload */}
        <div
          className="fc-card fc-card--pad fc-card--lift"
          onDragOver={e => { e.preventDefault(); setCvDrag(true) }}
          onDragLeave={() => setCvDrag(false)}
          onDrop={e => { e.preventDefault(); setCvDrag(false); const f = e.dataTransfer.files[0]; if (f) setCvFile(f.name) }}
          style={{
            border: `2px dashed ${cvDrag ? 'var(--accent)' : cvFile ? 'var(--success)' : 'var(--border-strong)'}`,
            background: cvDrag ? 'var(--accent-soft)' : cvFile ? 'var(--success-soft)' : 'var(--surface)',
            transition: 'all 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200,
          }}
          onClick={() => !cvFile && setCvFile('My_CV_2025.pdf')}
        >
          {cvFile ? (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <FileText size={26} color="var(--success)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{cvFile}</div>
              <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ Ready to analyze</div>
              <button onClick={e => { e.stopPropagation(); setCvFile(null) }} style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
            </>
          ) : (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Upload size={24} color="var(--accent)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>Upload your CV</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Drag &amp; drop or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>browse files</span>
                <br />PDF or DOCX, max 10MB
              </div>
            </>
          )}
        </div>

        {/* JD input */}
        <div className="fc-card fc-card--pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Job Description</div>
            <button className="fc-btn fc-btn--secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
              <Upload size={12} /> Upload JD
            </button>
          </div>
          <textarea
            className="fc-input"
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here...&#10;&#10;We're looking for a Senior Backend Developer with experience in Node.js, PostgreSQL, Docker, and microservices architecture..."
            style={{
              flex: 1, minHeight: 150, resize: 'none',
              padding: 14, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
              background: 'var(--surface-2)', lineHeight: 1.6,
            }}
          />
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            {jdText.length > 0 ? `${jdText.split(' ').filter(Boolean).length} words` : 'Tip: Paste the complete JD for best results'}
          </div>
        </div>
      </div>

      {/* Analyze button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <button
          className="fc-btn fc-btn--primary"
          onClick={handleAnalyze}
          disabled={loading}
          style={{ padding: '14px 40px', fontSize: 16, gap: 10, opacity: loading ? 0.8 : 1 }}
        >
          {loading ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3" />
                <path d="M12 3a9 9 0 019 9" strokeLinecap="round" />
              </svg>
              Analyzing with AI...
            </>
          ) : (
            <><Zap size={18} fill="white" /> Analyze with AI</>
          )}
        </button>
      </div>

      {/* Results */}
      {analyzed && (
        <div>
          {/* Main score + breakdowns */}
          <div className="fc-card fc-card--pad" style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            <div className="fc-glow" style={{ width: 240, height: 240, top: -80, right: -60 }} />
            <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
              <div className="fc-eyebrow" style={{ marginBottom: 6 }}>Analysis Results</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                VNG Corp · Senior Backend Developer
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <ScoreRing score={78} size={160} strokeWidth={14} label="Overall Match" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {breakdowns.map(b => {
                  const tone = getScoreTone(b.score)
                  return (
                    <div key={b.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', minWidth: 150 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{b.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: tone.color, fontFamily: 'var(--font-display)' }}>{b.score}%</span>
                      </div>
                      <div className="fc-progress">
                        <div style={{ width: `${b.score}%`, background: tone.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Probability gauge */}
          <div className="fc-card fc-card--pad" style={{ marginBottom: 16, background: 'var(--warning-soft)', border: '1px solid #fde9cf' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fff', border: '1px solid #fde9cf', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={24} color="var(--warning)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
                  68% chance of passing this JD&apos;s screening round
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Based on historical screening data for similar Backend Developer roles at mid-to-large tech companies
                </div>
                {/* Speedometer bar */}
                <div style={{ height: 10, borderRadius: 5, background: 'linear-gradient(to right, #EF4444, #F59E0B, #10B981)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '68%', top: -3, width: 4, height: 16, background: '#1F2937', borderRadius: 2, boxShadow: '0 0 0 2px white' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Low</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>High</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>68%</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Pass Rate</div>
              </div>
            </div>
          </div>

          {/* Skill tags summary */}
          <div className="fc-card fc-card--pad">
            <div className="fc-section-title" style={{ marginBottom: 14 }}>
              <h3>Skills Assessment</h3>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Matched Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Node.js', 'PostgreSQL', 'REST APIs', 'Git', 'Agile', 'JavaScript', 'TypeScript'].map(s => (
                  <span key={s} className="fc-badge fc-badge--green">✓ {s}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Missing Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Docker', 'Kubernetes', 'Redis', 'Microservices'].map(s => (
                  <span key={s} className="fc-badge fc-badge--amber">⚠ {s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
