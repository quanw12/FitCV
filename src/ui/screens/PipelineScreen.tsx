import { useState } from 'react'
import { MessageSquare, Clock, X, ArrowRight, Send } from 'lucide-react'

const columns = ['New', 'In Review', 'Shortlisted', 'Interview', 'Offer', 'Rejected']

const colColors: Record<string, { bg: string; text: string; dot: string }> = {
  'New': { bg: 'var(--gray-soft)', text: 'var(--text-secondary)', dot: 'var(--text-muted)' },
  'In Review': { bg: 'var(--accent-soft)', text: 'var(--accent-ink)', dot: 'var(--accent)' },
  'Shortlisted': { bg: 'var(--success-soft)', text: 'var(--success)', dot: 'var(--success)' },
  'Interview': { bg: 'var(--warning-soft)', text: '#92400e', dot: 'var(--warning)' },
  'Offer': { bg: 'var(--success-soft)', text: 'var(--success)', dot: 'var(--success)' },
  'Rejected': { bg: 'var(--danger-soft)', text: 'var(--danger)', dot: 'var(--danger)' },
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

  const getScoreColor = (score: number) =>
    score >= 80
      ? { color: 'var(--success)', soft: 'var(--success-soft)' }
      : score >= 50
        ? { color: 'var(--warning)', soft: 'var(--warning-soft)' }
        : { color: 'var(--danger)', soft: 'var(--danger-soft)' }

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
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>Hiring Pipeline</div>
          <h1>Candidate Pipeline</h1>
          <p>Drag candidates through your hiring stages.</p>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12 }}>
        {columns.map(col => {
          const cc = colColors[col]
          const colCards = cards[col] || []
          return (
            <div key={col} style={{ minWidth: 210, flex: '0 0 210px' }}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 2px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc.dot, flexShrink: 0 }} />
                <span className="fc-eyebrow">{col}</span>
                <span className="fc-badge fc-badge--gray" style={{ marginLeft: 'auto' }}>{colCards.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120 }}>
                {colCards.map(card => {
                  const scoreColor = getScoreColor(card.score)
                  return (
                    <div
                      key={card.id}
                      onClick={() => setModal(card)}
                      className="fc-card fc-card--lift"
                      style={{
                        borderRadius: 'var(--r-md)',
                        padding: '14px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: scoreColor.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: scoreColor.color, flexShrink: 0 }}>
                          {card.initials}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{card.position}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor.color, fontFamily: 'var(--font-display)' }}>{card.score}%</span>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 16, 32, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="fc-card fc-card--pad" style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', animation: 'fc-pop 0.16s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Candidate Detail</h3>
              <button onClick={() => setModal(null)} className="fc-icon-btn" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {modal.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{modal.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{modal.position}</div>
              </div>
              <span style={{ fontSize: 24, fontWeight: 800, color: getScoreColor(modal.score).color, fontFamily: 'var(--font-display)' }}>{modal.score}%</span>
            </div>

            <div className="fc-panel" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20 }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Currently in: <strong style={{ color: 'var(--text-primary)' }}>{currentCol}</strong></span>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Notes &amp; Comments</h4>
              <div style={{ padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Strong Node.js background, Docker experience noted. Request technical interview.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note..."
                  className="fc-input"
                  style={{ fontStyle: 'normal' }}
                />
                <button className="fc-btn fc-btn--primary" aria-label="Send note">
                  <Send size={15} />
                </button>
              </div>
            </div>

            {nextCol && (
              <button
                onClick={() => moveCard(modal, currentCol, nextCol)}
                className="fc-btn fc-btn--primary"
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
