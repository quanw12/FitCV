import { useState } from 'react'
import { MessageSquare, Clock, X, ArrowRight, Send } from 'lucide-react'

const columns = ['New', 'In Review', 'Shortlisted', 'Interview', 'Offer', 'Rejected']

const colColors: Record<string, { bg: string; text: string; dot: string }> = {
  'New': { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  'In Review': { bg: '#EEF2FF', text: '#3730A3', dot: '#4F46E5' },
  'Shortlisted': { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  'Interview': { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  'Offer': { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  'Rejected': { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
}

const initialCards: Record<string, Array<{ id: number; name: string; score: number; position: string; comments: number; initials: string }>> = {
  'New': [
    { id: 1, name: 'Nguyen Thanh Minh', score: 92, position: 'Senior Backend Dev', comments: 0, initials: 'NM' },
    { id: 2, name: 'Tran Phuong Linh', score: 85, position: 'Senior Backend Dev', comments: 1, initials: 'TL' },
  ],
  'In Review': [
    { id: 3, name: 'Le Duc Anh', score: 78, position: 'Product Designer', comments: 2, initials: 'LA' },
  ],
  'Shortlisted': [
    { id: 4, name: 'Hoang Thi Bich', score: 71, position: 'Data Analyst', comments: 3, initials: 'HB' },
    { id: 5, name: 'Vu Manh Tuan', score: 69, position: 'Senior Backend Dev', comments: 1, initials: 'VT' },
  ],
  'Interview': [
    { id: 6, name: 'Pham Van Khai', score: 88, position: 'Frontend Developer', comments: 4, initials: 'PK' },
  ],
  'Offer': [
    { id: 7, name: 'Do Thi Lan', score: 91, position: 'Senior Backend Dev', comments: 2, initials: 'DL' },
  ],
  'Rejected': [
    { id: 8, name: 'Bui Thanh Hoa', score: 38, position: 'Data Analyst', comments: 0, initials: 'BH' },
  ],
}

export default function PipelineScreen() {
  const [cards, setCards] = useState(initialCards)
  const [modal, setModal] = useState<typeof initialCards['New'][0] | null>(null)
  const [note, setNote] = useState('')

  const getScoreColor = (score: number) => score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'

  const moveCard = (card: typeof initialCards['New'][0], fromCol: string, toCol: string) => {
    setCards(prev => {
      const from = prev[fromCol].filter(c => c.id !== card.id)
      const to = [...prev[toCol], card]
      return { ...prev, [fromCol]: from, [toCol]: to }
    })
    setModal(null)
  }

  const currentCol = modal ? Object.keys(cards).find(col => cards[col].some(c => c.id === modal.id)) ?? '' : ''
  const nextCol = currentCol ? columns[columns.indexOf(currentCol) + 1] : ''

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Candidate Pipeline</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Drag candidates through your hiring stages.</p>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {columns.map(col => {
          const cc = colColors[col]
          const colCards = cards[col] || []
          return (
            <div key={col} style={{ minWidth: 200, flex: '0 0 200px' }}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 4px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cc.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{col}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: cc.text, background: cc.bg, padding: '2px 8px', borderRadius: 20 }}>{colCards.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                {colCards.map(card => {
                  const scoreColor = getScoreColor(card.score)
                  return (
                    <div
                      key={card.id}
                      onClick={() => setModal(card)}
                      style={{
                        background: 'white', borderRadius: 12, padding: '14px 14px',
                        border: '1px solid var(--border)', cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseOut={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${scoreColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
                          {card.initials}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{card.position}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor, fontFamily: 'Plus Jakarta Sans' }}>{card.score}%</span>
                        {card.comments > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                            <MessageSquare size={11} /> {card.comments}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24, backdropFilter: 'blur(4px)' }}>
          <div className="fitcv-card" style={{ width: '100%', maxWidth: 520, padding: 28, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Candidate Detail</h3>
              <button onClick={() => setModal(null)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'white' }}>
                {modal.initials}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{modal.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{modal.position}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 24, fontWeight: 800, color: getScoreColor(modal.score), fontFamily: 'Plus Jakarta Sans' }}>{modal.score}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Currently in: <strong>{currentCol}</strong></span>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Notes & Comments</h4>
              <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Strong Node.js background, Docker experience noted. Request technical interview.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..."
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'Inter', outline: 'none', background: 'var(--bg)' }} />
                <button style={{ background: 'var(--indigo)', border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer' }}>
                  <Send size={15} color="white" />
                </button>
              </div>
            </div>

            {nextCol && (
              <button
                onClick={() => moveCard(modal, currentCol, nextCol)}
                className="fitcv-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Move to {nextCol} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
