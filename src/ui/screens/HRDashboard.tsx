import { Briefcase, FileText, TrendingUp, Upload, Plus, ArrowRight, Star, BarChart3 } from 'lucide-react'
import type { ScreenId } from '@/types/app'

interface HRDashboardProps {
  onNavigate: (screen: ScreenId) => void
}

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34 }}>
      {values.map((v, i) => (
        <div key={i} style={{ width: 7, height: `${(v / max) * 100}%`, borderRadius: 3, background: color, opacity: 0.45 + (i / values.length) * 0.55 }} />
      ))}
    </div>
  )
}

const jobPosts = [
  { title: 'Senior Backend Developer', dept: 'Engineering', cvCount: 47, avgScore: 72, progress: 68, status: 'Active' },
  { title: 'Product Designer', dept: 'Design', cvCount: 23, avgScore: 65, progress: 45, status: 'Active' },
  { title: 'Data Analyst', dept: 'Analytics', cvCount: 31, avgScore: 58, progress: 30, status: 'Active' },
  { title: 'Frontend Developer', dept: 'Engineering', cvCount: 18, avgScore: 79, progress: 90, status: 'Active' },
]

const scoreColor = (s: number) => (s >= 70 ? '#16A34A' : s >= 60 ? '#2563EB' : '#D97706')

export default function HRDashboard({ onNavigate }: HRDashboardProps) {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <h1>HR Dashboard</h1>
          <p>TechViet Solutions · Recruitment overview</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="fc-btn fc-btn--secondary" onClick={() => onNavigate('cv-ranking')}><Upload size={15} /> Upload CVs</button>
          <button className="fc-btn fc-btn--primary" onClick={() => onNavigate('job-posts')}><Plus size={15} /> Create Job Post</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Active Job Posts', value: '4', icon: <Briefcase size={18} />, color: '#2563EB', soft: 'var(--accent-soft)', delta: '+1 this week', spark: [2, 3, 3, 4] },
          { label: 'Total CVs Reviewed', value: '119', icon: <FileText size={18} />, color: '#16A34A', soft: 'var(--success-soft)', delta: '+23 today', spark: [60, 78, 91, 119] },
          { label: 'Avg. Candidate Score', value: '68%', icon: <Star size={18} />, color: '#D97706', soft: 'var(--warning-soft)', delta: '+4pts vs last mo.', spark: [60, 62, 65, 68] },
          { label: 'Review Progress', value: '58%', icon: <TrendingUp size={18} />, color: '#64748B', soft: 'var(--gray-soft)', delta: '3 posts active', spark: [30, 42, 51, 58] },
        ].map(s => (
          <div key={s.label} className="fc-stat" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="fc-stat__icon" style={{ background: s.soft, color: s.color }}>{s.icon}</div>
              <MiniBars values={s.spark} color={s.color} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="fc-stat__value" style={{ fontSize: 28 }}>{s.value}</div>
              <div className="fc-stat__label">{s.label}</div>
              <div className="fc-stat__delta" style={{ color: s.color, marginTop: 6 }}>{s.delta}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Active job posts table */}
      <div className="fc-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="fc-section-title">
            <BarChart3 size={17} color="var(--accent)" />
            <h3>Active Job Posts</h3>
          </div>
          <button onClick={() => onNavigate('job-posts')} className="fc-chip" style={{ cursor: 'pointer', border: 'none' }}>
            View all <ArrowRight size={13} />
          </button>
        </div>
        <table className="fc-table">
          <thead>
            <tr>
              {['Job Title', 'Department', 'CVs', 'Avg. Score', 'Review Progress', 'Action'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobPosts.map((job, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{job.title}</div>
                </td>
                <td><span className="fc-badge fc-badge--blue">{job.dept}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{job.cvCount}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>CVs</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: scoreColor(job.avgScore) }}>{job.avgScore}%</span>
                </td>
                <td style={{ minWidth: 170 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className="fc-progress" style={{ flex: 1 }}>
                      <div style={{ width: `${job.progress}%`, background: job.progress >= 80 ? 'var(--success)' : 'var(--accent)' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', width: 38 }}>{job.progress}%</span>
                  </div>
                </td>
                <td>
                  <button onClick={() => onNavigate('cv-ranking')} className="fc-chip" style={{ cursor: 'pointer', border: 'none', color: 'var(--accent-ink)', background: 'var(--accent-soft)' }}>
                    View CVs <ArrowRight size={13} />
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
