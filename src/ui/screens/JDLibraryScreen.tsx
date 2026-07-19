import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  LoaderCircle,
  MapPin,
  Search,
  Send,
  Upload,
  X,
} from 'lucide-react'
import { applicationsApi } from '@/api/applicationsApi'
import { jobsApi } from '@/api/jobsApi'
import { profileApi } from '@/api/profileApi'
import type { JobPost } from '@/types/jobs'
import type { StudentApplication } from '@/types/applications'

const MAX_CV_BYTES = 10 * 1024 * 1024

const sections = [
  ['about_job', 'About the job'],
  ['responsibilities', 'Responsibilities'],
  ['requirements', 'Requirements'],
  ['we_offer', 'We offer'],
  ['life_at_company', 'Life at company'],
  ['hiring_process', 'How we hire'],
] as const

interface ApplyForm {
  fullName: string
  email: string
  phone: string
}

const emptyApplyForm: ApplyForm = {
  fullName: '',
  email: '',
  phone: '',
}

function validateApplication(form: ApplyForm, file: File | null): string | null {
  if (form.fullName.trim().length < 2) return 'Enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.'
  if (!/^\+?[\d\s().-]{7,20}$/.test(form.phone.trim())) return 'Enter a valid phone number.'
  if (!file) return 'Choose your CV in PDF format.'
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are accepted.'
  }
  if (file.size > MAX_CV_BYTES) return 'Your PDF must be 10MB or smaller.'
  return null
}

interface JDLibraryScreenProps {
  onViewTracking: (applicationId: number) => void
}

export default function JDLibraryScreen({ onViewTracking }: JDLibraryScreenProps) {
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [applications, setApplications] = useState<StudentApplication[]>([])
  const [recentApplications, setRecentApplications] = useState<Record<number, number>>({})
  const [selected, setSelected] = useState<JobPost | null>(null)
  const [applyJob, setApplyJob] = useState<JobPost | null>(null)
  const [applyForm, setApplyForm] = useState<ApplyForm>(emptyApplyForm)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedApplicationId, setSubmittedApplicationId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [applyError, setApplyError] = useState('')

  useEffect(() => {
    Promise.all([jobsApi.listPublic(), applicationsApi.listMine()])
      .then(([availableJobs, trackedApplications]) => {
        setJobs(availableJobs)
        setApplications(trackedApplications)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load jobs and applications.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!applyJob) return

    let active = true
    setApplyForm(emptyApplyForm)
    setCvFile(null)
    setApplyError('')
    setSubmittedApplicationId(null)
    setProfileLoading(true)

    profileApi
      .get()
      .then(profile => {
        if (!active) return
        setApplyForm({
          fullName: profile.fullName ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
        })
      })
      .catch(() => {
        if (active) setApplyError('Profile details could not be prefilled. You can enter them below.')
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [applyJob])

  const locations = useMemo(
    () => [...new Set(jobs.map(job => job.location).filter((item): item is string => Boolean(item)))],
    [jobs],
  )

  const applicationByJob = useMemo(() => {
    const result = new Map<number, number>()
    applications.forEach(application => {
      if (!result.has(application.job_id)) {
        result.set(application.job_id, application.application_id)
      }
    })
    Object.entries(recentApplications).forEach(([jobId, applicationId]) => {
      result.set(Number(jobId), applicationId)
    })
    return result
  }, [applications, recentApplications])

  const filtered = jobs.filter(job =>
    `${job.title} ${job.company.name} ${job.location ?? ''} ${job.employment_type ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
    && (!location || job.location === location),
  )

  const closeApply = () => {
    if (!submitting) setApplyJob(null)
  }

  const chooseCv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setCvFile(file)
    setApplyError('')
  }

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!applyJob) return

    const validationError = validateApplication(applyForm, cvFile)
    if (validationError) {
      setApplyError(validationError)
      return
    }

    setSubmitting(true)
    setApplyError('')
    try {
      const created = await jobsApi.apply(applyJob.job_id, {
        fullName: applyForm.fullName.trim(),
        email: applyForm.email.trim(),
        phone: applyForm.phone.trim(),
        file: cvFile!,
      })
      setRecentApplications(current => ({
        ...current,
        [applyJob.job_id]: created.application_id,
      }))
      setSubmittedApplicationId(created.application_id)
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : 'Could not submit your application.')
    } finally {
      setSubmitting(false)
    }
  }

  const viewTracking = (applicationId: number) => {
    setApplyJob(null)
    setSelected(null)
    onViewTracking(applicationId)
  }

  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow">Opportunities</div>
          <h1>Job Library</h1>
          <p>Browse active jobs published by FitCV companies.</p>
        </div>
      </div>

      <div
        className="fc-card fc-card--pad"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <label>
          <span className="fc-field-label">Search jobs</span>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              className="fc-input"
              style={{ paddingLeft: 38 }}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Title, company, or type"
            />
          </div>
        </label>
        <label>
          <span className="fc-field-label">Location</span>
          <select className="fc-input" value={location} onChange={event => setLocation(event.target.value)}>
            <option value="">All locations</option>
            {locations.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="fc-panel" style={{ padding: 14, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="fc-card fc-card--pad">Loading active jobs...</div>
      ) : filtered.length === 0 ? (
        <div className="fc-card fc-card--pad">No active jobs match your filters.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {filtered.map(job => (
            <button
              key={job.job_id}
              className="fc-card fc-card--pad fc-card--lift"
              onClick={() => setSelected(job)}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {job.company.logo_url ? (
                  <img src={job.company.logo_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                ) : (
                  <Building2 size={32} />
                )}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{job.company.name}</div>
                  <h3>{job.title}</h3>
                </div>
              </div>
              <p><MapPin size={13} style={{ display: 'inline' }} /> {job.location} - {job.employment_type}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="fc-badge fc-badge--green">{job.openings_count} openings</span>
                {applicationByJob.has(job.job_id) && (
                  <span className="fc-badge fc-badge--blue">Applied</span>
                )}
                <span>
                  <Calendar size={12} style={{ display: 'inline' }} /> Apply by{' '}
                  {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'open'}
                </span>
              </div>
              <p>
                {job.about_job?.slice(0, 150)}
                {(job.about_job?.length ?? 0) > 150 ? '...' : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-detail-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.55)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
          onClick={() => setSelected(null)}
        >
          <article
            className="fc-card fc-card--pad"
            onClick={event => event.stopPropagation()}
            style={{ width: 'min(820px,100%)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div className="fc-eyebrow">{selected.company.name}</div>
                <h2 id="job-detail-title">{selected.title}</h2>
                <p>
                  <MapPin size={13} style={{ display: 'inline' }} /> {selected.location} -{' '}
                  {selected.employment_type} - {selected.openings_count} openings
                </p>
              </div>
              <button
                className="fc-btn fc-btn--secondary"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              {applicationByJob.has(selected.job_id) ? (
                <button
                  className="fc-btn fc-btn--primary"
                  onClick={() => viewTracking(applicationByJob.get(selected.job_id)!)}
                >
                  <ExternalLink size={15} /> View tracking
                </button>
              ) : (
                <button className="fc-btn fc-btn--primary" onClick={() => setApplyJob(selected)}>
                  <Send size={15} /> Apply now
                </button>
              )}
              {selected.company.website_url && (
                <a
                  href={selected.company.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="fc-btn fc-btn--secondary"
                >
                  <ExternalLink size={14} /> Company website
                </a>
              )}
            </div>

            {sections.map(([key, label]) => (
              <section key={key} style={{ marginTop: 22 }}>
                <div className="fc-section-title">
                  <Briefcase size={15} />
                  <h3>{label}</h3>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                  {selected[key] || 'Not provided.'}
                </p>
              </section>
            ))}
          </article>
        </div>
      )}

      {applyJob && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.68)',
            zIndex: 120,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
          onClick={closeApply}
        >
          <article
            className="fc-card fc-card--pad"
            onClick={event => event.stopPropagation()}
            style={{ width: 'min(620px,100%)', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div>
                <div className="fc-eyebrow">Application</div>
                <h2 id="apply-dialog-title">Apply for {applyJob.title}</h2>
                <p>{applyJob.company.name}</p>
              </div>
              <button
                type="button"
                className="fc-icon-btn"
                aria-label="Close application"
                onClick={closeApply}
                disabled={submitting}
              >
                <X size={17} />
              </button>
            </div>

            {submittedApplicationId ? (
              <div style={{ textAlign: 'center', padding: '28px 10px 10px' }}>
                <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 14px' }} />
                <h3>Application submitted</h3>
                <p style={{ color: 'var(--text-secondary)', margin: '8px auto 22px', maxWidth: 420 }}>
                  Your information and CV were sent to {applyJob.company.name}. You can follow the next
                  steps in your application tracker.
                </p>
                <button
                  className="fc-btn fc-btn--primary"
                  onClick={() => viewTracking(submittedApplicationId)}
                >
                  <ExternalLink size={15} /> View application tracking
                </button>
              </div>
            ) : (
              <form onSubmit={submitApplication}>
                {profileLoading && (
                  <div className="fc-panel" style={{ padding: 12, marginBottom: 14 }}>
                    <LoaderCircle
                      size={15}
                      style={{
                        display: 'inline',
                        marginRight: 8,
                        animation: 'fc-spin .8s linear infinite',
                      }}
                    />
                    Loading your profile...
                  </div>
                )}

                {applyError && (
                  <div role="alert" className="fc-panel" style={{ padding: 12, marginBottom: 14, color: 'var(--danger)' }}>
                    {applyError}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                    gap: 14,
                  }}
                >
                  <label style={{ gridColumn: '1 / -1' }}>
                    <span className="fc-field-label">Full name</span>
                    <input
                      className="fc-input"
                      value={applyForm.fullName}
                      onChange={event => setApplyForm(current => ({ ...current, fullName: event.target.value }))}
                      autoComplete="name"
                      disabled={submitting}
                    />
                  </label>
                  <label>
                    <span className="fc-field-label">Email</span>
                    <input
                      className="fc-input"
                      type="email"
                      value={applyForm.email}
                      onChange={event => setApplyForm(current => ({ ...current, email: event.target.value }))}
                      autoComplete="email"
                      disabled={submitting}
                    />
                  </label>
                  <label>
                    <span className="fc-field-label">Phone</span>
                    <input
                      className="fc-input"
                      type="tel"
                      value={applyForm.phone}
                      onChange={event => setApplyForm(current => ({ ...current, phone: event.target.value }))}
                      autoComplete="tel"
                      disabled={submitting}
                    />
                  </label>
                </div>

                <label
                  style={{
                    display: 'block',
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 8,
                    padding: 18,
                    marginTop: 16,
                    background: 'var(--surface-2)',
                    cursor: submitting ? 'default' : 'pointer',
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={chooseCv}
                    disabled={submitting}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 8,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {cvFile ? <FileText size={21} /> : <Upload size={21} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                        {cvFile ? cvFile.name : 'Choose your CV'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        PDF only, maximum 10MB. Scanned PDFs are processed automatically with OCR.
                        {cvFile ? ` - ${(cvFile.size / 1024 / 1024).toFixed(2)}MB` : ''}
                      </div>
                    </div>
                  </div>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                  <button type="button" className="fc-btn fc-btn--secondary" onClick={closeApply} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="fc-btn fc-btn--primary" disabled={submitting || profileLoading}>
                    {submitting
                      ? <LoaderCircle size={15} style={{ animation: 'fc-spin .8s linear infinite' }} />
                      : <Send size={15} />}
                    {submitting ? 'Submitting...' : 'Submit application'}
                  </button>
                </div>
              </form>
            )}
          </article>
        </div>
      )}
    </div>
  )
}
