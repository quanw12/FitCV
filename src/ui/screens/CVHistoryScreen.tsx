import { useState } from 'react'
import { Upload, FileText, GitCompare, TrendingUp, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const cvVersions = [
  { id: 1, name: 'CV_v1_General.pdf', date: 'Jan 15, 2025', score: 55, size: '245 KB', role: 'General' },
  { id: 2, name: 'CV_v2_Marketing.pdf', date: 'Feb 10, 2025', score: 63, size: '268 KB', role: 'Marketing' },
  { id: 3, name: 'CV_v3_Backend.pdf', date: 'Mar 22, 2025', score: 72, size: '291 KB', role: 'Backend' },
  { id: 4, name: 'CV_v4_Dev_latest.pdf', date: 'Jun 30, 2025', score: 78, size: '310 KB', role: 'Backend Dev' },
]

const chartData = [
  { version: 'v1', score: 55, date: 'Jan' },
  { version: 'v2', score: 63, date: 'Feb' },
  { version: 'v3', score: 72, date: 'Mar' },
  { version: 'v4', score: 78, date: 'Jun' },
]

export default function CVHistoryScreen() {
  const [selected, setSelected] = useState<number[]>([])
  const [comparing, setComparing] = useState(false)

  const toggleSelect = (id: number) => {
    if (selected.includes(id)) {
      setSelected(p => p.filter(x => x !== id))
    } else if (selected.length < 2) {
      setSelected(p => [...p, id])
    }
  }

  const compareItems = cvVersions.filter(v => selected.includes(v.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>CV History</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Track your progress across different CV versions.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selected.length === 2 && (
            <button className="fitcv-btn-secondary" onClick={() => setComparing(!comparing)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitCompare size={15} /> {comparing ? 'Hide' : 'Compare'} Versions
            </button>
          )}
          <button className="fitcv-btn-primary">
            <Upload size={15} /> Upload New Version
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="fitcv-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Score Improvement Over Time</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} color="#10B981" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#10B981' }}>+23pts total improvement</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis domain={[40, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13 }}
              formatter={(v: unknown) => [`${v}%`, 'Match Score']}
            />
            <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} dot={{ r: 5, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CV grid */}
      {selected.length > 0 && selected.length < 2 && (
        <div style={{ padding: '10px 16px', background: 'var(--indigo-light)', borderRadius: 10, marginBottom: 14, fontSize: 13, color: 'var(--indigo)', fontWeight: 500 }}>
          Select one more CV to compare ({2 - selected.length} remaining)
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {cvVersions.map(cv => {
          const isSelected = selected.includes(cv.id)
          const scoreColor = cv.score >= 75 ? '#10B981' : cv.score >= 60 ? '#4F46E5' : '#F59E0B'
          const latestTag = cv.id === Math.max(...cvVersions.map(v => v.id))
          return (
            <div
              key={cv.id}
              onClick={() => toggleSelect(cv.id)}
              style={{
                padding: 20, borderRadius: 16, border: `2px solid ${isSelected ? 'var(--indigo)' : 'var(--border)'}`,
                background: isSelected ? 'var(--indigo-light)' : 'white', cursor: 'pointer',
                transition: 'all 0.15s', position: 'relative',
              }}
            >
              {latestTag && (
                <span className="badge-green" style={{ position: 'absolute', top: 12, right: 12, fontSize: 10 }}>Latest</span>
              )}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${scoreColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <FileText size={22} color={scoreColor} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{cv.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                <Calendar size={11} /> {cv.date} · {cv.size}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Match Score</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor, fontFamily: 'Plus Jakarta Sans' }}>{cv.score}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden', marginTop: 8 }}>
                <div style={{ width: `${cv.score}%`, height: '100%', background: scoreColor, borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparison panel */}
      {comparing && compareItems.length === 2 && (
        <div className="fitcv-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Version Comparison</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {compareItems.map(cv => (
              <div key={cv.id}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--indigo)" /> {cv.name}
                </div>
                {[
                  { label: 'Overall Score', value: `${cv.score}%`, color: cv.score >= 75 ? '#10B981' : '#F59E0B' },
                  { label: 'Upload Date', value: cv.date, color: 'var(--text-primary)' },
                  { label: 'Target Role', value: cv.role, color: 'var(--indigo)' },
                  { label: 'File Size', value: cv.size, color: 'var(--text-secondary)' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {compareItems[1].score > compareItems[0].score && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, fontSize: 14, color: '#065F46', fontWeight: 500 }}>
              🎉 {compareItems[1].name} is <strong>{compareItems[1].score - compareItems[0].score} points higher</strong> than {compareItems[0].name}. Great progress!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
