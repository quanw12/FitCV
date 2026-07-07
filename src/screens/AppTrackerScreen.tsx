import { useState } from 'react'
import { Plus, Search, ExternalLink, Clock, MessageSquare } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const applications = [
  { id: 1, company: 'VNG Corporation', position: 'Senior Backend Developer', date: 'Jun 28, 2025', source: 'LinkedIn', status: 'Interview', stale: false, notes: 2 },
  { id: 2, company: 'Shopee Vietnam', position: 'Fullstack Engineer', date: 'Jun 20, 2025', source: 'TopCV', status: 'Screening', stale: false, notes: 0 },
  { id: 3, company: 'MoMo Payment', position: 'Backend Developer', date: 'Jun 5, 2025', source: 'Referral', status: 'Applied', stale: true, notes: 1 },
  { id: 4, company: 'Tiki E-commerce', position: 'Node.js Developer', date: 'May 28, 2025', source: 'LinkedIn', status: 'Rejected', stale: false, notes: 0 },
  { id: 5, company: 'Zalo (VNG)', position: 'Software Engineer', date: 'May 15, 2025', source: 'Other', status: 'Offer', stale: false, notes: 3 },
  { id: 6, company: 'KMS Technology', position: 'Java Backend Dev', date: 'Jul 1, 2025', source: 'TopCV', status: 'Applied', stale: false, notes: 0 },
]

const statusConfig: Record<string, { color: string; bg: string }> = {
  'Applied': { color: '#6B7280', bg: '#F3F4F6' },
  'Screening': { color: '#4F46E5', bg: '#EEF2FF' },
  'Interview': { color: '#F59E0B', bg: '#FEF3C7' },
  'Offer': { color: '#10B981', bg: '#D1FAE5' },
  'Rejected': { color: '#EF4444', bg: '#FEE2E2' },
}

const stageData = [
  { stage: 'Applied', count: 2 },
  { stage: 'Screening', count: 1 },
  { stage: 'Interview', count: 1 },
  { stage: 'Offer', count: 1 },
  { stage: 'Rejected', count: 1 },
]

const stageColors = ['#6B7280', '#4F46E5', '#F59E0B', '#10B981', '#EF4444']

export default function AppTrackerScreen() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = applications.filter(a => {
    const matchSearch = a.company.toLowerCase().includes(search.toLowerCase()) || a.position.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Application Tracker</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Track all your job applications in one place.</p>
        </div>
        <button className="fitcv-btn-primary"><Plus size={15} /> Add Application</button>
      </div>

      {/* Stage summary bar chart */}
      <div className="fitcv-card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Pipeline Overview</h3>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="stage" type="category" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={75} />
            <Tooltip contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
              {stageData.map((_, i) => <Cell key={i} fill={stageColors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px' }}>
          <Search size={15} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company or position..." style={{ border: 'none', background: 'transparent', fontSize: 14, outline: 'none', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                background: statusFilter === s ? 'var(--indigo)' : 'white',
                color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, outline: `1px solid ${statusFilter === s ? 'var(--indigo)' : 'var(--border)'}`,
                transition: 'all 0.15s', border: 'none',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="fitcv-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Company', 'Position', 'Date Applied', 'Source', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((app, i) => {
              const sc = statusConfig[app.status]
              return (
                <tr key={app.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'white')}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {app.company[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{app.company}</div>
                        {app.stale && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Clock size={10} color="#F59E0B" />
                            <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500 }}>No update in 30+ days</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{app.position}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{app.date}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className="badge-indigo">{app.source}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                      {app.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {app.notes > 0 && (
                        <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                          <MessageSquare size={11} /> {app.notes}
                        </button>
                      )}
                      <button style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
