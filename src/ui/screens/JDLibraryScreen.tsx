import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Building2, Calendar, ExternalLink, MapPin, Search, X } from 'lucide-react'
import { jobsApi } from '@/api/jobsApi'
import type { JobPost } from '@/types/jobs'

const sections = [
  ['about_job', 'About the job'], ['responsibilities', 'Responsibilities'], ['requirements', 'Requirements'],
  ['we_offer', 'We offer'], ['life_at_company', 'Life at company'], ['hiring_process', 'How we hire'],
] as const

export default function JDLibraryScreen() {
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [selected, setSelected] = useState<JobPost | null>(null)
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { jobsApi.listPublic().then(setJobs).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load jobs.')).finally(() => setLoading(false)) }, [])
  const locations = useMemo(() => [...new Set(jobs.map(job => job.location).filter((item): item is string => Boolean(item)))], [jobs])
  const filtered = jobs.filter(job => `${job.title} ${job.company.name} ${job.location ?? ''} ${job.employment_type ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (!location || job.location === location))

  return <div className="fc-stagger">
    <div className="fc-page-head"><div><div className="fc-eyebrow">Opportunities</div><h1>Job Library</h1><p>Browse active jobs published by FitCV companies.</p></div></div>
    <div className="fc-card fc-card--pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 20 }}>
      <label><span className="fc-field-label">Search jobs</span><div style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, top: 12 }}/><input className="fc-input" style={{ paddingLeft: 38 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Title, company, or type" /></div></label>
      <label><span className="fc-field-label">Location</span><select className="fc-input" value={location} onChange={e => setLocation(e.target.value)}><option value="">All locations</option>{locations.map(item => <option key={item}>{item}</option>)}</select></label>
    </div>
    {error && <div role="alert" className="fc-panel" style={{ padding: 14, color: 'var(--danger)' }}>{error}</div>}
    {loading ? <div className="fc-card fc-card--pad">Loading active jobs...</div> : filtered.length === 0 ? <div className="fc-card fc-card--pad">No active jobs match your filters.</div> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>{filtered.map(job =>
        <button key={job.job_id} className="fc-card fc-card--pad fc-card--lift" onClick={() => setSelected(job)} style={{ textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{job.company.logo_url ? <img src={job.company.logo_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }}/> : <Building2 size={32}/>}<div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{job.company.name}</div><h3>{job.title}</h3></div></div>
          <p><MapPin size={13} style={{ display: 'inline' }}/> {job.location} - {job.employment_type}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className="fc-badge fc-badge--green">{job.openings_count} openings</span><span><Calendar size={12} style={{ display: 'inline' }}/> Apply by {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'open'}</span></div>
          <p>{job.about_job?.slice(0, 150)}{(job.about_job?.length ?? 0) > 150 ? '...' : ''}</p>
        </button>)}</div>}
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="job-detail-title" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setSelected(null)}>
      <article className="fc-card fc-card--pad" onClick={event => event.stopPropagation()} style={{ width: 'min(820px,100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><div><div className="fc-eyebrow">{selected.company.name}</div><h2 id="job-detail-title">{selected.title}</h2><p><MapPin size={13} style={{ display: 'inline' }}/> {selected.location} - {selected.employment_type} - {selected.openings_count} openings</p></div><button className="fc-btn fc-btn--secondary" aria-label="Close details" onClick={() => setSelected(null)}><X size={16}/></button></div>
        {selected.company.website_url && <a href={selected.company.website_url} target="_blank" rel="noreferrer" className="fc-btn fc-btn--secondary"><ExternalLink size={14}/>Company website</a>}
        {sections.map(([key, label]) => <section key={key} style={{ marginTop: 22 }}><div className="fc-section-title"><Briefcase size={15}/><h3>{label}</h3></div><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{selected[key] || 'Not provided.'}</p></section>)}
        <p style={{ marginTop: 22, color: 'var(--text-secondary)' }}>Application submission is not available in this view.</p>
      </article>
    </div>}
  </div>
}
