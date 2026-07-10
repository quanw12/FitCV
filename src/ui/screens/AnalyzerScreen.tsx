import { useState } from 'react'
import { Upload, FileText, Zap, AlertCircle } from 'lucide-react'
import ScoreRing from '../components/ScoreRing'

const breakdowns = [
  { label: 'Skills Match', score: 85, color: '#10B981', track: '#D1FAE5' },
  { label: 'Experience', score: 68, color: '#4F46E5', track: '#EEF2FF' },
  { label: 'Education', score: 90, color: '#10B981', track: '#D1FAE5' },
  { label: 'Soft Skills', score: 62, color: '#F59E0B', track: '#FEF3C7' },
]

export default function AnalyzerScreen() {
  const [analyzed, setAnalyzed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cvFile, setCvFile] = useState<string | null>(null)
  const [jdText, setJdText] = useState('')
  const [cvDrag, setCvDrag] = useState(false)

  const handleAnalyze = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setAnalyzed(true) }, 1800)
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>CV & JD Match Analyzer</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Upload your CV and paste a Job Description to get your AI-powered match score.</p>
      </div>

      {/* Upload area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* CV upload */}
        <div
          className="fitcv-card"
          onDragOver={e => { e.preventDefault(); setCvDrag(true) }}
          onDragLeave={() => setCvDrag(false)}
          onDrop={e => { e.preventDefault(); setCvDrag(false); const f = e.dataTransfer.files[0]; if (f) setCvFile(f.name) }}
          style={{
            padding: 24, border: `2px dashed ${cvDrag ? 'var(--indigo)' : cvFile ? '#10B981' : 'var(--border)'}`,
            background: cvDrag ? 'var(--indigo-light)' : cvFile ? '#F0FDF4' : 'white',
            transition: 'all 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200,
          }}
          onClick={() => !cvFile && setCvFile('My_CV_2025.pdf')}
        >
          {cvFile ? (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <FileText size={26} color="#10B981" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{cvFile}</div>
              <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>✓ Ready to analyze</div>
              <button onClick={e => { e.stopPropagation(); setCvFile(null) }} style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
            </>
          ) : (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Upload size={24} color="var(--indigo)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>Upload your CV</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Drag & drop or <span style={{ color: 'var(--indigo)', fontWeight: 600 }}>browse files</span>
                <br />PDF or DOCX, max 10MB
              </div>
            </>
          )}
        </div>

        {/* JD input */}
        <div className="fitcv-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Job Description</div>
            <button style={{ fontSize: 12, color: 'var(--indigo)', fontWeight: 600, background: 'var(--indigo-light)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Upload size={11} /> Upload JD
            </button>
          </div>
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here...&#10;&#10;We're looking for a Senior Backend Developer with experience in Node.js, PostgreSQL, Docker, and microservices architecture..."
            style={{
              flex: 1, minHeight: 150, resize: 'none', border: '1px solid var(--border)', borderRadius: 10,
              padding: 14, fontSize: 13, fontFamily: 'Inter', color: 'var(--text-primary)', outline: 'none',
              background: 'var(--bg)', lineHeight: 1.6,
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
          className="fitcv-btn-primary"
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
          <div className="fitcv-card" style={{ padding: 28, marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>
              Analysis Results — VNG Corp · Senior Backend Developer
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
              <ScoreRing score={78} size={160} strokeWidth={14} label="Overall Match" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {breakdowns.map(b => (
                  <div key={b.label} style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', minWidth: 150 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{b.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: b.color, fontFamily: 'Plus Jakarta Sans' }}>{b.score}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: b.track, overflow: 'hidden' }}>
                      <div style={{ width: `${b.score}%`, height: '100%', background: b.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Probability gauge */}
          <div className="fitcv-card" style={{ padding: 24, marginBottom: 16, border: '1px solid #FEF3C7', background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7 80%, #FFF)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={24} color="var(--amber)" />
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
                <div style={{ fontSize: 36, fontWeight: 800, color: '#F59E0B', fontFamily: 'Plus Jakarta Sans', lineHeight: 1 }}>68%</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Pass Rate</div>
              </div>
            </div>
          </div>

          {/* Skill tags summary */}
          <div className="fitcv-card" style={{ padding: 24 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Skills Assessment</h4>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matched Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Node.js', 'PostgreSQL', 'REST APIs', 'Git', 'Agile', 'JavaScript', 'TypeScript'].map(s => (
                  <span key={s} className="badge-green">✓ {s}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Missing Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Docker', 'Kubernetes', 'Redis', 'Microservices'].map(s => (
                  <span key={s} className="badge-amber">⚠ {s}</span>
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
