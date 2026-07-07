import { useState } from 'react'
import { Plus, Copy, QrCode, ToggleLeft, ToggleRight, Sparkles, ChevronDown } from 'lucide-react'

const existingPosts = [
  { title: 'Senior Backend Developer', dept: 'Engineering', created: 'Jun 28, 2025', cvCount: 47, status: true },
  { title: 'Product Designer', dept: 'Design', created: 'Jun 15, 2025', cvCount: 23, status: true },
  { title: 'Data Analyst', dept: 'Analytics', created: 'May 30, 2025', cvCount: 31, status: true },
  { title: 'Frontend Developer', dept: 'Engineering', created: 'May 10, 2025', cvCount: 18, status: false },
]

const extractedSkills = ['Node.js', 'Docker', 'Kubernetes', 'PostgreSQL', 'Redis', 'REST APIs', 'TypeScript', 'Microservices']
const extractedExp = 'Senior (5+ years)'
const extractedEdu = "Bachelor's in Computer Science or related"

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
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Job Post Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create job posts and configure AI screening weights.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 28 }}>
        {/* Form */}
        <div className="fitcv-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Create / Edit Job Post</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Job Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Senior Backend Developer"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'Inter', outline: 'none', background: 'var(--bg)' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Department</label>
              <div style={{ position: 'relative' }}>
                <select value={dept} onChange={e => setDept(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'Inter', outline: 'none', background: 'var(--bg)', appearance: 'none' }}>
                  <option value="">Select department</option>
                  {['Engineering', 'Design', 'Analytics', 'Marketing', 'Sales', 'HR'].map(d => <option key={d}>{d}</option>)}
                </select>
                <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Job Description</label>
              <button onClick={handleExtract} style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                <Sparkles size={13} /> AI Auto-Extract
              </button>
            </div>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              style={{ width: '100%', minHeight: 140, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'Inter', outline: 'none', background: 'var(--bg)', resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {/* Scoring weights */}
          <div style={{ padding: 18, background: 'var(--bg)', borderRadius: 12, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>AI Screening Weights</h4>
              <span style={{ fontSize: 12, color: totalW === 100 ? '#10B981' : '#EF4444', fontWeight: 700 }}>Total: {totalW}%</span>
            </div>

            {/* Stacked bar */}
            <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
              <div style={{ width: `${weights.skills}%`, background: '#4F46E5', transition: 'width 0.2s' }} />
              <div style={{ width: `${weights.experience}%`, background: '#10B981', transition: 'width 0.2s' }} />
              <div style={{ width: `${weights.education}%`, background: '#F59E0B', transition: 'width 0.2s' }} />
            </div>

            {[
              { key: 'skills', label: 'Skills Match', color: '#4F46E5' },
              { key: 'experience', label: 'Experience', color: '#10B981' },
              { key: 'education', label: 'Education', color: '#F59E0B' },
            ].map(w => (
              <div key={w.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: w.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', width: 110 }}>{w.label}</span>
                <input type="range" min="0" max="100" value={weights[w.key as keyof typeof weights]}
                  onChange={e => setWeights(p => ({ ...p, [w.key]: Number(e.target.value) }))}
                  style={{ flex: 1, accentColor: w.color }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: w.color, width: 36, textAlign: 'right', fontFamily: 'Plus Jakarta Sans' }}>
                  {weights[w.key as keyof typeof weights]}%
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="fitcv-btn-primary" style={{ flex: 1, justifyContent: 'center' }}><Plus size={15} /> Save & Publish</button>
            <button className="fitcv-btn-secondary">Save Draft</button>
          </div>
        </div>

        {/* Side panel — extracted */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {extracted && (
            <div className="fitcv-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Sparkles size={16} color="var(--indigo)" />
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Auto-Extracted Requirements</h4>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {extractedSkills.map(s => <span key={s} className="badge-green" style={{ fontSize: 11 }}>{s}</span>)}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Experience Level</div>
                <span className="badge-indigo">{extractedExp}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Education</div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{extractedEdu}</span>
              </div>
            </div>
          )}

          {/* Shareable link */}
          <div className="fitcv-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <QrCode size={16} color="var(--indigo)" />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Shareable JD Link</h4>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                fitcv.io/j/senior-backend-dev
              </div>
              <button style={{ background: 'var(--indigo-light)', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--indigo)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                <Copy size={13} /> Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Existing posts */}
      <div className="fitcv-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>All Job Posts</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Title', 'Department', 'Created', 'CVs', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 20px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</td>
                <td style={{ padding: '14px 20px' }}><span className="badge-indigo">{p.dept}</span></td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.created}</td>
                <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.cvCount}</td>
                <td style={{ padding: '14px 20px' }}>
                  <button onClick={() => togglePost(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: p.status ? '#10B981' : 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>
                    {p.status ? <ToggleRight size={22} color="#10B981" /> : <ToggleLeft size={22} color="#D1D5DB" />}
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
