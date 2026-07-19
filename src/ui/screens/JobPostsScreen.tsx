import { useState } from 'react'
import { Plus, Copy, QrCode, ToggleLeft, ToggleRight, Sparkles, ChevronDown, Briefcase } from 'lucide-react'

const existingPosts = [
  { title: 'Senior Backend Developer', dept: 'Engineering', created: 'Jun 28, 2025', cvCount: 47, status: true },
  { title: 'Product Designer', dept: 'Design', created: 'Jun 15, 2025', cvCount: 23, status: true },
  { title: 'Data Analyst', dept: 'Analytics', created: 'May 30, 2025', cvCount: 31, status: true },
  { title: 'Frontend Developer', dept: 'Engineering', created: 'May 10, 2025', cvCount: 18, status: false },
]

const extractedSkills = ['Node.js', 'Docker', 'Kubernetes', 'PostgreSQL', 'Redis', 'REST APIs', 'TypeScript', 'Microservices']
const extractedExp = 'Senior (5+ years)'
const extractedEdu = "Bachelor's in Computer Science or related"

const weightMeta = [
  { key: 'skills', label: 'Skills Match', color: 'var(--accent)' },
  { key: 'experience', label: 'Experience', color: 'var(--success)' },
  { key: 'education', label: 'Education', color: 'var(--warning)' },
]

export default function JobPostsScreen() {
  const [title, setTitle] = useState('')
  const [dept, setDept] = useState('')
  const [jdText, setJdText] = useState('')
  const [extracted, setExtracted] = useState(false)
  const [weights, setWeights] = useState({ skills: 50, experience: 30, education: 20 })
  const [posts, setPosts] = useState(existingPosts)

  const handleExtract = () => {
    setExtracted(true)
    setTitle('Senior Backend Developer')
    setDept('Engineering')
    setJdText(`We're looking for a Senior Backend Developer with 5+ years of experience in building scalable systems.

Requirements:
- Proficiency in Node.js, TypeScript, and PostgreSQL
- Experience with Docker, Kubernetes, and microservices architecture
- Strong knowledge of Redis caching and REST API design
- Bachelor's degree in Computer Science or related field`)
  }

  const togglePost = (i: number) => setPosts(p => p.map((post, idx) => idx === i ? { ...post, status: !post.status } : post))

  const totalW = weights.skills + weights.experience + weights.education

  return (
    <div className="fc-stagger">
      {/* Page head */}
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Recruitment</div>
          <h1>Job Post Management</h1>
          <p style={{ marginTop: 6 }}>Create job posts and configure how the AI screens incoming candidates.</p>
        </div>
        <div className="fc-badge fc-badge--amber" style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>
          {posts.length} active posts
        </div>
      </div>

      <div className="fc-stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 32 }}>
        {/* Form */}
        <div className="fc-card fc-card--pad">
          <div className="fc-section-title" style={{ marginBottom: 24 }}>
            <Briefcase size={17} color="var(--accent)" />
            <h2>Create / Edit Job Post</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label className="fc-field-label">Job Title</label>
              <input
                className="fc-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Senior Backend Developer"
              />
            </div>
            <div>
              <label className="fc-field-label">Department</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="fc-input"
                  value={dept}
                  onChange={e => setDept(e.target.value)}
                  style={{ appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select department</option>
                  {['Engineering', 'Design', 'Analytics', 'Marketing', 'Sales', 'HR'].map(d => <option key={d}>{d}</option>)}
                </select>
                <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="fc-field-label" style={{ marginBottom: 0 }}>Job Description</label>
              <button onClick={handleExtract} className="fc-btn fc-btn--primary" style={{ fontSize: 12, padding: '7px 13px' }}>
                <Sparkles size={13} /> AI Auto-Extract
              </button>
            </div>
            <textarea
              className="fc-input"
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              style={{ minHeight: 140, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Scoring weights */}
          <div className="fc-panel" style={{ padding: 22, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>AI Screening Weights</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>How the candidate score is balanced</div>
              </div>
              <span
                className="fc-badge"
                style={{ background: totalW === 100 ? 'var(--success-soft)' : 'var(--danger-soft)', color: totalW === 100 ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-display)', fontSize: 13 }}
              >
                Total: {totalW}%
              </span>
            </div>

            {/* Stacked bar */}
            <div style={{ height: 12, borderRadius: 99, overflow: 'hidden', display: 'flex', marginBottom: 18, background: 'var(--bg-grain)', boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)' }}>
              <div style={{ width: `${weights.skills}%`, background: 'var(--accent)', transition: 'width 0.2s' }} />
              <div style={{ width: `${weights.experience}%`, background: 'var(--success)', transition: 'width 0.2s' }} />
              <div style={{ width: `${weights.education}%`, background: 'var(--warning)', transition: 'width 0.2s' }} />
            </div>

            {weightMeta.map(w => (
              <div key={w.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: w.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', width: 112, fontWeight: 500 }}>{w.label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights[w.key as keyof typeof weights]}
                  onChange={e => setWeights(p => ({ ...p, [w.key]: Number(e.target.value) }))}
                  style={{ flex: 1, accentColor: w.color, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 800, color: w.color, width: 42, textAlign: 'right', fontFamily: 'var(--font-display)' }}>
                  {weights[w.key as keyof typeof weights]}%
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="fc-btn fc-btn--primary" style={{ flex: 1, justifyContent: 'center' }}><Plus size={15} /> Save &amp; Publish</button>
            <button className="fc-btn fc-btn--secondary">Save Draft</button>
          </div>
        </div>

        {/* Side panel — extracted */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {extracted && (
            <div className="fc-card fc-card--pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={16} color="var(--accent)" /></span>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Auto-Extracted Requirements</h3>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {extractedSkills.map(s => <span key={s} className="fc-badge fc-badge--green" style={{ fontSize: 11 }}>{s}</span>)}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="fc-eyebrow" style={{ marginBottom: 7 }}>Experience Level</div>
                <span className="fc-badge fc-badge--blue">{extractedExp}</span>
              </div>
              <div>
                <div className="fc-eyebrow" style={{ marginBottom: 7 }}>Education</div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{extractedEdu}</span>
              </div>
            </div>
          )}

          {/* Shareable link */}
          <div className="fc-card fc-card--pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><QrCode size={16} color="var(--accent)" /></span>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Shareable JD Link</h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '9px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                fitcv.io/j/senior-backend-dev
              </div>
              <button className="fc-btn fc-btn--secondary" style={{ padding: '9px 13px', fontSize: 12 }}>
                <Copy size={13} /> Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Existing posts */}
      <div className="fc-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div className="fc-section-title">
            <Briefcase size={17} color="var(--accent)" />
            <h2>All Job Posts</h2>
            <span>{posts.length} total</span>
          </div>
        </div>
        <table className="fc-table">
          <thead>
            <tr>
              {['Title', 'Department', 'Created', 'CVs', 'Status'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.title}</td>
                <td><span className="fc-badge fc-badge--blue">{p.dept}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.created}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{p.cvCount}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>CVs</span>
                  </div>
                </td>
                <td>
                  <button onClick={() => togglePost(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: p.status ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>
                    {p.status ? <ToggleRight size={22} color="var(--success)" /> : <ToggleLeft size={22} color="var(--text-muted)" />}
                    {p.status ? 'Active' : 'Archived'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
