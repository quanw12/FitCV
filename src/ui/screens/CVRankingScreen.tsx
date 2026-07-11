import { useState } from 'react'
import { Upload, ChevronRight, X, Mail, Phone, MapPin, Briefcase, GraduationCap } from 'lucide-react'

const candidates = [
  { id: 1, name: 'Nguyen Thanh Minh', score: 92, email: 'ntminh@gmail.com', phone: '0912 345 678', location: 'Ho Chi Minh City', skills: ['Node.js', 'Docker', 'PostgreSQL', 'TypeScript'], exp: '6 years', edu: "Bachelor's CS — HCMUT", pos: 'Senior Backend Developer' },
  { id: 2, name: 'Tran Phuong Linh', score: 85, email: 'plinh@yahoo.com', phone: '0987 654 321', location: 'Hanoi', skills: ['Node.js', 'Redis', 'TypeScript', 'AWS'], exp: '4 years', edu: "Bachelor's SE — VNU", pos: 'Senior Backend Developer' },
  { id: 3, name: 'Le Duc Anh', score: 78, email: 'lducanh@outlook.com', phone: '0934 111 222', location: 'Ho Chi Minh City', skills: ['Node.js', 'PostgreSQL', 'REST API'], exp: '3 years', edu: "Bachelor's IT — RMIT", pos: 'Senior Backend Developer' },
  { id: 4, name: 'Hoang Thi Bich', score: 71, email: 'htbich@gmail.com', phone: '0901 222 333', location: 'Da Nang', skills: ['Python', 'Django', 'PostgreSQL'], exp: '4 years', edu: "Bachelor's CS — DUT", pos: 'Senior Backend Developer' },
  { id: 5, name: 'Pham Van Khai', score: 58, email: 'pvkhai@gmail.com', phone: '0923 444 555', location: 'Ho Chi Minh City', skills: ['PHP', 'MySQL', 'Laravel'], exp: '2 years', edu: "Bachelor's IT — VHU", pos: 'Senior Backend Developer' },
  { id: 6, name: 'Do Thi Lan', score: 42, email: 'dtlan@gmail.com', phone: '0945 666 777', location: 'Hanoi', skills: ['Java', 'Spring Boot'], exp: '1 year', edu: "Bachelor's CS — HUST", pos: 'Senior Backend Developer' },
]

export default function CVRankingScreen() {
  const [selected, setSelected] = useState<typeof candidates[0] | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const getScoreClass = (score: number) => score >= 80 ? { color: '#10B981', bg: '#D1FAE5' } : score >= 50 ? { color: '#F59E0B', bg: '#FEF3C7' } : { color: '#EF4444', bg: '#FEE2E2' }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>CV Upload & AI Ranking</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Senior Backend Developer · 6 candidates ranked by AI score</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false) }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--indigo)' : 'var(--border)'}`,
          borderRadius: 16, padding: '24px', marginBottom: 20,
          background: dragOver ? 'var(--indigo-light)' : 'white',
          display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Upload size={24} color="var(--indigo)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>Drop CVs here or browse</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PDF or DOCX · Multiple files supported · AI ranks automatically</div>
        </div>
        <button className="fitcv-btn-primary">Browse Files</button>
      </div>

      {/* Ranked list + detail panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, transition: 'grid-template-columns 0.2s' }}>
        {/* Ranked table */}
        <div className="fitcv-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Ranked Candidates</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="badge-green">3 Strong</span>
              <span className="badge-amber">2 Moderate</span>
              <span className="badge-red">1 Weak</span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Rank', 'Candidate', 'AI Score', 'Skills Match', 'Experience', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => {
                const sc = getScoreClass(c.score)
                const isActive = selected?.id === c.id
                return (
                  <tr key={c.id}
                    onClick={() => setSelected(isActive ? null : c)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: isActive ? 'var(--indigo-light)' : 'white', transition: 'background 0.15s' }}
                    onMouseOver={e => !isActive && (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseOut={e => !isActive && (e.currentTarget.style.background = 'white')}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? 'var(--indigo-light)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: i < 3 ? 'var(--indigo)' : 'var(--text-muted)' }}>
                        {i + 1}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: sc.color, flexShrink: 0 }}>
                          {c.name.split(' ').pop()?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>{c.score}%</span>
                    </td>
                    <td style={{ padding: '14px 16px', maxWidth: 180 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {c.skills.slice(0, 2).map(s => <span key={s} className="badge-green" style={{ fontSize: 11 }}>{s}</span>)}
                        {c.skills.length > 2 && <span className="badge-indigo" style={{ fontSize: 11 }}>+{c.skills.length - 2}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{c.exp}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isActive ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="fitcv-card" style={{ padding: 22, alignSelf: 'start', position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Candidate Profile</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Avatar + score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>
                {selected.name.split(' ').pop()?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{selected.pos}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: getScoreClass(selected.score).color, fontFamily: 'Plus Jakarta Sans', lineHeight: 1 }}>{selected.score}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI Score</div>
              </div>
            </div>

            {/* Contact info */}
            {[
              { icon: <Mail size={13} />, val: selected.email },
              { icon: <Phone size={13} />, val: selected.phone },
              { icon: <MapPin size={13} />, val: selected.location },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                {r.icon} {r.val}
              </div>
            ))}

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}><Briefcase size={10} style={{ verticalAlign: 'middle' }} /> Experience</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.exp}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}><GraduationCap size={10} style={{ verticalAlign: 'middle' }} /> Education</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.edu}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Matched Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {selected.skills.map(s => <span key={s} className="badge-green" style={{ fontSize: 11 }}>✓ {s}</span>)}
              </div>
            </div>

            {/* Score breakdown */}
            <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, marginBottom: 16 }}>
              {[['Skills', 88], ['Experience', 75], ['Education', 90]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                    <div style={{ width: `${v}%`, height: '100%', background: '#4F46E5', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="fitcv-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>Shortlist</button>
              <button className="fitcv-btn-secondary" style={{ fontSize: 13 }}>Reject</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
