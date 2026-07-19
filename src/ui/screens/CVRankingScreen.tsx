import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  ScanText,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { applicationsApi } from '@/api/applicationsApi'
import { cvRankingApi } from '@/api/cvRankingApi'
import { jobsApi } from '@/api/jobsApi'
import type { RankedApplication, RankingBreakdown } from '@/types/cvRanking'
import type { JobPost } from '@/types/jobs'
import ScoreRing from '../components/ScoreRing'

type CvAction = 'open' | 'download'
type AnalysisState = 'Pending' | 'Processing' | 'Failed' | 'Success'

const breakdownCriteria: Array<[keyof RankingBreakdown, string]> = [
  ['skills', 'Skills'],
  ['experience', 'Experience'],
  ['education', 'Education'],
  ['soft_skills', 'Soft skills'],
]

function analysisState(value: string): AnalysisState {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'success' || normalized === 'completed' || normalized === 'ready') return 'Success'
  if (normalized === 'failed' || normalized === 'error') return 'Failed'
  if (normalized === 'processing' || normalized === 'running' || normalized === 'in_progress') return 'Processing'
  return 'Pending'
}

function scoreValue(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function percentValue(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const percentage = value > 0 && value <= 1 ? value * 100 : value
  return Math.round(Math.max(0, Math.min(100, percentage)))
}

function statusBadge(status: AnalysisState): string {
  if (status === 'Success') return 'fc-badge--green'
  if (status === 'Failed') return 'fc-badge--red'
  return 'fc-badge--amber'
}

function statusIcon(status: AnalysisState) {
  if (status === 'Success') return <CheckCircle2 size={13} />
  if (status === 'Failed') return <AlertCircle size={13} />
  if (status === 'Processing') {
    return <LoaderCircle size={13} style={{ animation: 'fc-spin .8s linear infinite' }} />
  }
  return <Clock3 size={13} />
}

function fileSizeLabel(sizeKb: number): string {
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1)} MB`
  return `${Math.max(0, Math.round(sizeKb))} KB`
}

function parsedList(parsed: Record<string, unknown> | null, keys: string[]): string[] {
  if (!parsed) return []
  for (const key of keys) {
    const value = parsed[key]
    if (Array.isArray(value)) {
      return value
        .map(item => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'name' in item) return String(item.name)
          return null
        })
        .filter((item): item is string => Boolean(item))
    }
  }
  return []
}

function parsedText(parsed: Record<string, unknown> | null, keys: string[]): string | null {
  if (!parsed) return null
  for (const key of keys) {
    const value = parsed[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

export default function CVRankingScreen() {
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [applications, setApplications] = useState<RankedApplication[]>([])
  const [selected, setSelected] = useState<RankedApplication | null>(null)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [applicationsError, setApplicationsError] = useState('')
  const [cvError, setCvError] = useState('')
  const [retryError, setRetryError] = useState('')
  const [retryingApplicationId, setRetryingApplicationId] = useState<number | null>(null)
  const [cvAction, setCvAction] = useState<{ id: number; action: CvAction } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setJobsLoading(true)
    setJobsError('')

    jobsApi
      .listManaged()
      .then(result => {
        if (!active) return
        setJobs(result)
        setSelectedJobId(current =>
          current != null && result.some(job => job.job_id === current)
            ? current
            : result[0]?.job_id ?? null,
        )
      })
      .catch(cause => {
        if (active) setJobsError(cause instanceof Error ? cause.message : 'Could not load managed jobs.')
      })
      .finally(() => {
        if (active) setJobsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (selectedJobId == null) {
      setApplications([])
      setSelected(null)
      return
    }

    let active = true
    setApplicationsLoading(true)
    setApplicationsError('')
    setSelected(current => current?.job_id === selectedJobId ? current : null)

    cvRankingApi
      .listApplications(selectedJobId)
      .then(result => {
        if (!active) return
        setApplications(result)
        setSelected(current =>
          current
            ? result.find(application => application.application_id === current.application_id) ?? null
            : null,
        )
      })
      .catch(cause => {
        if (!active) return
        setApplications([])
        setApplicationsError(cause instanceof Error ? cause.message : 'Could not load applications.')
      })
      .finally(() => {
        if (active) setApplicationsLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedJobId, reloadKey])

  useEffect(() => {
    const hasInProgressApplication = applications.some(application => {
      const state = analysisState(application.analysis_status)
      return state === 'Pending' || state === 'Processing'
    })
    if (!hasInProgressApplication || selectedJobId == null) return

    const timer = window.setTimeout(
      () => setReloadKey(current => current + 1),
      3000,
    )
    return () => window.clearTimeout(timer)
  }, [applications, selectedJobId])

  const selectedJob = jobs.find(job => job.job_id === selectedJobId) ?? null

  const rankedApplications = useMemo(
    () => [...applications].sort((left, right) => {
      const leftState = analysisState(left.analysis_status)
      const rightState = analysisState(right.analysis_status)
      const leftScore = leftState === 'Success' ? left.overall_score ?? -1 : -1
      const rightScore = rightState === 'Success' ? right.overall_score ?? -1 : -1
      if (rightScore !== leftScore) return rightScore - leftScore
      return new Date(right.applied_at).getTime() - new Date(left.applied_at).getTime()
    }),
    [applications],
  )

  const statusCounts = useMemo(
    () => applications.reduce<Record<AnalysisState, number>>(
      (counts, application) => {
        counts[analysisState(application.analysis_status)] += 1
        return counts
      },
      { Pending: 0, Processing: 0, Failed: 0, Success: 0 },
    ),
    [applications],
  )

  const handleCv = async (application: RankedApplication, action: CvAction) => {
    const previewWindow = action === 'open' ? window.open('', '_blank') : null
    setCvAction({ id: application.application_id, action })
    setCvError('')

    try {
      const blob = await cvRankingApi.getApplicationCv(application.application_id)
      const objectUrl = URL.createObjectURL(blob)
      if (action === 'open') {
        if (previewWindow) previewWindow.location.href = objectUrl
        else window.open(objectUrl, '_blank', 'noopener,noreferrer')
      } else {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = application.cv.file_name || `application-${application.application_id}.pdf`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (cause) {
      previewWindow?.close()
      setCvError(cause instanceof Error ? cause.message : 'Could not load this CV.')
    } finally {
      setCvAction(null)
    }
  }

  const retryAnalysis = async (application: RankedApplication) => {
    setRetryingApplicationId(application.application_id)
    setRetryError('')
    try {
      await applicationsApi.retryAnalysis(application.application_id)
      const pending = {
        ...application,
        parse_status: application.parse_status === 'Success' ? 'Success' : 'Pending',
        parse_error: null,
        analysis_status: 'Pending',
        analysis_error: null,
        overall_score: null,
        match_label: null,
        pass_probability: null,
        breakdown: null,
        parsed_cv: null,
      }
      setApplications(current =>
        current.map(item =>
          item.application_id === application.application_id ? pending : item,
        ),
      )
      setSelected(pending)
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : 'Could not re-run analysis.')
    } finally {
      setRetryingApplicationId(null)
    }
  }

  const selectedState = selected ? analysisState(selected.analysis_status) : null
  const selectedSkills = selected ? parsedList(selected.parsed_cv, ['skills', 'technical_skills']) : []
  const selectedExperience = selected
    ? parsedText(selected.parsed_cv, ['experience_summary', 'experience', 'total_experience_years'])
    : null
  const selectedEducation = selected
    ? parsedText(selected.parsed_cv, ['education_summary', 'education', 'highest_education'])
    : null

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>Talent Intelligence</div>
          <h1>Candidate Ranking</h1>
          <p>Review real applications and their CV-to-job analysis for each published position.</p>
        </div>
        <button
          className="fc-btn fc-btn--secondary"
          onClick={() => setReloadKey(current => current + 1)}
          disabled={selectedJobId == null || applicationsLoading}
        >
          <RefreshCw
            size={15}
            style={applicationsLoading ? { animation: 'fc-spin .8s linear infinite' } : undefined}
          />
          Refresh
        </button>
      </div>

      <div
        className="fc-card fc-card--pad"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px,1fr) repeat(4,minmax(90px,.35fr))',
          gap: 12,
          alignItems: 'end',
          overflowX: 'auto',
          marginBottom: 20,
        }}
      >
        <label>
          <span className="fc-field-label">Job description</span>
          <select
            className="fc-input"
            value={selectedJobId ?? ''}
            onChange={event => setSelectedJobId(event.target.value ? Number(event.target.value) : null)}
            disabled={jobsLoading || jobs.length === 0}
          >
            {jobs.length === 0 && <option value="">No managed jobs</option>}
            {jobs.map(job => (
              <option key={job.job_id} value={job.job_id}>
                {job.title} ({job.status})
              </option>
            ))}
          </select>
        </label>
        {(['Success', 'Processing', 'Pending', 'Failed'] as AnalysisState[]).map(status => (
          <div key={status} className="fc-panel" style={{ padding: '10px 12px', minWidth: 90 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{status}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {statusCounts[status]}
            </div>
          </div>
        ))}
      </div>

      {jobsError && (
        <div role="alert" className="fc-panel" style={{ padding: 14, color: 'var(--danger)', marginBottom: 16 }}>
          {jobsError}
        </div>
      )}
      {applicationsError && (
        <div role="alert" className="fc-panel" style={{ padding: 14, color: 'var(--danger)', marginBottom: 16 }}>
          {applicationsError}
        </div>
      )}
      {cvError && (
        <div role="alert" className="fc-panel" style={{ padding: 14, color: 'var(--danger)', marginBottom: 16 }}>
          {cvError}
        </div>
      )}

      {jobsLoading ? (
        <div className="fc-card fc-card--pad">Loading managed jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="fc-card fc-card--pad" style={{ textAlign: 'center', padding: 36 }}>
          <Briefcase size={34} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>No job descriptions yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Create and publish a job before reviewing candidates.</p>
        </div>
      ) : applicationsLoading ? (
        <div className="fc-card fc-card--pad" style={{ textAlign: 'center', padding: 36 }}>
          <LoaderCircle
            size={30}
            color="var(--accent)"
            style={{ margin: '0 auto 12px', animation: 'fc-spin .8s linear infinite' }}
          />
          Loading applications for {selectedJob?.title}...
        </div>
      ) : rankedApplications.length === 0 ? (
        <div className="fc-card fc-card--pad" style={{ textAlign: 'center', padding: 36 }}>
          <UserRound size={34} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>No applications received</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Student applications for {selectedJob?.title} will appear here.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: selected
              ? 'repeat(auto-fit,minmax(min(100%,360px),1fr))'
              : 'minmax(0,1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div className="fc-card" style={{ overflowX: 'auto' }}>
            <div
              className="fc-section-title"
              style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
            >
              <h3>Ranked candidates</h3>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>
                {rankedApplications.length} applications
              </span>
            </div>
            <table className="fc-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  {['Rank', 'Candidate', 'Analysis', 'Score', 'Pipeline', 'Applied', ''].map(header => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedApplications.map((application, index) => {
                  const state = analysisState(application.analysis_status)
                  const isSelected = selected?.application_id === application.application_id
                  const score = state === 'Success' ? percentValue(application.overall_score) : null
                  return (
                    <tr
                      key={application.application_id}
                      onClick={() => setSelected(isSelected ? null : application)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      <td>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: state === 'Success' && index < 3 ? 'var(--accent-soft)' : 'var(--surface-2)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 13,
                            fontWeight: 800,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {state === 'Success' ? index + 1 : '-'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {application.candidate.full_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {application.candidate.email}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`fc-badge ${statusBadge(state)}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          {statusIcon(state)} {state}
                        </span>
                      </td>
                      <td>
                        {score == null ? (
                          <span style={{ color: 'var(--text-muted)' }}>Not scored</span>
                        ) : (
                          <div>
                            <strong>{score}%</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {application.match_label ?? 'Analyzed'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{application.current_stage}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{application.status}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {new Date(application.applied_at).toLocaleDateString()}
                      </td>
                      <td>
                        <ChevronRight
                          size={16}
                          color="var(--text-muted)"
                          style={{
                            transform: isSelected ? 'rotate(90deg)' : 'none',
                            transition: 'transform .2s',
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {selected && selectedState && (
            <aside className="fc-card fc-card--pad" style={{ alignSelf: 'start' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="fc-eyebrow">Candidate detail</div>
                  <h3>{selected.candidate.full_name}</h3>
                </div>
                <button className="fc-icon-btn" aria-label="Close candidate detail" onClick={() => setSelected(null)}>
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {selected.candidate.full_name.trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, marginBottom: 6 }}>
                    <Mail size={13} /> <span style={{ overflowWrap: 'anywhere' }}>{selected.candidate.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                    <Phone size={13} /> {selected.candidate.phone}
                  </div>
                </div>
                {selectedState === 'Success' && selected.overall_score != null && (
                  <ScoreRing score={scoreValue(percentValue(selected.overall_score))} size={76} strokeWidth={8} label="Score" />
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
                <span
                  className={`fc-badge ${statusBadge(selectedState)}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  {statusIcon(selectedState)} {selectedState}
                </span>
                <span className="fc-badge">{selected.current_stage}</span>
                {selected.algorithm_version && <span className="fc-badge">{selected.algorithm_version}</span>}
                {selectedState === 'Success' && (
                  <button
                    type="button"
                    className="fc-btn fc-btn--secondary"
                    onClick={() => void retryAnalysis(selected)}
                    disabled={retryingApplicationId === selected.application_id}
                    style={{ marginLeft: 'auto' }}
                  >
                    {retryingApplicationId === selected.application_id ? (
                      <LoaderCircle size={15} style={{ animation: 'fc-spin .8s linear infinite' }} />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    {retryingApplicationId === selected.application_id ? 'Analyzing...' : 'Re-analyze'}
                  </button>
                )}
              </div>

              {selectedState === 'Success' && retryError && (
                <div role="alert" style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 700 }}>
                  {retryError}
                </div>
              )}

              {selectedState === 'Failed' && (
                <div
                  role="alert"
                  className="fc-panel"
                  style={{
                    padding: 12,
                    marginBottom: 14,
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    overflowWrap: 'anywhere',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      {selected.analysis_error
                        ?? selected.parse_error
                        ?? 'The CV could not be parsed or compared. Retry with OCR.'}
                    </div>
                    {retryError && (
                      <div style={{ marginTop: 6, fontWeight: 700 }}>{retryError}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="fc-btn fc-btn--secondary"
                    onClick={() => void retryAnalysis(selected)}
                    disabled={retryingApplicationId === selected.application_id}
                    style={{ flexShrink: 0 }}
                  >
                    {retryingApplicationId === selected.application_id ? (
                      <LoaderCircle size={15} style={{ animation: 'fc-spin .8s linear infinite' }} />
                    ) : (
                      <ScanText size={15} />
                    )}
                    {retryingApplicationId === selected.application_id ? 'Analyzing...' : 'Retry analysis'}
                  </button>
                </div>
              )}

              {selectedState === 'Success' && (
                <div className="fc-panel" style={{ padding: 14, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MATCH LABEL</div>
                      <strong>{selected.match_label ?? 'Analyzed'}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PASS PROBABILITY</div>
                      <strong>
                        {percentValue(selected.pass_probability) == null
                          ? 'N/A'
                          : `${percentValue(selected.pass_probability)}%`}
                      </strong>
                    </div>
                  </div>

                  {breakdownCriteria.map(([key, label]) => {
                    const score = percentValue(selected.breakdown?.[key])
                    return (
                      <div key={key} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                          <strong style={{ fontSize: 12 }}>{score == null ? 'N/A' : `${score}%`}</strong>
                        </div>
                        <div className="fc-progress">
                          <div
                            style={{
                              width: `${score ?? 0}%`,
                              background:
                                score == null
                                  ? 'var(--border-strong)'
                                  : score >= 80
                                    ? 'var(--success)'
                                    : score >= 50
                                      ? 'var(--warning)'
                                      : 'var(--danger)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {(selectedSkills.length > 0 || selectedExperience || selectedEducation) && (
                <div style={{ marginBottom: 16 }}>
                  <div className="fc-section-title" style={{ marginBottom: 10 }}>
                    <Sparkles size={15} />
                    <h3>Parsed CV</h3>
                  </div>
                  {selectedSkills.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                      {selectedSkills.slice(0, 12).map(skill => (
                        <span key={skill} className="fc-chip">{skill}</span>
                      ))}
                    </div>
                  )}
                  {selectedExperience && (
                    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 8 }}>
                      <Briefcase size={14} style={{ flexShrink: 0 }} />
                      <span>{selectedExperience}</span>
                    </div>
                  )}
                  {selectedEducation && (
                    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <GraduationCap size={14} style={{ flexShrink: 0 }} />
                      <span>{selectedEducation}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="fc-panel" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <FileText size={20} color="var(--accent)" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{selected.cv.file_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selected.cv.file_type} - {fileSizeLabel(selected.cv.file_size_kb)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="fc-btn fc-btn--primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => void handleCv(selected, 'open')}
                  disabled={cvAction?.id === selected.application_id}
                >
                  {cvAction?.id === selected.application_id && cvAction.action === 'open'
                    ? <LoaderCircle size={15} style={{ animation: 'fc-spin .8s linear infinite' }} />
                    : <ExternalLink size={15} />}
                  Open CV
                </button>
                <button
                  className="fc-btn fc-btn--secondary"
                  aria-label="Download CV"
                  onClick={() => void handleCv(selected, 'download')}
                  disabled={cvAction?.id === selected.application_id}
                >
                  {cvAction?.id === selected.application_id && cvAction.action === 'download'
                    ? <LoaderCircle size={15} style={{ animation: 'fc-spin .8s linear infinite' }} />
                    : <Download size={15} />}
                  Download
                </button>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
