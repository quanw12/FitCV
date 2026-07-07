import { Calendar, TrendingUp, BookOpen } from 'lucide-react'
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

export default function JDLibraryScreen() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>JD Library & Market Insights</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Browse your analyzed job descriptions and discover market trends.</p>
      </div>

      {/* JD grid */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Analyzed Job Descriptions</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {jdCards.map((jd, i) => {
          const sc = jd.score >= 75 ? { color: '#10B981', bg: '#D1FAE5' } : jd.score >= 60 ? { color: '#4F46E5', bg: '#EEF2FF' } : { color: '#F59E0B', bg: '#FEF3C7' }
          return (
            <div key={i} className="fitcv-card" style={{ padding: 18, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')}
              onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: sc.color }}>
                  {jd.company[0]}
                </div>
                <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{jd.score}%</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{jd.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{jd.company}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {jd.tags.map(t => <span key={t} className="badge-indigo" style={{ fontSize: 11 }}>{t}</span>)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                <Calendar size={10} /> {jd.date}
              </div>
            </div>
          )
        })}
      </div>

      {/* Market insights */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Market Insights</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="fitcv-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={18} color="var(--indigo)" />
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Top Skills Across Analyzed JDs</h4>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={topSkillsData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="skill" type="category" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }} formatter={(v: unknown) => [`${v} JDs`, 'Appearances']} />
              <Bar dataKey="count" fill="#4F46E5" radius={[0, 6, 6, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="fitcv-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Skills You&apos;re Missing Most Often</h4>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={missingSkillsData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="skill" type="category" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }} formatter={(v: unknown) => [`${v} JDs`, 'Missing in']} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={12}>
                {missingSkillsData.map((_, i) => <Cell key={i} fill="#F59E0B" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learning roadmap */}
      <div className="fitcv-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <BookOpen size={18} color="var(--indigo)" />
          <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Personalized Learning Roadmap</h4>
          <span className="badge-indigo" style={{ marginLeft: 'auto' }}>Based on 6 JDs</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {roadmap.map(r => (
            <div key={r.skill} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg)', borderRadius: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, border: '1px solid var(--border)' }}>
                {r.icon}
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                {r.priority}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{r.skill}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Est. {r.time} · Appears in {r.demand}% of JDs</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ height: 6, width: 80, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                  <div style={{ width: `${r.demand}%`, height: '100%', background: '#F59E0B', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>{r.demand}% demand</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
