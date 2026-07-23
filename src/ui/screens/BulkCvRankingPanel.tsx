import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import {
  AlertCircle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Files,
  GraduationCap,
  LoaderCircle,
  Mail,
  Phone,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  UserCheck,
  X,
} from 'lucide-react'

import { cvRankingApi } from '@/api/cvRankingApi'
import type {
  BatchParseCvResponse,
  ParsedCvCandidate,
} from '@/types/cvRanking'
import ScoreRing from '../components/ScoreRing'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_BATCH_FILES = 20
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx']

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function fileExtension(file: File): string {
  const index = file.name.lastIndexOf('.')
  return index >= 0 ? file.name.slice(index).toLowerCase() : ''
}

function scoreTone(score: number): string {
  if (score >= 80) return 'fc-badge--green'
  if (score >= 50) return 'fc-badge--amber'
  return 'fc-badge--red'
}

function uniqueFiles(current: File[], incoming: File[]): File[] {
  const seen = new Set(current.map(fileKey))
  const result = [...current]
  for (const file of incoming) {
    const key = fileKey(file)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(file)
    }
  }
  return result
}

export default function BulkCvRankingPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [result, setResult] = useState<BatchParseCvResponse | null>(null)
  const [selectedCandidate, setSelectedCandidate] =
    useState<ParsedCvCandidate | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() => new Set())
  const [threshold, setThreshold] = useState(70)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileError, setFileError] = useState('')

  const selectedFile =
    selectedCandidate != null ? files[selectedCandidate.sourceIndex] : undefined

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const addFiles = (incoming: File[]) => {
    setFileError('')
    const valid: File[] = []
    const messages: string[] = []

    for (const file of incoming) {
      if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file))) {
        messages.push(`${file.name}: only PDF and DOCX are supported.`)
      } else if (file.size > MAX_FILE_BYTES) {
        messages.push(`${file.name}: file must be 10MB or smaller.`)
      } else {
        valid.push(file)
      }
    }

    setFiles((current) => {
      const next = uniqueFiles(current, valid)
      if (next.length > MAX_BATCH_FILES) {
        messages.push(`A batch can contain at most ${MAX_BATCH_FILES} CV files.`)
        return next.slice(0, MAX_BATCH_FILES)
      }
      return next
    })
    setFileError(messages.join(' '))
    setResult(null)
    setSelectedCandidate(null)
    setSelectedIds(new Set())
    setConfirmedIds(new Set())
  }

  const removeFile = (target: File) => {
    setFiles((current) => current.filter((file) => fileKey(file) !== fileKey(target)))
    setResult(null)
    setSelectedCandidate(null)
    setSelectedIds(new Set())
    setConfirmedIds(new Set())
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  const analyze = async () => {
    setError('')
    if (jobDescription.trim().length < 50) {
      setError('Enter a job description with at least 50 characters.')
      return
    }
    if (files.length === 0) {
      setError('Add at least one CV before starting screening.')
      return
    }

    setBusy(true)
    try {
      const response = await cvRankingApi.parseBatch(files, jobDescription.trim())
      setResult(response)
      setSelectedCandidate(response.candidates[0] ?? null)
      setSelectedIds(new Set())
      setConfirmedIds(new Set())
    } catch (cause) {
      setResult(null)
      setSelectedCandidate(null)
      setError(cause instanceof Error ? cause.message : 'CV screening failed.')
    } finally {
      setBusy(false)
    }
  }

  const toggleCandidate = (candidateId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
    setConfirmedIds(new Set())
  }

  const selectByThreshold = () => {
    setSelectedIds(
      new Set(
        (result?.candidates ?? [])
          .filter((candidate) => candidate.score >= threshold)
          .map((candidate) => candidate.id),
      ),
    )
    setConfirmedIds(new Set())
  }

  const confirmedCandidates = useMemo(
    () =>
      (result?.candidates ?? []).filter((candidate) =>
        confirmedIds.has(candidate.id),
      ),
    [confirmedIds, result],
  )

  const openRawFile = () => {
    if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            Talent screening
          </div>
          <h1>Bulk CV Ranking</h1>
          <p>Screen an uploaded candidate batch against the JD supplied by HR.</p>
        </div>
      </div>

      <section
        className="fc-card"
        aria-labelledby="screening-input-title"
        style={{ marginBottom: 18 }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id="screening-input-title" style={{ fontSize: 16 }}>
            Screening input
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))',
            gap: 18,
            padding: 20,
          }}
        >
          <label>
            <span className="fc-field-label">Job description</span>
            <textarea
              className="fc-input"
              aria-label="Job description"
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value)
                setResult(null)
              }}
              rows={12}
              placeholder="Paste responsibilities, required skills, experience, education and preferred qualifications..."
              style={{ resize: 'vertical', minHeight: 250, lineHeight: 1.55 }}
            />
            <span
              style={{
                display: 'block',
                marginTop: 6,
                fontSize: 12,
                color:
                  jobDescription.trim().length >= 50
                    ? 'var(--success)'
                    : 'var(--text-muted)',
              }}
            >
              {jobDescription.trim().length} characters
            </span>
          </label>

          <div>
            <span className="fc-field-label">Candidate CVs</span>
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Candidate CV files"
              accept=".pdf,.docx"
              multiple
              hidden
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              style={{
                minHeight: 150,
                border: `1px dashed ${
                  dragActive ? 'var(--accent)' : 'var(--border-strong)'
                }`,
                background: dragActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                display: 'grid',
                placeItems: 'center',
                padding: 20,
                textAlign: 'center',
                cursor: 'pointer',
                borderRadius: 8,
              }}
            >
              <div>
                <UploadCloud
                  size={30}
                  color="var(--accent)"
                  style={{ margin: '0 auto 9px' }}
                />
                <strong>Drop CV files or choose files</strong>
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    marginTop: 5,
                  }}
                >
                  PDF or DOCX, maximum 10MB each, up to 20 files
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  border: '1px solid var(--border)',
                  maxHeight: 170,
                  overflowY: 'auto',
                }}
              >
                {files.map((file) => (
                  <div
                    key={fileKey(file)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      minHeight: 42,
                      padding: '7px 10px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <FileText size={15} color="var(--accent)" />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 13,
                      }}
                    >
                      {file.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {Math.max(1, Math.round(file.size / 1024))} KB
                    </span>
                    <button
                      type="button"
                      className="fc-icon-btn"
                      aria-label={`Remove ${file.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        removeFile(file)
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {(fileError || error) && (
          <div
            role="alert"
            style={{
              margin: '0 20px 14px',
              color: 'var(--danger)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              fontSize: 13,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{fileError || error}</span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {files.length} CV{files.length === 1 ? '' : 's'} ready
          </span>
          <button
            type="button"
            className="fc-btn fc-btn--primary"
            onClick={() => void analyze()}
            disabled={
              busy ||
              files.length === 0 ||
              jobDescription.trim().length < 50
            }
          >
            {busy ? (
              <LoaderCircle
                size={16}
                style={{ animation: 'fc-spin .8s linear infinite' }}
              />
            ) : (
              <Sparkles size={16} />
            )}
            {busy ? 'Parsing and ranking...' : 'Analyze and rank'}
          </button>
        </div>
      </section>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <div
              role="status"
              className="fc-panel"
              style={{
                padding: 12,
                marginBottom: 14,
                color: 'var(--warning-ink)',
              }}
            >
              {result.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(min(100%,210px),1fr))',
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            {[
              ['Processed', result.candidates.length],
              [
                'Strong matches',
                result.candidates.filter((candidate) => candidate.score >= 80)
                  .length,
              ],
              ['Selected', selectedIds.size],
              ['Confirmed', confirmedIds.size],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: '13px 16px',
                  borderRight: '1px solid var(--border)',
                }}
              >
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {label}
                </div>
                <strong style={{ fontSize: 21 }}>{value}</strong>
              </div>
            ))}
          </section>

          <section className="fc-card" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <SlidersHorizontal size={16} color="var(--accent)" />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  minWidth: 260,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  Score threshold
                </span>
                <input
                  type="range"
                  aria-label="Score threshold"
                  min={0}
                  max={100}
                  step={5}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                  style={{ flex: 1 }}
                />
                <strong style={{ width: 38, textAlign: 'right' }}>
                  {threshold}
                </strong>
              </label>
              <button
                type="button"
                className="fc-btn fc-btn--secondary"
                onClick={selectByThreshold}
              >
                <Check size={15} />
                Select score ≥ {threshold}
              </button>
              <button
                type="button"
                className="fc-btn fc-btn--secondary"
                onClick={() => {
                  setSelectedIds(new Set())
                  setConfirmedIds(new Set())
                }}
                disabled={selectedIds.size === 0}
              >
                Clear
              </button>
              <button
                type="button"
                className="fc-btn fc-btn--primary"
                onClick={() => setConfirmedIds(new Set(selectedIds))}
                disabled={selectedIds.size === 0}
                style={{ marginLeft: 'auto' }}
              >
                <UserCheck size={16} />
                Confirm {selectedIds.size} selected
              </button>
            </div>

            {confirmedCandidates.length > 0 && (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  color: 'var(--success)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={16} />
                {confirmedCandidates.length} candidate
                {confirmedCandidates.length === 1 ? '' : 's'} confirmed for HR
                review.
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="fc-table" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <th aria-label="Select candidate" />
                    <th>Rank</th>
                    <th>Candidate</th>
                    <th>Score</th>
                    <th>Matched skills</th>
                    <th>Experience</th>
                    <th>Education</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {result.candidates.map((candidate, index) => {
                    const active = selectedCandidate?.id === candidate.id
                    const checked = selectedIds.has(candidate.id)
                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => setSelectedCandidate(candidate)}
                        style={{
                          cursor: 'pointer',
                          background: active
                            ? 'var(--accent-soft)'
                            : 'transparent',
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${candidate.name}`}
                            checked={checked}
                            onChange={() => toggleCandidate(candidate.id)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                        <td>
                          <strong>#{index + 1}</strong>
                        </td>
                        <td>
                          <strong>{candidate.name}</strong>
                          <div
                            style={{
                              color: 'var(--text-muted)',
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            {candidate.position}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`fc-badge ${scoreTone(candidate.score)}`}
                          >
                            {candidate.score}% · {candidate.matchLabel}
                          </span>
                        </td>
                        <td style={{ maxWidth: 250 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 4,
                              flexWrap: 'wrap',
                            }}
                          >
                            {candidate.matchedSkills.slice(0, 3).map((skill) => (
                              <span key={skill} className="fc-chip">
                                {skill}
                              </span>
                            ))}
                            {candidate.matchedSkills.length === 0 && (
                              <span style={{ color: 'var(--text-muted)' }}>
                                None
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {candidate.experienceYears > 0
                            ? `${candidate.experienceYears} years`
                            : 'Not detected'}
                        </td>
                        <td>{candidate.education}</td>
                        <td>{candidate.fileName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selectedCandidate && (
            <section
              aria-label="Candidate comparison"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(min(100%,420px),1fr))',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  borderRight: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 50,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div className="fc-section-title">
                    <Files size={16} />
                    <h3>Raw CV</h3>
                  </div>
                  <button
                    type="button"
                    className="fc-btn fc-btn--secondary"
                    onClick={openRawFile}
                    disabled={!previewUrl}
                  >
                    <ExternalLink size={14} />
                    Open
                  </button>
                </div>
                {selectedCandidate.fileType === 'PDF' && previewUrl ? (
                  <iframe
                    title={`Raw CV for ${selectedCandidate.name}`}
                    src={previewUrl}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 680,
                      border: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      minHeight: 300,
                      display: 'grid',
                      placeItems: 'center',
                      padding: 24,
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <FileText
                        size={34}
                        color="var(--accent)"
                        style={{ margin: '0 auto 10px' }}
                      />
                      <strong>{selectedCandidate.fileName}</strong>
                      <div style={{ marginTop: 5, fontSize: 13 }}>
                        Open the DOCX file to inspect the original document.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    minHeight: 50,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                  }}
                  className="fc-section-title"
                >
                  <Sparkles size={16} />
                  <h3>Parsed data and score</h3>
                </div>
                <div style={{ padding: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      paddingBottom: 16,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <ScoreRing
                      score={selectedCandidate.score}
                      size={88}
                      strokeWidth={9}
                      label="Match"
                    />
                    <div style={{ minWidth: 0 }}>
                      <h3>{selectedCandidate.name}</h3>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          marginTop: 7,
                          fontSize: 13,
                        }}
                      >
                        <Mail size={13} />
                        <span style={{ overflowWrap: 'anywhere' }}>
                          {selectedCandidate.email}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          marginTop: 5,
                          fontSize: 13,
                        }}
                      >
                        <Phone size={13} />
                        {selectedCandidate.phone}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                      gap: 10,
                      padding: '16px 0',
                    }}
                  >
                    {[
                      ['Skills', selectedCandidate.scoreBreakdown.skills],
                      [
                        'Experience',
                        selectedCandidate.scoreBreakdown.experience,
                      ],
                      ['Education', selectedCandidate.scoreBreakdown.education],
                      [
                        'Soft skills',
                        selectedCandidate.scoreBreakdown.softSkills,
                      ],
                    ].map(([label, score]) => (
                      <div
                        key={label}
                        style={{
                          border: '1px solid var(--border)',
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: 11,
                          }}
                        >
                          {label}
                        </div>
                        <strong>{score}%</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <strong style={{ fontSize: 13 }}>Matched skills</strong>
                    <div
                      style={{
                        display: 'flex',
                        gap: 5,
                        flexWrap: 'wrap',
                        marginTop: 7,
                      }}
                    >
                      {selectedCandidate.matchedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="fc-badge fc-badge--green"
                        >
                          {skill}
                        </span>
                      ))}
                      {selectedCandidate.matchedSkills.length === 0 && (
                        <span style={{ color: 'var(--text-muted)' }}>None</span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 15 }}>
                    <strong style={{ fontSize: 13 }}>Missing JD skills</strong>
                    <div
                      style={{
                        display: 'flex',
                        gap: 5,
                        flexWrap: 'wrap',
                        marginTop: 7,
                      }}
                    >
                      {selectedCandidate.missingSkills.map((skill) => (
                        <span key={skill} className="fc-badge fc-badge--red">
                          {skill}
                        </span>
                      ))}
                      {selectedCandidate.missingSkills.length === 0 && (
                        <span style={{ color: 'var(--success)' }}>
                          No missing listed skills
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                      gap: 10,
                      marginBottom: 15,
                    }}
                  >
                    <div
                      style={{ display: 'flex', gap: 7, alignItems: 'center' }}
                    >
                      <BriefcaseBusiness size={15} />
                      <span style={{ fontSize: 13 }}>
                        {selectedCandidate.experienceYears > 0
                          ? `${selectedCandidate.experienceYears} years`
                          : 'Experience not detected'}
                      </span>
                    </div>
                    <div
                      style={{ display: 'flex', gap: 7, alignItems: 'center' }}
                    >
                      <GraduationCap size={15} />
                      <span style={{ fontSize: 13 }}>
                        {selectedCandidate.education}
                      </span>
                    </div>
                  </div>

                  {(selectedCandidate.strengths.length > 0 ||
                    selectedCandidate.weaknesses.length > 0) && (
                    <div
                      style={{
                        borderTop: '1px solid var(--border)',
                        paddingTop: 14,
                        fontSize: 13,
                      }}
                    >
                      {selectedCandidate.strengths.map((strength) => (
                        <div
                          key={strength}
                          style={{ color: 'var(--success)', marginBottom: 6 }}
                        >
                          + {strength}
                        </div>
                      ))}
                      {selectedCandidate.weaknesses.map((weakness) => (
                        <div
                          key={weakness}
                          style={{ color: 'var(--danger)', marginBottom: 6 }}
                        >
                          - {weakness}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
