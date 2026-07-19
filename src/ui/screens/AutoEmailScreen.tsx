import { useState } from 'react'
import { Mail, CheckCircle, Send, Users, Sparkles, Check } from 'lucide-react'

const templates = [
  { id: 'confirmation', icon: '✅', label: 'Application Confirmation', color: '#10B981', bg: '#D1FAE5' },
  { id: 'shortlist', icon: '⭐', label: 'Shortlist Notification', color: '#4F46E5', bg: '#EEF2FF' },
  { id: 'rejection', icon: '❌', label: 'Rejection (Polite)', color: '#EF4444', bg: '#FEE2E2' },
  { id: 'interview', icon: '📅', label: 'Interview Invitation', color: '#F59E0B', bg: '#FEF3C7' },
]

const emailContent: Record<string, { subject: string; body: string[] }> = {
  confirmation: {
    subject: 'Application Received — Senior Backend Developer at TechViet Solutions',
    body: [
      "Dear {candidateName},",
      "Thank you for applying for the Senior Backend Developer position at TechViet Solutions. We have successfully received your application and our team will carefully review your profile.",
      "Based on your CV, we noticed your strong experience in {topSkill} — which is exactly what we're looking for in this role.",
      "We will be in touch within 5 business days regarding the next steps.",
      "Best regards,\nTech Recruitment Team\nTechViet Solutions",
    ],
  },
  shortlist: {
    subject: "You've been shortlisted — Senior Backend Developer at TechViet Solutions",
    body: [
      "Dear {candidateName},",
      "Congratulations! After reviewing your application for the Senior Backend Developer role, we are pleased to inform you that your profile has been shortlisted for the next stage.",
      "Your expertise in {topSkill} and {yearsExp} of experience stood out among {totalCandidates} applicants.",
      "Please expect a call from our HR team within the next 48 hours to schedule a technical interview.",
      "Best regards,\nTech Recruitment Team\nTechViet Solutions",
    ],
  },
  rejection: {
    subject: 'Update on your application — TechViet Solutions',
    body: [
      "Dear {candidateName},",
      "Thank you for taking the time to apply for the Senior Backend Developer position at TechViet Solutions and for your interest in joining our team.",
      "After careful consideration of all applications, we regret to inform you that we will not be moving forward with your application at this time. This was a difficult decision given the high quality of candidates we received.",
      "We encourage you to apply for future openings that match your profile. We will keep your details on file.",
      "Best regards,\nTech Recruitment Team\nTechViet Solutions",
    ],
  },
  interview: {
    subject: 'Interview Invitation — Senior Backend Developer at TechViet Solutions',
    body: [
      "Dear {candidateName},",
      "We are delighted to invite you for a technical interview for the Senior Backend Developer position at TechViet Solutions.",
      "Your background in {topSkill} and your impressive match score of {matchScore}% have impressed our team greatly.",
      "Interview Details:\n📅 Date: July 15, 2025 at 10:00 AM (GMT+7)\n📍 Format: Video call (Google Meet)\n⏱ Duration: 60 minutes",
      "Please confirm your availability by replying to this email.",
      "Best regards,\nTech Recruitment Team\nTechViet Solutions",
    ],
  },
}

const highlights: Record<string, string> = {
  '{candidateName}': 'Nguyen Thanh Minh',
  '{topSkill}': 'Node.js & Docker',
  '{yearsExp}': '6 years',
  '{totalCandidates}': '47',
  '{matchScore}': '92',
}

const steps = [
  { label: 'AI Drafts', icon: <Sparkles size={16} />, done: true },
  { label: 'HR Reviews', icon: <Mail size={16} />, done: true },
  { label: 'HR Approves & Sends', icon: <Send size={16} />, done: false },
]

const badgeFor = (color: string) => {
  if (color === '#10B981') return 'fc-badge fc-badge--green'
  if (color === '#4F46E5') return 'fc-badge fc-badge--blue'
  if (color === '#EF4444') return 'fc-badge fc-badge--red'
  if (color === '#F59E0B') return 'fc-badge fc-badge--amber'
  return 'fc-badge fc-badge--gray'
}

export default function AutoEmailScreen() {
  const [selectedTemplate, setSelectedTemplate] = useState('shortlist')
  const [sent, setSent] = useState(false)

  const content = emailContent[selectedTemplate]

  const renderBody = (text: string) => {
    let result = text
    Object.entries(highlights).forEach(([k, v]) => {
      result = result.split(k).join(`<mark style="background:var(--accent-soft);color:var(--accent-ink);padding:1px 5px;border-radius:5px;font-weight:600;">${v}</mark>`)
    })
    return result
  }

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>HR · Smart Communications</div>
          <h1>Auto Email &amp; Smart Reply</h1>
          <p>AI-drafted emails, personalized per candidate.</p>
        </div>
        <span className="fc-badge fc-badge--amber"><Sparkles size={12} /> AI-Powered</span>
      </div>

      <div className="fc-stagger" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column — library + analytics */}
        <div className="fc-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Template library */}
          <div className="fc-card fc-card--pad">
            <div className="fc-section-title" style={{ marginBottom: 14 }}>
              <Mail size={16} color="var(--accent)" />
              <h3>Template Library</h3>
            </div>
            {templates.map(t => {
              const active = selectedTemplate === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); setSent(false) }}
                  className="fc-chip"
                  style={{
                    width: '100%', justifyContent: 'flex-start', padding: '12px 14px', marginBottom: 8,
                    border: active ? `1px solid ${t.color}` : '1px solid var(--border)',
                    background: active ? `${t.color}1a` : 'var(--surface)',
                    color: active ? t.color : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{t.label}</span>
                  {active && <span className={badgeFor(t.color)} style={{ fontSize: 10, padding: '2px 8px' }}>Active</span>}
                </button>
              )
            })}
          </div>

          {/* Email analytics */}
          <div className="fc-card fc-card--pad">
            <div className="fc-eyebrow" style={{ marginBottom: 14 }}>Email Analytics</div>
            {[
              { label: 'Open Rate', value: '84%', icon: '👁️' },
              { label: 'Click Rate', value: '31%', icon: '🔗' },
              { label: 'Reply Rate', value: '22%', icon: '↩️' },
            ].map((a, i) => (
              <div
                key={a.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 0',
                  borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div className="fc-stat__icon" style={{ width: 34, height: 34, background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 15, borderRadius: 10 }}>
                  {a.icon}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{a.label}</span>
                <span className="fc-stat__value" style={{ fontSize: 20 }}>{a.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — workflow + preview */}
        <div className="fc-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Workflow stepper */}
          <div className="fc-card fc-card--pad">
            <div className="fc-eyebrow" style={{ marginBottom: 16, textAlign: 'center' }}>Review Workflow</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {steps.map((step, i) => (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: step.done ? 'var(--accent)' : 'var(--surface)',
                        border: step.done ? 'none' : '2px solid var(--accent-soft-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: step.done ? '#fff' : 'var(--accent)',
                        boxShadow: step.done ? '0 6px 16px var(--accent-glow)' : 'none',
                      }}
                    >
                      {step.done ? <Check size={17} /> : step.icon}
                    </div>
                    <span
                      style={{
                        fontSize: 11.5, fontWeight: step.done ? 700 : 500,
                        color: step.done ? 'var(--text-primary)' : 'var(--accent)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      style={{
                        width: 78, height: 2,
                        background: step.done ? 'var(--accent)' : 'var(--border)',
                        margin: '0 10px', marginBottom: 24, borderRadius: 2,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Email preview */}
          <div className="fc-card fc-card--pad">
            <div className="fc-section-title" style={{ marginBottom: 16 }}>
              <Send size={16} color="var(--accent)" />
              <h3>Email Preview</h3>
              <span>Draft · {templates.find(t => t.id === selectedTemplate)?.label}</span>
            </div>

            <div className="fc-panel" style={{ padding: '14px 18px', marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, fontWeight: 600 }}>To:</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Nguyen Thanh Minh &lt;ntminh@gmail.com&gt;</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, fontWeight: 600 }}>Subject:</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{content.subject}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              {content.body.map((para, i) => (
                <p
                  key={i}
                  style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-line' }}
                  dangerouslySetInnerHTML={{ __html: renderBody(para) }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              {sent ? (
                <div
                  className="fc-panel"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--success-soft)', borderColor: '#bbf7d0' }}
                >
                  <CheckCircle size={18} color="var(--success)" />
                  <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14 }}>Email sent successfully!</span>
                </div>
              ) : (
                <>
                  <button onClick={() => setSent(true)} className="fc-btn fc-btn--primary">
                    <Send size={15} /> Approve &amp; Send
                  </button>
                  <button className="fc-btn fc-btn--secondary">
                    <Users size={15} /> Bulk Send to Filtered Group
                  </button>
                  <button className="fc-btn fc-btn--secondary">
                    Edit Draft
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
