import { Trophy, TrendingUp, FileText, CheckSquare, Plus, ArrowRight, Clock, Zap, Sparkles } from 'lucide-react'
import ScoreRing from '../components/ScoreRing'
import type { ScreenId } from '@/types/app'

interface SeekerDashboardProps {
  onNavigate: (screen: ScreenId) => void
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 120
  const h = 36
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = w / (points.length - 1)
  const coords = points.map((p, i) => [i * step, h - ((p - min) / span) * (h - 6) - 3])
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sl-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sl-${color.replace('#', '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const recentActivity = [
  { icon: <Zap size={14} />, color: '#2563EB', text: 'Analyzed "Senior Backend Developer" at VNG Corp', time: '2 hours ago', score: 78 },
  { icon: <TrendingUp size={14} />, color: '#16A34A', text: 'Received 12 AI improvement suggestions for your CV', time: '2 hours ago' },
  { icon: <CheckSquare size={14} />, color: '#D97706', text: 'Added application to Shopee — Fullstack Engineer', time: '1 day ago' },
  { icon: <FileText size={14} />, color: '#64748B', text: 'Uploaded new CV version: CV_v3_Backend.pdf', time: '3 days ago' },
]

export default function SeekerDashboard({ onNavigate }: SeekerDashboardProps) {
  return (
    <div className="fc-stagger">
      {/* Page head */}
      <div className="fc-page-head">
        <div>
          <h1>Welcome back, Minh 👋</h1>
          <p>Here&apos;s your job readiness overview for today.</p>
        </div>
        <button className="fc-btn fc-btn--primary" onClick={() => onNavigate('analyzer')}>
          <Plus size={16} /> New Analysis
        </button>
      </div>

      {/* Bento grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Avg match — feature card */}
        <div className="fc-card fc-card--pad" style={{ display: 'flex', alignItems: 'center', gap: 20, gridRow: 'span 1' }}>
          <ScoreRing score={73} size={104} strokeWidth={11} label="Avg. Score" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fc-eyebrow" style={{ marginBottom: 6 }}>Average Match Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>+8pts from last month</span>
              <span className="fc-badge fc-badge--green"><TrendingUp size={12} /> Trending</span>
            </div>
            <Sparkline points={[55, 58, 61, 60, 66, 69, 73]} color="#2563EB" />
          </div>
        </div>

        {/* CVs analyzed */}
        <div className="fc-stat">
          <div className="fc-stat__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><FileText size={18} color="var(--accent)" /></div>
          <div style={{ marginTop: 14 }}>
            <div className="fc-stat__value">14</div>
            <div className="fc-stat__label">CVs Analyzed</div>
            <div className="fc-stat__delta" style={{ color: 'var(--success)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={13} /> +3 this week</div>
          </div>
        </div>

        {/* Applications tracked */}
        <div className="fc-stat">
          <div className="fc-stat__icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><CheckSquare size={18} color="var(--success)" /></div>
          <div style={{ marginTop: 14 }}>
            <div className="fc-stat__value">7</div>
            <div className="fc-stat__label">Applications Tracked</div>
            <div className="fc-stat__delta" style={{ color: 'var(--warning)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> 2 pending review</div>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="fc-card" style={{
        background: 'linear-gradient(120deg, #0B1020 0%, #161D33 60%, #1E2742 100%)',
        color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 18, padding: '20px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <div className="fc-glow" style={{ width: 280, height: 280, top: -90, right: -40 }} />
        <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backdropFilter: 'blur(6px)' }}>
          <Trophy size={26} color="#FCD34D" />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
            🎉 Your CV is in the top 20% for Backend Developer roles
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            Based on 847 CVs analyzed in this category this month. Keep improving!
          </div>
        </div>
        <button
          onClick={() => onNavigate('analyzer')}
          style={{
            background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 11, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, backdropFilter: 'blur(4px)', position: 'relative', zIndex: 1,
          }}
        >
          Continue <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 322px', gap: 16 }}>
        {/* Recent activity */}
        <div className="fc-card fc-card--pad">
          <div className="fc-section-title" style={{ marginBottom: 18 }}>
            <Clock size={17} color="var(--accent)" />
            <h3>Recent Activity</h3>
            <button style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 16, marginBottom: 16, borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 11, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                    {item.icon}
                  </div>
                  {i < recentActivity.length - 1 && (
                    <div style={{ position: 'absolute', left: '50%', top: 40, width: 1, height: 'calc(100% + 16px)', background: 'var(--border)', transform: 'translateX(-50%)' }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>{item.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.time}</span>
                    {item.score && <span className="fc-badge fc-badge--blue">{item.score}% match</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="fc-btn fc-btn--primary" onClick={() => onNavigate('analyzer')} style={{ width: '100%', justifyContent: 'center' }}>
            <Zap size={15} /> Continue Last Analysis
          </button>
        </div>

        {/* Quick links + skill nudge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="fc-card fc-card--pad">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Quick Actions</h3>
            {([
              { label: 'Analyze new JD', screen: 'analyzer', icon: <Zap size={15} />, color: '#2563EB' },
              { label: 'View improvement tips', screen: 'improvement', icon: <TrendingUp size={15} />, color: '#16A34A' },
              { label: 'Track application', screen: 'app-tracker', icon: <CheckSquare size={15} />, color: '#D97706' },
              { label: 'Browse JD library', screen: 'jd-library', icon: <FileText size={15} />, color: '#64748B' },
            ] as const).map(a => (
              <button
                key={a.screen}
                onClick={() => onNavigate(a.screen)}
                className="fc-navitem"
                style={{ width: '100%', padding: '11px 12px', gap: 11, color: 'var(--text-primary)', marginBottom: 3, fontWeight: 500 }}
              >
                <span style={{ color: a.color, display: 'flex' }}>{a.icon}</span>
                {a.label}
                <ArrowRight size={13} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
              </button>
            ))}
          </div>

          <div className="fc-card fc-card--pad" style={{ background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}><Sparkles /></span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)' }}>Top skill gap this week</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['Docker', 'Kubernetes', 'Redis'].map(s => (
                <span key={s} className="fc-badge fc-badge--amber">{s}</span>
              ))}
            </div>
            <button onClick={() => onNavigate('improvement')} style={{ fontSize: 13, color: 'var(--accent-ink)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              See learning roadmap <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
