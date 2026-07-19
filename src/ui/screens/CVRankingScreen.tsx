import { useState } from 'react'
import { Upload, ChevronRight, X, Mail, Phone, MapPin, Briefcase, GraduationCap } from 'lucide-react'
import ScoreRing from '../components/ScoreRing'

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

  const getScoreClass = (score: number) =>
    score >= 80
      ? { color: 'var(--success)', soft: 'var(--success-soft)', badge: 'fc-badge--green' }
      : score >= 50
        ? { color: 'var(--warning)', soft: 'var(--warning-soft)', badge: 'fc-badge--amber' }
        : { color: 'var(--danger)', soft: 'var(--danger-soft)', badge: 'fc-badge--red' }

  const barColor = (v: number) => (v >= 80 ? 'var(--success)' : v >= 50 ? 'var(--warning)' : 'var(--danger)')

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>Talent Intelligence</div>
          <h1>CV Upload &amp; AI Ranking</h1>
          <p>Senior Backend Developer · 6 candidates ranked by AI score</p>
        </div>
        <button className="fc-btn fc-btn--primary"><Upload size={15} /> Upload CVs</button>
      </div>

      {/* Upload dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false) }}
        className="fc-card"
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-lg)',
          padding: 24,
          marginBottom: 22,
          background: dragOver ? 'var(--accent-soft)' : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Upload size={24} color="var(--accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>Drop CVs here or browse</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PDF or DOCX · Multiple files supported · AI ranks automatically</div>
        </div>
        <button className="fc-btn fc-btn--primary">Browse Files</button>
      </div>

      {/* Ranked list + detail panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, transition: 'grid-template-columns 0.2s' }}>
        {/* Ranked table */}
        <div className="fc-card" style={{ overflow: 'hidden' }}>
          <div className="fc-section-title" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
            <h3>Ranked Candidates</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <span className="fc-badge fc-badge--green">3 Strong</span>
              <span className="fc-badge fc-badge--amber">2 Moderate</span>
              <span className="fc-badge fc-badge--red">1 Weak</span>
            </div>
          </div>
          <table className="fc-table">
            <thead>
              <tr>
                {['Rank', 'Candidate', 'AI Score', 'Skills Match', 'Experience', ''].map(h => (
                  <th key={h}>{h}</th>
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
                    style={{ cursor: 'pointer', background: isActive ? 'var(--accent-soft)' : 'transparent', transition: 'background 0.15s' }}
                  >
                    <td style={{ width: 36 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? 'var(--accent-soft)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: i < 3 ? 'var(--accent-ink)' : 'var(--text-muted)' }}>
                        {i + 1}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: sc.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: sc.color, flexShrink: 0 }}>
                          {c.name.split(' ').pop()?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`fc-badge ${sc.badge}`}>{c.score}%</span>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {c.skills.slice(0, 2).map(s => <span key={s} className="fc-chip">{s}</span>)}
                        {c.skills.length > 2 && <span className="fc-chip fc-chip--active">+{c.skills.length - 2}</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{c.exp}</td>
                    <td>
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
          <div className="fc-card fc-card--pad" style={{ alignSelf: 'start', position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Candidate Profile</h3>
              <button onClick={() => setSelected(null)} className="fc-icon-btn" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* Avatar + score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {selected.name.split(' ').pop()?.[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{selected.pos}</div>
              </div>
              <ScoreRing score={selected.score} size={84} strokeWidth={9} label="AI Score" />
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
                {selected.skills.map(s => <span key={s} className="fc-badge fc-badge--green">✓ {s}</span>)}
              </div>
            </div>

            {/* Score breakdown */}
            <div className="fc-panel" style={{ padding: 14, marginBottom: 16 }}>
              {([['Skills', 88], ['Experience', 75], ['Education', 90]] as [string, number][]).map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v}%</span>
                  </div>
                  <div className="fc-progress">
                    <div style={{ width: `${v}%`, background: barColor(v) }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="fc-btn fc-btn--primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>Shortlist</button>
              <button className="fc-btn fc-btn--secondary" style={{ fontSize: 13 }}>Reject</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
