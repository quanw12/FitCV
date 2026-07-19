import { useEffect, useState, type FormEvent } from 'react'
import { Briefcase, Edit3, Plus, RotateCcw, Save, XCircle } from 'lucide-react'
import { jobsApi } from '@/api/jobsApi'
import type { JobPost, JobWrite } from '@/types/jobs'

const emptyForm: JobWrite = {
  title: '', about_job: '', responsibilities: '', requirements: '',
  we_offer: '', life_at_company: '', hiring_process: '', location: '',
  employment_type: '', deadline: '', openings_count: 1,
}
const sections = [
  ['about_job', 'About the job'], ['responsibilities', 'Responsibilities'],
  ['requirements', 'Requirements'], ['we_offer', 'We offer'],
  ['life_at_company', 'Life at company'], ['hiring_process', 'How we hire'],
] as const

const hasTimezone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
const padDatePart = (value: number) => String(value).padStart(2, '0')

const toLocalDateTimeInput = (value: string | null) => {
  if (!value) return ''
  const date = new Date(hasTimezone(value) ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

const toUtcIso = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export default function JobPostsScreen() {
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [form, setForm] = useState<JobWrite>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { setJobs(await jobsApi.listManaged()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load jobs.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const set = (key: keyof JobWrite, value: string | number) => setForm(current => ({ ...current, [key]: value }))
  const reset = () => { setForm(emptyForm); setEditingId(null); setError('') }
  const edit = (job: JobPost) => {
    setEditingId(job.job_id)
    setForm({
      title: job.title, about_job: job.about_job ?? '',
      responsibilities: job.responsibilities ?? '', requirements: job.requirements ?? '',
      we_offer: job.we_offer ?? '', life_at_company: job.life_at_company ?? '',
      hiring_process: job.hiring_process ?? '', location: job.location ?? '',
      employment_type: job.employment_type ?? '',
      deadline: toLocalDateTimeInput(job.deadline), openings_count: job.openings_count,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) { setError('A title is required, even for a draft.'); return }
    const deadline = toUtcIso(form.deadline)
    if (deadline === undefined) { setError('Enter a valid deadline.'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, deadline }
      if (editingId) await jobsApi.update(editingId, payload)
      else await jobsApi.create(payload)
      reset(); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save job.') }
    finally { setSaving(false) }
  }
  const changeStatus = async (job: JobPost, action: 'publish' | 'close') => {
    setSaving(true); setError('')
    try { await jobsApi[action](job.job_id); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update status.') }
    finally { setSaving(false) }
  }

  return <div className="fc-stagger">
    <div className="fc-page-head"><div><div className="fc-eyebrow">Recruitment</div><h1>Job Post Management</h1><p>Create, publish, and maintain your company jobs.</p></div></div>
    {error && <div className="fc-panel" role="alert" style={{ padding: 14, color: 'var(--danger)', marginBottom: 18 }}>{error}</div>}
    <form className="fc-card fc-card--pad" onSubmit={save} style={{ marginBottom: 28 }}>
      <div className="fc-section-title" style={{ marginBottom: 20 }}><Briefcase size={17}/><h2>{editingId ? 'Edit draft or closed job' : 'Create job draft'}</h2></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
        <label><span className="fc-field-label">Title *</span><input className="fc-input" value={form.title} onChange={e => set('title', e.target.value)} required /></label>
        <label><span className="fc-field-label">Location</span><input className="fc-input" value={form.location ?? ''} onChange={e => set('location', e.target.value)} /></label>
        <label><span className="fc-field-label">Employment type</span><input className="fc-input" value={form.employment_type ?? ''} onChange={e => set('employment_type', e.target.value)} placeholder="Full-time" /></label>
        <label><span className="fc-field-label">Deadline</span><input className="fc-input" type="datetime-local" value={form.deadline ?? ''} onChange={e => set('deadline', e.target.value)} /></label>
        <label><span className="fc-field-label">Openings</span><input className="fc-input" type="number" min={1} value={form.openings_count ?? 1} onChange={e => set('openings_count', Number(e.target.value))} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginTop: 14 }}>
        {sections.map(([key, label]) => <label key={key}><span className="fc-field-label">{label}</span><textarea className="fc-input" style={{ minHeight: 110 }} value={form[key] ?? ''} onChange={e => set(key, e.target.value)} /></label>)}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="fc-btn fc-btn--primary" disabled={saving}><Save size={15}/>{saving ? 'Saving...' : 'Save draft'}</button>
        <button className="fc-btn fc-btn--secondary" type="button" onClick={reset}><RotateCcw size={15}/>Reset</button>
      </div>
    </form>
    <div className="fc-section-title" style={{ marginBottom: 14 }}><Briefcase size={17}/><h2>All company jobs</h2><span>{jobs.length} total</span></div>
    {loading ? <div className="fc-card fc-card--pad">Loading jobs...</div> : jobs.length === 0 ? <div className="fc-card fc-card--pad">No jobs yet. Create the first draft above.</div> :
      <div style={{ display: 'grid', gap: 12 }}>{jobs.map(job => <article className="fc-card fc-card--pad" key={job.job_id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><h3>{job.title}</h3><p>{job.location || 'Location pending'} - {job.employment_type || 'Type pending'}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className="fc-badge fc-badge--blue">{job.status}</span><span>{job.openings_count} openings</span><span>{job.application_count} applications</span></div>
            <p>Created {new Date(job.created_at).toLocaleDateString()} - Deadline {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'not set'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {job.status !== 'Published' && <button className="fc-btn fc-btn--secondary" onClick={() => edit(job)}><Edit3 size={14}/>Edit</button>}
            {job.status !== 'Published' && <button className="fc-btn fc-btn--primary" disabled={saving} onClick={() => void changeStatus(job, 'publish')}><Plus size={14}/>{job.status === 'Closed' ? 'Reopen' : 'Publish'}</button>}
            {job.status === 'Published' && <button className="fc-btn fc-btn--secondary" disabled={saving} onClick={() => void changeStatus(job, 'close')}><XCircle size={14}/>Close</button>}
          </div>
        </div>
      </article>)}</div>}
  </div>
}
