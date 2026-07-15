import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckSquare, ChevronDown, ChevronUp, Clipboard, Lightbulb, RefreshCw, Square } from 'lucide-react'
import { fitcvApi } from '@/api/fitcvApi'
import type { CvSection, ImprovementReportResponse, SuggestionPriority } from '@/types/improvement'

const priorityRank: Record<SuggestionPriority, number> = { High: 0, Medium: 1, Low: 2 }
const sectionLabel: Record<CvSection, string> = {
  Summary: 'Summary', WorkExperience: 'Work Experience', Skills: 'Skills',
  Education: 'Education', Projects: 'Projects', Other: 'Other',
}

interface ImprovementScreenProps {
  matchResultId?: string | null
}

function priorityBadge(priority: SuggestionPriority): string {
  return priority === 'High' ? 'badge-red' : priority === 'Medium' ? 'badge-amber' : 'badge-indigo'
}

function scoreLabel(score: number): string {
  return score >= 80 ? 'Strong Match' : score >= 50 ? 'Moderate Match' : 'Weak Match'
}

export default function ImprovementScreen({ matchResultId = 'demo' }: ImprovementScreenProps) {
  const [response, setResponse] = useState<ImprovementReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [completedWins, setCompletedWins] = useState<Set<string>>(new Set())
  const [copyMessage, setCopyMessage] = useState<Record<string, string>>({})
  const cancelledRef = useRef(false)

  const loadReport = useCallback(async (regenerate = false) => {
    if (!matchResultId) {
      setLoading(false)
      setResponse(null)
      return
    }
    setLoading(true)
    setError(null)
    setCompletedWins(new Set())
    try {
      let current = await fitcvApi.getImprovementReport(matchResultId)
      if (current.status === 'Pending' && !current.report) {
        await fitcvApi.generateImprovementReport(matchResultId, regenerate)
      } else if (regenerate) {
        await fitcvApi.generateImprovementReport(matchResultId, true)
        current = { ...current, status: 'Pending', report: null }
      }

      for (let attempt = 0; attempt < 30 && ['Pending', 'Processing'].includes(current.status); attempt += 1) {
        if (cancelledRef.current) return
        setResponse(current)
        await new Promise(resolve => window.setTimeout(resolve, 2000))
        if (cancelledRef.current) return
        current = await fitcvApi.getImprovementReport(matchResultId)
      }
      if (['Pending', 'Processing'].includes(current.status)) throw new Error('Analysis is taking longer than expected. Please retry shortly.')
      if (current.status === 'Failed') throw new Error(current.errorMessage ?? 'AI suggestions could not be generated.')
      if (!cancelledRef.current) setResponse(current)
    } catch (caught) {
      if (!cancelledRef.current) setError(caught instanceof Error ? caught.message : 'Unable to load improvement suggestions.')
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [matchResultId])

  useEffect(() => {
    cancelledRef.current = false
    void loadReport()
    return () => { cancelledRef.current = true }
  }, [loadReport])

  const report = response?.report
  const skillGaps = useMemo(() => [...(report?.skillGaps ?? [])].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]), [report])
  const feedback = useMemo(() => [...(report?.sectionFeedback ?? [])].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]), [report])
  const rewrites = report?.rewriteSuggestions ?? []
  const quickWins = useMemo(() => [...(report?.quickWins ?? [])].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]), [report])
  const sections = useMemo(() => Array.from(new Set([...feedback.map(item => item.section), ...rewrites.map(item => item.section)])), [feedback, rewrites])

  const toggleExpanded = (id: string) => setExpanded(previous => {
    const next = new Set(previous)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleWin = (id: string) => setCompletedWins(previous => {
    const next = new Set(previous)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const copyRewrite = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMessage(previous => ({ ...previous, [id]: 'Copied' }))
    } catch {
      setCopyMessage(previous => ({ ...previous, [id]: 'Copy failed' }))
    }
    window.setTimeout(() => setCopyMessage(previous => ({ ...previous, [id]: '' })), 1800)
  }

  const isProcessing = loading || response?.status === 'Pending' || response?.status === 'Processing'

  return (
    <div className="improvement-layout">
      <aside className="fitcv-card improvement-sidebar" aria-label="Improvement report contents">
        <div className="improvement-eyebrow">Contents</div>
        <a href="#skill-gaps">Skill Gap Report</a>
        {sections.map(section => <a key={section} href={`#section-${section}`}>{sectionLabel[section]}</a>)}
        <a href="#rewrites">Rewrite Suggestions</a>
        <a href="#quick-wins">Quick Wins</a>
        {response?.overallScore != null && (
          <div className="improvement-score" aria-label={`Overall score ${response.overallScore}, ${scoreLabel(response.overallScore)}`}>
            <span>Overall Match</span><strong>{response.overallScore}%</strong>
            <small>{scoreLabel(response.overallScore)}</small>
          </div>
        )}
      </aside>

      <main className="improvement-content">
        <header className="improvement-header">
          <div>
            <h1>AI Improvement Suggestions</h1>
            <p>Prioritized recommendations for the selected CV and job description.</p>
          </div>
          {matchResultId && <button className="fitcv-btn-secondary" onClick={() => void loadReport(true)} disabled={isProcessing}><RefreshCw size={15} /> Regenerate</button>}
        </header>

        <div className="improvement-disclaimer" role="note">
          <AlertCircle size={18} aria-hidden="true" />
          <span>AI suggestions support your review and do not guarantee a hiring outcome. Verify every fact and replace placeholders only with accurate information.</span>
        </div>

        {!matchResultId && <StateCard title="No analysis selected" message="Run a CV and JD analysis, then open its improvement report." />}
        {isProcessing && <StateCard title="Generating your report" message="FitCV is reviewing skill gaps and CV sections. This can take a few moments." loading />}
        {error && <StateCard title="Suggestions unavailable" message={error} action={<button className="fitcv-btn-primary" onClick={() => void loadReport(true)}>Retry</button>} />}
        {response?.stale && <div className="improvement-warning">This report may be outdated because the CV or job description changed. Regenerate it for current advice.</div>}

        {!isProcessing && !error && report && (
          <>
            <section id="skill-gaps" className="fitcv-card improvement-section">
              <SectionTitle icon={<Lightbulb size={18} />} title="Skill Gap Report" count={skillGaps.length} />
              {skillGaps.length === 0 ? <Empty message="No clear skill gaps were found for this job description." /> : (
                <div className="improvement-list">
                  {skillGaps.map(item => (
                    <article key={item.id} className="skill-gap-item">
                      <div className="item-heading"><h3>{item.skill}</h3><span className={priorityBadge(item.priority)}>{item.priority} priority</span></div>
                      <p>{item.reason}</p><blockquote><strong>JD evidence:</strong> {item.jdEvidence}</blockquote>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="fitcv-card improvement-section">
              <SectionTitle title="Section-by-section Feedback" count={feedback.length} />
              {feedback.length === 0 ? <Empty message="No section-specific feedback is available." /> : feedback.map(item => (
                <article id={`section-${item.section}`} key={item.id} className="feedback-item">
                  <button onClick={() => toggleExpanded(item.id)} aria-expanded={expanded.has(item.id)} aria-controls={`feedback-${item.id}`}>
                    <span>{sectionLabel[item.section]} — {item.issue}</span>
                    <span className={priorityBadge(item.priority)}>{item.priority}</span>
                    {expanded.has(item.id) ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </button>
                  {expanded.has(item.id) && <div id={`feedback-${item.id}`} className="feedback-detail"><p>{item.explanation}</p><strong>Recommended action</strong><p>{item.suggestedAction}</p></div>}
                </article>
              ))}
            </section>

            <section id="rewrites" className="fitcv-card improvement-section">
              <SectionTitle title="Rewrite Suggestions" count={rewrites.length} />
              {rewrites.length === 0 ? <Empty message="No safe rewrite suggestions are available." /> : rewrites.map(item => (
                <article key={item.id} className="rewrite-item">
                  <div className="item-heading"><h3>{sectionLabel[item.section]}</h3><span>{item.framework}</span></div>
                  <p className="rewrite-issue"><strong>Issue:</strong> {item.issue}</p>
                  <div className="rewrite-grid">
                    <div><small>Before</small><p className="rewrite-before">{item.originalText}</p></div>
                    <div><small>Suggested rewrite</small><p className="rewrite-after">{item.suggestedText}</p></div>
                  </div>
                  <div className="copy-row"><button className="fitcv-btn-secondary" onClick={() => void copyRewrite(item.id, item.suggestedText)} aria-label={`Copy rewrite for ${sectionLabel[item.section]}`}><Clipboard size={14} /> Copy rewrite</button><span role="status">{copyMessage[item.id]}</span></div>
                </article>
              ))}
            </section>

            <section id="quick-wins" className="fitcv-card improvement-section">
              <SectionTitle title="Quick Wins Checklist" count={quickWins.length} />
              {quickWins.length > 0 && <><div className="quick-progress"><div style={{ width: `${(completedWins.size / quickWins.length) * 100}%` }} /></div><p className="progress-label">{completedWins.size}/{quickWins.length} completed</p></>}
              {quickWins.length === 0 ? <Empty message="No quick wins are available for this report." /> : quickWins.map(item => {
                const done = completedWins.has(item.id)
                return <button key={item.id} className={`quick-win ${done ? 'done' : ''}`} onClick={() => toggleWin(item.id)} aria-pressed={done}>
                  {done ? <CheckSquare size={19} /> : <Square size={19} />}
                  <span><strong>{item.title}</strong><small>{item.category} · {item.priority} priority — {item.explanation}</small></span>
                </button>
              })}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function SectionTitle({ title, count, icon }: { title: string; count: number; icon?: ReactNode }) {
  return <div className="section-title">{icon}<h2>{title}</h2><span>{count} items</span></div>
}

function Empty({ message }: { message: string }) {
  return <div className="improvement-empty">{message}</div>
}

function StateCard({ title, message, loading, action }: { title: string; message: string; loading?: boolean; action?: ReactNode }) {
  return <div className="fitcv-card improvement-state" role="status">{loading && <div className="state-spinner" />}<h2>{title}</h2><p>{message}</p>{action}</div>
}
