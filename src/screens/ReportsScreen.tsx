import { Download, Calendar } from 'lucide-react'
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
  { label: 'Avg. Time-to-Shortlist', value: '3.2 days', icon: '⚡', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Avg. Time-to-Hire', value: '18 days', icon: '📅', color: '#10B981', bg: '#D1FAE5' },
  { label: 'Offer Acceptance Rate', value: '87%', icon: '🤝', color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Active Job Posts', value: '4', icon: '📋', color: '#6B7280', bg: '#F3F4F6' },
]

export default function ReportsScreen() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Recruitment performance overview for TechViet Solutions.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="fitcv-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} /> Jul 2025
          </button>
          <button className="fitcv-btn-primary" style={{ gap: 6 }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} className="fitcv-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {k.icon}
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: 'Plus Jakarta Sans', lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 2x2 chart grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Line — applications over time */}
        <div className="fitcv-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Applications Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={applicationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13 }} />
              <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — pass rate */}
        <div className="fitcv-card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Screening Pass Rate</h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <PieChart width={160} height={160}>
                <Pie data={passRateData} cx={75} cy={75} innerRadius={48} outerRadius={68} dataKey="value" startAngle={90} endAngle={-270}>
                  {passRateData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#10B981', fontFamily: 'Plus Jakarta Sans', lineHeight: 1 }}>68%</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pass Rate</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Passed — <strong>68%</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F3F4F6', border: '1px solid #E5E7EB' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Not Passed — <strong>32%</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Bar — score distribution */}
        <div className="fitcv-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={28}>
                {scoreDistribution.map((entry, i) => {
                  const fill = entry.range.startsWith('9') || entry.range.startsWith('8') ? '#10B981' : entry.range.startsWith('7') || entry.range.startsWith('6') ? '#4F46E5' : '#EF4444'
                  return <Cell key={i} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal bar — source breakdown */}
        <div className="fitcv-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Source Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sourceBreakdown} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 13, fill: '#6B7280' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13 }} />
              <Bar dataKey="count" fill="#4F46E5" radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
