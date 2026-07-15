import { Briefcase, FileText, TrendingUp, Upload, Plus, ArrowRight, Star } from 'lucide-react'
import type { ScreenId } from '@/types/app'

interface HRDashboardProps {
  onNavigate: (screen: ScreenId) => void
}

const jobPosts = [
  { title: 'Senior Backend Developer', dept: 'Engineering', cvCount: 47, avgScore: 72, progress: 68, status: 'Active' },
  { title: 'Product Designer', dept: 'Design', cvCount: 23, avgScore: 65, progress: 45, status: 'Active' },
  { title: 'Data Analyst', dept: 'Analytics', cvCount: 31, avgScore: 58, progress: 30, status: 'Active' },
  { title: 'Frontend Developer', dept: 'Engineering', cvCount: 18, avgScore: 79, progress: 90, status: 'Active' },
]

export default function HRDashboard({ onNavigate }: HRDashboardProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>HR Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>TechViet Solutions · Recruitment Overview</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="fitcv-btn-secondary" onClick={() => onNavigate('cv-ranking')}><Upload size={15} /> Upload CVs</button>
          <button className="fitcv-btn-primary" onClick={() => onNavigate('job-posts')}><Plus size={15} /> Create Job Post</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Active Job Posts', value: '4', icon: <Briefcase size={18} />, color: '#4F46E5', bg: '#EEF2FF', delta: '+1 this week' },
          { label: 'Total CVs Reviewed', value: '119', icon: <FileText size={18} />, color: '#10B981', bg: '#D1FAE5', delta: '+23 today' },
          { label: 'Avg. Candidate Score', value: '68%', icon: <Star size={18} />, color: '#F59E0B', bg: '#FEF3C7', delta: '+4pts vs last month' },
          { label: 'Review Progress', value: '58%', icon: <TrendingUp size={18} />, color: '#6B7280', bg: '#F3F4F6', delta: '3 posts active' },
        ].map(s => (
          <div key={s.label} className="fitcv-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                {s.icon}
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Active job posts table */}
      <div className="fitcv-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Active Job Posts</h3>
          <button onClick={() => onNavigate('job-posts')} style={{ fontSize: 13, color: 'var(--indigo)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            View all <ArrowRight size={13} />
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Job Title', 'Department', 'CVs', 'Avg. Score', 'Review Progress', 'Action'].map(h => (
                <th key={h} style={{ padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobPosts.map((job, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseOut={e => (e.currentTarget.style.background = 'white')}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{job.title}</div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span className="badge-indigo">{job.dept}</span>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>{job.cvCount}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>CVs</span>
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Plus Jakarta Sans', color: job.avgScore >= 70 ? '#10B981' : job.avgScore >= 60 ? '#4F46E5' : '#F59E0B' }}>{job.avgScore}%</span>
                </td>
                <td style={{ padding: '16px 20px', minWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                      <div style={{ width: `${job.progress}%`, height: '100%', background: job.progress >= 80 ? '#10B981' : '#4F46E5', borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', width: 36 }}>{job.progress}%</span>
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <button onClick={() => onNavigate('cv-ranking')} style={{ fontSize: 13, color: 'var(--indigo)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
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
