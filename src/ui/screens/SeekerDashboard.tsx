import { Trophy, TrendingUp, FileText, CheckSquare, Plus, ArrowRight, Clock, Zap } from 'lucide-react'
import ScoreRing from '../components/ScoreRing'

interface SeekerDashboardProps {
  onNavigate: (screen: string) => void
}

const recentActivity = [
  { icon: <Zap size={14} />, color: '#4F46E5', text: 'Analyzed "Senior Backend Developer" at VNG Corp', time: '2 hours ago', score: 78 },
  { icon: <TrendingUp size={14} />, color: '#10B981', text: 'Received 12 AI improvement suggestions for your CV', time: '2 hours ago' },
  { icon: <CheckSquare size={14} />, color: '#F59E0B', text: 'Added application to Shopee — Fullstack Engineer', time: '1 day ago' },
  { icon: <FileText size={14} />, color: '#6B7280', text: 'Uploaded new CV version: CV_v3_Backend.pdf', time: '3 days ago' },
]

export default function SeekerDashboard({ onNavigate }: SeekerDashboardProps) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            Welcome back, Minh 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Here&apos;s your job readiness overview for today.</p>
        </div>
        <button className="fitcv-btn-primary" onClick={() => onNavigate('analyzer')}>
          <Plus size={16} /> New Analysis
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* CVs analyzed */}
        <div className="fitcv-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="var(--indigo)" />
            </div>
            <span className="badge-green">+3 this week</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', lineHeight: 1, marginBottom: 4 }}>14</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>CVs Analyzed</div>
        </div>

        {/* Avg match score */}
        <div className="fitcv-card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
          <ScoreRing score={73} size={80} strokeWidth={8} label="Avg. Score" />
          <div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Average Match Score</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Across 14 analyses</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <TrendingUp size={13} color="#10B981" />
              <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>+8pts from last month</span>
            </div>
          </div>
        </div>

        {/* Applications tracked */}
        <div className="fitcv-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={18} color="#10B981" />
            </div>
            <span className="badge-amber">2 pending</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', lineHeight: 1, marginBottom: 4 }}>7</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Applications Tracked</div>
        </div>
      </div>

      {/* Banner card */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Trophy size={24} color="#FCD34D" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 4 }}>
            🎉 Your CV is in the top 20% for Backend Developer roles
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            Based on 847 CVs analyzed in this category this month. Keep improving!
          </div>
        </div>
        <button
          onClick={() => onNavigate('analyzer')}
          style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, backdropFilter: 'blur(4px)',
          }}
        >
          Continue <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Recent activity */}
        <div className="fitcv-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Activity</h3>
            <button style={{ fontSize: 13, color: 'var(--indigo)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 16, marginBottom: 16, borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                    {item.icon}
                  </div>
                  {i < recentActivity.length - 1 && (
                    <div style={{ position: 'absolute', left: '50%', top: 36, width: 1, height: 'calc(100% + 16px)', background: 'var(--border)', transform: 'translateX(-50%)' }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>{item.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.time}</span>
                    {item.score && <span className="badge-indigo">{item.score}% match</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="fitcv-btn-primary" onClick={() => onNavigate('analyzer')} style={{ width: '100%', justifyContent: 'center' }}>
            <Zap size={15} /> Continue Last Analysis
          </button>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fitcv-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Quick Actions</h3>
            {[
              { label: 'Analyze new JD', screen: 'analyzer', icon: <Zap size={15} />, color: '#4F46E5' },
              { label: 'View improvement tips', screen: 'improvement', icon: <TrendingUp size={15} />, color: '#10B981' },
              { label: 'Track application', screen: 'app-tracker', icon: <CheckSquare size={15} />, color: '#F59E0B' },
              { label: 'Browse JD library', screen: 'jd-library', icon: <FileText size={15} />, color: '#6B7280' },
            ].map(a => (
              <button
                key={a.screen}
                onClick={() => onNavigate(a.screen)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2,
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: a.color }}>{a.icon}</span>
                {a.label}
                <ArrowRight size={13} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
              </button>
            ))}
          </div>

          {/* Skill improvement nudge */}
          <div className="fitcv-card" style={{ padding: 20, background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Top skill gap this week</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['Docker', 'Kubernetes', 'Redis'].map(s => (
                <span key={s} className="badge-amber">{s}</span>
              ))}
            </div>
            <button onClick={() => onNavigate('improvement')} style={{ fontSize: 13, color: '#92400E', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              See learning roadmap <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
