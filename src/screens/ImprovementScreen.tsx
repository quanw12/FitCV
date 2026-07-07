import { useState } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp, Lightbulb, ArrowRight } from 'lucide-react'

const toc = ['Skill Gap Report', 'Work Experience', 'Skills Section', 'Education', 'Summary', 'Quick Wins']

const missingSkills = [
  { skill: 'Docker', priority: 'High', level: 90 },
  { skill: 'Kubernetes', priority: 'High', level: 85 },
  { skill: 'Redis', priority: 'Medium', level: 65 },
  { skill: 'Microservices', priority: 'Medium', level: 60 },
  { skill: 'CI/CD Pipeline', priority: 'Medium', level: 55 },
  { skill: 'GraphQL', priority: 'Low', level: 30 },
]

const feedbackItems = [
  {
    section: 'Work Experience',
    before: 'Responsible for developing backend features and fixing bugs in the main application.',
    after: 'Engineered and deployed 12 RESTful microservices handling 50K+ daily transactions, reducing API response time by 40% through Redis caching and PostgreSQL query optimization.',
    issue: 'Vague responsibility statement with no measurable impact.',
  },
  {
    section: 'Work Experience',
    before: 'Worked with team to build new features and improve code quality.',
    after: 'Collaborated with a cross-functional team of 8 engineers to ship 3 major product features (Q3 2024), achieving 98.5% uptime and zero critical incidents post-launch.',
    issue: 'Missing team size, features delivered, and outcome metrics.',
  },
]

const quickWins = [
  { text: 'Add "Docker" to skills section', done: false },
  { text: 'Include GitHub profile link', done: true },
  { text: 'Add quantified metrics to 2 bullet points', done: false },
  { text: 'Remove "References available upon request"', done: true },
  { text: 'Shorten summary to under 3 sentences', done: false },
  { text: 'Add LinkedIn URL to contact section', done: false },
]

export default function ImprovementScreen() {
  const [activeSection, setActiveSection] = useState('Skill Gap Report')
  const [expanded, setExpanded] = useState<number[]>([0, 1])
  const [wins, setWins] = useState(quickWins)

  const toggleExpanded = (i: number) => setExpanded(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])
  const toggleWin = (i: number) => setWins(p => p.map((w, idx) => idx === i ? { ...w, done: !w.done } : w))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
      {/* Sidebar TOC */}
      <div className="fitcv-card" style={{ padding: 16, alignSelf: 'start', position: 'sticky', top: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Contents</div>
        {toc.map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none',
              background: activeSection === s ? 'var(--indigo-light)' : 'transparent',
              color: activeSection === s ? 'var(--indigo)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: activeSection === s ? 600 : 400, cursor: 'pointer', marginBottom: 2,
              transition: 'all 0.15s',
            }}
          >
            {s}
          </button>
        ))}

        {/* Score summary */}
        <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Overall CV Score</div>
          {[['Relevance', 78], ['Format', 84], ['Impact', 62], ['Keywords', 70]].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{v}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
                <div style={{ width: `${v}%`, height: '100%', background: Number(v) >= 80 ? '#10B981' : Number(v) >= 65 ? '#4F46E5' : '#F59E0B', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>AI Improvement Suggestions</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>For: <strong>VNG Corp — Senior Backend Developer</strong></p>
        </div>

        {/* Skill gap report */}
        <div className="fitcv-card" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb size={18} color="#F59E0B" />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Skill Gap Report</h3>
            <span className="badge-amber" style={{ marginLeft: 'auto' }}>6 gaps found</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missingSkills.map(s => (
              <div key={s.skill} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10 }}>
                <span className={s.priority === 'High' ? 'badge-red' : s.priority === 'Medium' ? 'badge-amber' : 'badge-indigo'} style={{ minWidth: 60, justifyContent: 'center' }}>
                  {s.priority}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>{s.skill}</span>
                <div style={{ width: 100, height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                  <div style={{ width: `${s.level}%`, height: '100%', background: s.priority === 'High' ? '#EF4444' : s.priority === 'Medium' ? '#F59E0B' : '#4F46E5', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 40, textAlign: 'right' }}>{s.level}% demand</span>
              </div>
            ))}
          </div>
        </div>

        {/* Before/after comparisons */}
        <div className="fitcv-card" style={{ padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Section Feedback</h3>
          {feedbackItems.map((item, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <button
                onClick={() => toggleExpanded(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)',
                  background: expanded.includes(i) ? 'var(--bg)' : 'white', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.section} — Bullet #{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-red">Weak impact</span>
                  {expanded.includes(i) ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>
              </button>

              {expanded.includes(i) && (
                <div style={{ padding: '16px', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: 'white' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Issue</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, padding: '8px 12px', background: '#FEF2F2', borderRadius: 6, borderLeft: '3px solid #EF4444' }}>
                    {item.issue}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        BEFORE
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, textDecoration: 'line-through', textDecorationColor: '#EF4444' }}>
                        {item.before}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', marginBottom: 6 }}>AI REWRITE</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                        {item.after}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#EEF2FF', color: '#4F46E5' }}>Problem</span>
                    <ArrowRight size={12} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#F0FDF4', color: '#10B981' }}>Action</span>
                    <ArrowRight size={12} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>Result</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick wins */}
        <div className="fitcv-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Quick Wins Checklist</h3>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{wins.filter(w => w.done).length}/{wins.length} done</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: `${(wins.filter(w => w.done).length / wins.length) * 100}%`, height: '100%', background: '#10B981', borderRadius: 3, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wins.map((w, i) => (
              <button
                key={i}
                onClick={() => toggleWin(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: w.done ? '#F0FDF4' : 'white', cursor: 'pointer',
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                {w.done ? <CheckSquare size={18} color="#10B981" /> : <Square size={18} color="var(--text-muted)" />}
                <span style={{ fontSize: 14, color: w.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: w.done ? 'line-through' : 'none', fontWeight: 500 }}>
                  {w.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
