import { Calendar, TrendingUp, BookOpen, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const jdCards = [
  { company: 'VNG Corp', title: 'Senior Backend Developer', score: 78, date: 'Jul 2, 2025', tags: ['Node.js', 'Docker', 'PostgreSQL'] },
  { company: 'Shopee Vietnam', title: 'Fullstack Engineer', score: 65, date: 'Jun 20, 2025', tags: ['React', 'Node.js', 'MySQL'] },
  { company: 'MoMo Payment', title: 'Backend Developer', score: 71, date: 'Jun 5, 2025', tags: ['Java', 'Spring Boot', 'Kafka'] },
  { company: 'Tiki E-commerce', title: 'Node.js Developer', score: 58, date: 'May 28, 2025', tags: ['Node.js', 'Redis', 'AWS'] },
  { company: 'Zalo (VNG)', title: 'Software Engineer', score: 82, date: 'May 15, 2025', tags: ['C++', 'Go', 'Kubernetes'] },
  { company: 'KMS Technology', title: 'Java Backend Dev', score: 54, date: 'Jul 1, 2025', tags: ['Java', 'Microservices', 'Docker'] },
]

const topSkillsData = [
  { skill: 'Docker', count: 5 },
  { skill: 'Node.js', count: 4 },
  { skill: 'PostgreSQL', count: 3 },
  { skill: 'Kubernetes', count: 3 },
  { skill: 'Redis', count: 3 },
  { skill: 'Microservices', count: 2 },
]

const missingSkillsData = [
  { skill: 'Docker', count: 5, pct: 83 },
  { skill: 'Kubernetes', count: 4, pct: 67 },
  { skill: 'Redis', count: 3, pct: 50 },
  { skill: 'Kafka', count: 2, pct: 33 },
  { skill: 'GraphQL', count: 2, pct: 33 },
]

const roadmap = [
  { icon: '🐳', skill: 'Docker & Containerization', priority: 1, time: '2 weeks', demand: 83 },
  { icon: '☸️', skill: 'Kubernetes Basics', priority: 2, time: '3 weeks', demand: 67 },
  { icon: '⚡', skill: 'Redis & Caching', priority: 3, time: '1 week', demand: 50 },
  { icon: '📨', skill: 'Apache Kafka', priority: 4, time: '2 weeks', demand: 33 },
]

// Spec score colors: >=75 green, 60-74 blue, else amber
const scoreColor = (s: number) => (s >= 75 ? 'var(--success)' : s >= 60 ? '#2563EB' : 'var(--warning)')
const scoreBadge = (s: number) => (s >= 75 ? 'fc-badge--green' : s >= 60 ? 'fc-badge--blue' : 'fc-badge--amber')

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  fontSize: 13,
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-lg)',
  padding: '8px 12px',
}

const axisTick = { fontSize: 12, fill: 'var(--text-muted)', fontWeight: 600 }

export default function JDLibraryScreen() {
  return (
    <div className="fc-stagger">
      {/* Page head */}
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Market Intelligence</div>
          <h1>JD Library &amp; Market Insights</h1>
          <p style={{ marginTop: 6 }}>Browse your analyzed job descriptions and discover where the market is heading.</p>
        </div>
        <div className="fc-badge fc-badge--blue" style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>
          {jdCards.length} JDs analyzed
        </div>
      </div>

      {/* JD grid */}
      <div className="fc-section-title" style={{ marginBottom: 16 }}>
        <FileText size={17} color="var(--accent)" />
        <h2>Analyzed Job Descriptions</h2>
        <span>Most recent first</span>
      </div>
      <div className="fc-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 32 }}>
        {jdCards.map(jd => (
          <div key={jd.company + jd.title} className="fc-card fc-card--pad fc-card--lift" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--accent-ink)', flexShrink: 0 }}>
                  {jd.company[0]}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.02em' }}>{jd.company}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} /> {jd.date}
                  </div>
                </div>
              </div>
              <span className={`fc-badge ${scoreBadge(jd.score)}`} style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>
                {jd.score}% match
              </span>
            </div>

            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{jd.title}</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {jd.tags.map(t => <span key={t} className="fc-chip">{t}</span>)}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className="fc-progress" style={{ width: 90 }}>
                  <div style={{ width: `${jd.score}%`, background: scoreColor(jd.score) }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor(jd.score), fontFamily: 'var(--font-display)' }}>{jd.score}</span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-ink)' }}>
                View <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Market insights */}
      <div className="fc-section-title" style={{ marginBottom: 16 }}>
        <TrendingUp size={17} color="var(--accent)" />
        <h2>Market Insights</h2>
        <span>Across {jdCards.length} analyzed JDs</span>
      </div>
      <div className="fc-stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 32 }}>
        <div className="fc-card fc-card--pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <TrendingUp size={18} color="var(--accent)" />
            </span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Top Skills Across Analyzed JDs</h3>
          </div>
          <ResponsiveContainer width="100%" height={172}>
            <BarChart data={topSkillsData} layout="vertical" margin={{ left: 4, right: 8, top: 2, bottom: 2 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="skill" type="category" tick={axisTick} axisLine={false} tickLine={false} width={94} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent-soft)' }} formatter={(v: unknown) => [`${v} JDs`, 'Appearances']} />
              <Bar dataKey="count" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={13} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="fc-card fc-card--pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚠️</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Skills You&apos;re Missing Most Often</h3>
          </div>
          <ResponsiveContainer width="100%" height={172}>
            <BarChart data={missingSkillsData} layout="vertical" margin={{ left: 4, right: 8, top: 2, bottom: 2 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="skill" type="category" tick={axisTick} axisLine={false} tickLine={false} width={94} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--warning-soft)' }} formatter={(v: unknown) => [`${v} JDs`, 'Missing in']} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={13}>
                {missingSkillsData.map((_, i) => <Cell key={i} fill="var(--warning)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learning roadmap */}
      <div className="fc-card fc-card--pad">
        <div className="fc-section-title" style={{ marginBottom: 20 }}>
          <BookOpen size={17} color="var(--accent)" />
          <h2>Personalized Learning Roadmap</h2>
          <span className="fc-badge fc-badge--blue">Based on {jdCards.length} JDs</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roadmap.map(r => (
            <div key={r.skill} className="fc-panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0, border: '1px solid var(--border)' }}>
                {r.icon}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {r.priority}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)', marginBottom: 3, letterSpacing: '-0.01em' }}>{r.skill}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Est. {r.time} · Appears in {r.demand}% of JDs</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
                <div className="fc-progress" style={{ marginBottom: 7 }}>
                  <div style={{ width: `${r.demand}%`, background: r.demand >= 75 ? 'var(--success)' : r.demand >= 60 ? '#2563EB' : 'var(--warning)' }} />
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{r.demand}% demand</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
