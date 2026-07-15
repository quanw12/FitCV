import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { cvRankingApi } from '@/api'
import type { ParsedCvCandidate } from '@/types/cvRanking'

interface ParsedCandidate extends ParsedCvCandidate {
  file: File
  fileUrl: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const DEFAULT_JOB_DESCRIPTION = [
  'Senior Backend Developer',
  'Required skills: Node.js, TypeScript, PostgreSQL, Docker, REST API, AWS.',
  'Preferred experience: 3+ years building production backend systems.',
  'Education: Computer Science or Software Engineering background.',
].join('\n')

const knownSkills = [
  'Node.js',
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'Spring Boot',
  'Django',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'REST API',
  'GraphQL',
  'FastAPI',
  'React',
  'Next.js',
]

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ')
}

function candidateNameFromFile(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  const withoutCvWords = baseName.replace(/\b(cv|resume|profile|candidate)\b/gi, '').replace(/\s+/g, ' ').trim()
  return withoutCvWords
    ? withoutCvWords.replace(/\b\w/g, char => char.toUpperCase())
    : 'Unnamed Candidate'
}

function extractSkills(source: string) {
  const normalized = normalizeText(source)
  return knownSkills.filter(skill => normalized.includes(normalizeText(skill).trim()))
}

function requiredSkillsFromJd(jobDescription: string) {
  const required = extractSkills(jobDescription)
  return required.length ? required : ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker']
}

function inferExperienceYears(source: string) {
  const match = source.match(/(\d+)\s*(?:years?|yrs?)/i)
  if (match) return Number(match[1])
  if (/senior|lead|principal/i.test(source)) return 5
  if (/middle|mid/i.test(source)) return 3
  if (/junior|intern|fresher/i.test(source)) return 1
  return 2
}

function inferEducation(source: string) {
  if (/master|msc/i.test(source)) return 'Master degree mentioned'
  if (/bachelor|bs|bsc|computer science|software engineering|cs\b/i.test(source)) return 'Bachelor or CS background mentioned'
  return 'Education not detected'
}

function scoreCandidate(skills: string[], experienceYears: number, education: string, requiredSkills: string[]) {
  const matchedSkillCount = requiredSkills.filter(skill => skills.includes(skill)).length
  const skillScore = requiredSkills.length ? Math.round((matchedSkillCount / requiredSkills.length) * 100) : 0
  const experienceScore = Math.min(100, Math.round((experienceYears / 5) * 100))
  const educationScore = education === 'Education not detected' ? 45 : 85
  const total = Math.round(skillScore * 0.6 + experienceScore * 0.3 + educationScore * 0.1)

  return {
    score: Math.max(0, Math.min(100, total)),
    scoreBreakdown: {
      skills: skillScore,
      experience: experienceScore,
      education: educationScore,
    },
  }
}

function fileIdentity(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function parseCandidate(file: File, jobDescription: string): ParsedCandidate {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const fileType = extension === 'pdf' ? 'PDF' : 'DOCX'
  const source = file.name
  const requiredSkills = requiredSkillsFromJd(jobDescription)
  const skills = extractSkills(source)
  const missingSkills = requiredSkills.filter(skill => !skills.includes(skill))
  const experienceYears = inferExperienceYears(source)
  const education = inferEducation(source)
  const { score, scoreBreakdown } = scoreCandidate(skills, experienceYears, education, requiredSkills)

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    fileUrl: URL.createObjectURL(file),
    fileName: file.name,
    fileType,
    fileSizeLabel: formatBytes(file.size),
    name: candidateNameFromFile(file.name),
    email: 'Not detected',
    phone: 'Not detected',
    location: 'Not detected',
    position: 'Senior Backend Developer',
    skills,
    missingSkills,
    experienceYears,
    education,
    score,
    scoreBreakdown,
    status: 'Ready',
    parseNotes: [
      'MVP parser extracts structured fields from filename and file metadata.',
      'Full PDF/DOCX text parsing and AI ranking will be designed in the next backend/AI phase.',
    ],
  }
}

function attachFileToParsedCandidate(candidate: ParsedCvCandidate, file: File, existingFileUrl?: string): ParsedCandidate {
  return {
    ...candidate,
    id: fileIdentity(file),
    file,
    fileUrl: existingFileUrl ?? URL.createObjectURL(file),
  }
}

function scoreStyle(score: number) {
  if (score >= 80) return { color: '#16A34A', bg: '#DCFCE7', label: 'Strong' }
  if (score >= 50) return { color: '#D97706', bg: '#FEF3C7', label: 'Moderate' }
  return { color: '#DC2626', bg: '#FEE2E2', label: 'Weak' }
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'pdf' && extension !== 'docx') return 'Only PDF and DOCX files are supported.'
  if (file.size > MAX_FILE_SIZE) return 'Each CV must be 10MB or smaller.'
  return undefined
}

export default function CVRankingScreen() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [jobDescription, setJobDescription] = useState(DEFAULT_JOB_DESCRIPTION)
  const [candidates, setCandidates] = useState<ParsedCandidate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [isParsing, setIsParsing] = useState(false)

  const requiredSkills = useMemo(() => requiredSkillsFromJd(jobDescription), [jobDescription])
  const rankedCandidates = useMemo(
    () => [...candidates].sort((left, right) => right.score - left.score),
    [candidates],
  )
  const selected = rankedCandidates.find(candidate => candidate.id === selectedId) ?? null
  const strongCount = rankedCandidates.filter(candidate => candidate.score >= 80).length
  const moderateCount = rankedCandidates.filter(candidate => candidate.score >= 50 && candidate.score < 80).length
  const weakCount = rankedCandidates.filter(candidate => candidate.score < 50).length

  const addFiles = async (fileList: FileList | File[]) => {
    const nextErrors: string[] = []
    const validFiles: File[] = []
    const existingIds = new Set(candidates.map(candidate => candidate.id))

    Array.from(fileList).forEach(file => {
      const validationError = validateFile(file)
      if (validationError) {
        nextErrors.push(`${file.name}: ${validationError}`)
        return
      }

      const candidateId = fileIdentity(file)
      if (existingIds.has(candidateId)) {
        nextErrors.push(`${file.name}: This file has already been uploaded.`)
        return
      }

      existingIds.add(candidateId)
      validFiles.push(file)
    })

    if (!validFiles.length) {
      setUploadErrors(nextErrors)
      return
    }

    setIsParsing(true)
    let nextCandidates: ParsedCandidate[] = []

    try {
      const response = await cvRankingApi.parseBatch(validFiles, jobDescription)
      nextCandidates = validFiles.map(file => {
        const parsed = response.candidates.find(candidate => candidate.fileName === file.name)
        return parsed ? attachFileToParsedCandidate(parsed, file) : parseCandidate(file, jobDescription)
      })
      nextErrors.push(...response.warnings)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backend parser is unavailable.'
      nextErrors.push(`${message} Falling back to local MVP parser.`)
      nextCandidates = validFiles.map(file => parseCandidate(file, jobDescription))
    } finally {
      setIsParsing(false)
    }

    setUploadErrors(nextErrors)
    setCandidates(current => [...current, ...nextCandidates])
    setSelectedId(nextCandidates[0].id)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    void addFiles(event.dataTransfer.files)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addFiles(event.target.files)
    event.target.value = ''
  }

  const rerankCandidates = async () => {
    if (!candidates.length) return
    setIsParsing(true)
    try {
      const response = await cvRankingApi.parseBatch(candidates.map(candidate => candidate.file), jobDescription)
      setCandidates(current => current.map(candidate => {
        const parsed = response.candidates.find(item => item.fileName === candidate.file.name)
        return parsed ? attachFileToParsedCandidate(parsed, candidate.file, candidate.fileUrl) : candidate
      }))
      setUploadErrors(response.warnings)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backend parser is unavailable.'
      setUploadErrors([`${message} Re-ranked with local MVP parser.`])
      setCandidates(current => current.map(candidate => {
        const required = requiredSkillsFromJd(jobDescription)
        const missingSkills = required.filter(skill => !candidate.skills.includes(skill))
        const { score, scoreBreakdown } = scoreCandidate(candidate.skills, candidate.experienceYears, candidate.education, required)
        return { ...candidate, missingSkills, score, scoreBreakdown }
      }))
    } finally {
      setIsParsing(false)
    }
  }

  const removeCandidate = (candidateId: string) => {
    setCandidates(current => current.filter(candidate => candidate.id !== candidateId))
    if (selectedId === candidateId) setSelectedId(null)
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>CV Upload, Parsing & Ranking</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Bulk upload CVs, parse candidate data, and generate a rule-based ranking before AI scoring is connected.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 16, marginBottom: 16 }}>
        <div
          onDragOver={event => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="fitcv-card"
          style={{
            border: `2px dashed ${dragOver ? 'var(--indigo)' : 'var(--border)'}`,
            padding: 22,
            background: dragOver ? 'var(--indigo-light)' : 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minHeight: 146,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Upload size={24} color="var(--indigo)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>Drop CVs here or browse</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>PDF/DOCX only, max 10MB each. Multiple files are parsed as a batch.</div>
          </div>
          <button className="fitcv-btn-primary" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>
            {isParsing ? 'Parsing...' : 'Browse'}
          </button>
        </div>

        <div className="fitcv-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>Job Description Basis</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Used by the MVP scoring rule. AI scoring will replace this later.</p>
            </div>
            <button className="fitcv-btn-secondary" style={{ fontSize: 12 }} disabled={isParsing || candidates.length === 0} onClick={() => void rerankCandidates()}>
              <RotateCcw size={14} /> {isParsing ? 'Ranking...' : 'Re-rank'}
            </button>
          </div>
          <textarea
            value={jobDescription}
            onChange={event => setJobDescription(event.target.value)}
            style={{
              width: '100%',
              minHeight: 86,
              resize: 'vertical',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 10,
              fontFamily: 'Inter',
              fontSize: 13,
              color: 'var(--text-primary)',
              background: 'var(--bg)',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {requiredSkills.map(skill => <span key={skill} className="badge-indigo" style={{ fontSize: 11 }}>{skill}</span>)}
          </div>
        </div>
      </div>

      {uploadErrors.length > 0 && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          {uploadErrors.map(error => <div key={error}>{error}</div>)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(480px, 1fr) minmax(460px, 520px)' : '1fr', gap: 16 }}>
        <div className="fitcv-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Ranking List</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{rankedCandidates.length} uploaded CVs</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span className="badge-green">{strongCount} Strong</span>
              <span className="badge-amber">{moderateCount} Moderate</span>
              <span className="badge-red">{weakCount} Weak</span>
            </div>
          </div>

          {rankedCandidates.length === 0 ? (
            <div style={{ padding: 42, textAlign: 'center' }}>
              <FileText size={40} color="var(--text-muted)" />
              <div style={{ marginTop: 12, fontWeight: 800, color: 'var(--text-primary)' }}>No CVs uploaded yet</div>
              <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 13 }}>Upload PDF or DOCX files to start parsing and ranking candidates.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Rank', 'Candidate', 'Score', 'Matched Skills', 'Experience', 'Status', 'Actions'].map(header => (
                    <th key={header} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'left', textTransform: 'uppercase' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedCandidates.map((candidate, index) => {
                  const style = scoreStyle(candidate.score)
                  const isActive = selected?.id === candidate.id
                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => setSelectedId(isActive ? null : candidate.id)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: isActive ? 'var(--indigo-light)' : 'white' }}
                    >
                      <td style={{ padding: '14px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: index < 3 ? 'var(--indigo-light)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: index < 3 ? 'var(--indigo)' : 'var(--text-muted)' }}>
                          {index + 1}
                        </div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: style.color }}>
                            {candidate.name[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{candidate.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{candidate.file.name} - {candidate.fileSizeLabel}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ background: style.bg, color: style.color, borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>{candidate.score}%</span>
                      </td>
                      <td style={{ padding: '14px', maxWidth: 190 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {candidate.skills.length ? candidate.skills.slice(0, 3).map(skill => <span key={skill} className="badge-green" style={{ fontSize: 11 }}>{skill}</span>) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No skills detected</span>}
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{candidate.experienceYears} years</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                          <CheckCircle2 size={14} /> {candidate.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isActive ? 'rotate(90deg)' : 'none' }} />
                          <button
                            title="Remove CV"
                            onClick={event => {
                              event.stopPropagation()
                              removeCandidate(candidate.id)
                            }}
                            style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 7, background: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="fitcv-card" style={{ padding: 18, alignSelf: 'start', position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Parsed Data + Raw File</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Side-by-side review for parser validation</p>
              </div>
              <button onClick={() => setSelectedId(null)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>{selected.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{selected.position}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: scoreStyle(selected.score).color, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{selected.score}%</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Rule Score</div>
                  </div>
                </div>

                {[
                  { icon: <Mail size={13} />, label: selected.email },
                  { icon: <Phone size={13} />, label: selected.phone },
                  { icon: <Briefcase size={13} />, label: `${selected.experienceYears} years` },
                  { icon: <GraduationCap size={13} />, label: selected.education },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.icon} {item.label}
                  </div>
                ))}

                <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 7 }}>Matched Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {selected.skills.length ? selected.skills.map(skill => <span key={skill} className="badge-green" style={{ fontSize: 11 }}>{skill}</span>) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No skills detected</span>}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 7 }}>Missing JD Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {selected.missingSkills.length ? selected.missingSkills.map(skill => <span key={skill} className="badge-amber" style={{ fontSize: 11 }}>{skill}</span>) : <span className="badge-green" style={{ fontSize: 11 }}>All required skills matched</span>}
                </div>

                <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 10 }}>
                  {Object.entries(selected.scoreBreakdown).map(([label, value]) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{value}%</span>
                      </div>
                      <div style={{ height: 5, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${value}%`, height: '100%', background: 'var(--indigo)' }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  {selected.parseNotes.map(note => (
                    <div key={note} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45, marginBottom: 6 }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {note}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)', minHeight: 430 }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{selected.file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.fileType} - {selected.fileSizeLabel}</div>
                  </div>
                  <a href={selected.fileUrl} download={selected.file.name} className="fitcv-btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
                    <Download size={14} /> File
                  </a>
                </div>
                {selected.fileType === 'PDF' ? (
                  <iframe title={selected.file.name} src={selected.fileUrl} style={{ width: '100%', height: 386, border: 'none', background: 'white' }} />
                ) : (
                  <div style={{ padding: 22, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                    <FileText size={34} color="var(--text-muted)" />
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 12 }}>DOCX preview is not available in browser MVP</div>
                    <div style={{ marginTop: 5 }}>Use the download button to inspect the original file. A backend DOCX parser will be added before AI ranking.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
