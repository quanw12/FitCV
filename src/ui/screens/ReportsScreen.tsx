import { Download, Calendar, TrendingUp, PieChart as PieIcon, BarChart3, Activity } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const applicationsOverTime = [
  { month: 'Jan', count: 12 }, { month: 'Feb', count: 18 }, { month: 'Mar', count: 24 },
  { month: 'Apr', count: 19 }, { month: 'May', count: 31 }, { month: 'Jun', count: 45 }, { month: 'Jul', count: 29 },
]

const passRateData = [
  { name: 'Passed Screening', value: 68, color: '#10B981' },
  { name: 'Not Passed', value: 32, color: '#F3F4F6' },
]

const scoreDistribution = [
  { range: '90-100%', count: 8 },
  { range: '80-89%', count: 19 },
  { range: '70-79%', count: 32 },
  { range: '60-69%', count: 28 },
  { range: '50-59%', count: 17 },
  { range: '<50%', count: 15 },
]

const sourceBreakdown = [
  { source: 'LinkedIn', count: 52 },
  { source: 'TopCV', count: 31 },
  { source: 'Referral', count: 18 },
  { source: 'Company Website', count: 12 },
  { source: 'Other', count: 6 },
]

const kpis = [
  { label: 'Avg. Time-to-Shortlist', value: '3.2 days', icon: '⚡', color: '#4F46E5', bg: '#EEF2FF', delta: '−11% vs last mo.' },
  { label: 'Avg. Time-to-Hire', value: '18 days', icon: '📅', color: '#10B981', bg: '#D1FAE5', delta: '−2 days' },
  { label: 'Offer Acceptance Rate', value: '87%', icon: '🤝', color: '#F59E0B', bg: '#FEF3C7', delta: '+5% MoM' },
  { label: 'Active Job Posts', value: '4', icon: '📋', color: '#6B7280', bg: '#F3F4F6', delta: '+1 this week' },
]

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 13,
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-md)',
}

export default function ReportsScreen() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>HR · Performance</div>
          <h1>Reports &amp; Analytics</h1>
          <p>Recruitment performance overview for TechViet Solutions.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="fc-btn fc-btn--secondary">
            <Calendar size={15} /> Jul 2025
          </button>
          <button className="fc-btn fc-btn--primary">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} className="fc-stat">
            <div className="fc-stat__icon" style={{ background: k.bg, color: k.color, fontSize: 18 }}>{k.icon}</div>
            <div style={{ marginTop: 14 }}>
              <div className="fc-stat__value">{k.value}</div>
              <div className="fc-stat__label">{k.label}</div>
              <div className="fc-stat__delta" style={{ color: k.color, marginTop: 8 }}>{k.delta}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 2x2 chart grid */}
      <div className="fc-stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        {/* Line — applications over time */}
        <div className="fc-card fc-card--pad">
          <div className="fc-section-title" style={{ marginBottom: 16 }}>
            <TrendingUp size={17} color="var(--accent)" />
            <h3>Applications Over Time</h3>
            <span>Last 7 months</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={applicationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border)' }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--accent)"
                strokeWidth={3}
                dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — pass rate */}
        <div className="fc-card fc-card--pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="fc-section-title" style={{ marginBottom: 16 }}>
            <PieIcon size={17} color="var(--accent)" />
            <h3>Screening Pass Rate</h3>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <PieChart width={160} height={160}>
                <Pie data={passRateData} cx={75} cy={75} innerRadius={48} outerRadius={68} dataKey="value" startAngle={90} endAngle={-270} stroke="var(--surface)" strokeWidth={2}>
                  {passRateData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>68%</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pass Rate</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Passed — <strong style={{ color: 'var(--text-primary)' }}>68%</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gray-soft)', border: '1px solid var(--border)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Not Passed — <strong style={{ color: 'var(--text-primary)' }}>32%</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Bar — score distribution */}
        <div className="fc-card fc-card--pad">
          <div className="fc-section-title" style={{ marginBottom: 16 }}>
            <BarChart3 size={17} color="var(--accent)" />
            <h3>Score Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent-soft)' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={28}>
                {scoreDistribution.map((entry, i) => {
                  const fill = entry.range.startsWith('9') || entry.range.startsWith('8')
                    ? 'var(--success)'
                    : entry.range.startsWith('7') || entry.range.startsWith('6')
                      ? 'var(--accent)'
                      : 'var(--danger)'
                  return <Cell key={i} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal bar — source breakdown */}
        <div className="fc-card fc-card--pad">
          <div className="fc-section-title" style={{ marginBottom: 16 }}>
            <Activity size={17} color="var(--accent)" />
            <h3>Source Breakdown</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sourceBreakdown} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 13, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent-soft)' }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
