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

export default function AutoEmailScreen() {
  const [selectedTemplate, setSelectedTemplate] = useState('shortlist')
  const [sent, setSent] = useState(false)

  const content = emailContent[selectedTemplate]

  const renderBody = (text: string) => {
    let result = text
    Object.entries(highlights).forEach(([k, v]) => {
      result = result.split(k).join(`<mark style="background:#EEF2FF;color:#4F46E5;padding:1px 4px;border-radius:4px;font-weight:600;">${v}</mark>`)
    })
    return result
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Auto Email & Smart Reply</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>AI-drafted emails, personalized per candidate.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Template library */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fitcv-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Template Library</div>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTemplate(t.id); setSent(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px',
                  borderRadius: 10, border: selectedTemplate === t.id ? `1px solid ${t.color}` : '1px solid transparent',
                  background: selectedTemplate === t.id ? t.bg : 'transparent', cursor: 'pointer',
                  marginBottom: 6, transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ fontSize: 13, fontWeight: selectedTemplate === t.id ? 700 : 500, color: selectedTemplate === t.id ? t.color : 'var(--text-secondary)', textAlign: 'left' }}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>

          {/* Analytics preview */}
          <div className="fitcv-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Email Analytics</div>
            {[{ label: 'Open Rate', value: '84%', icon: '👁️' }, { label: 'Click Rate', value: '31%', icon: '🔗' }, { label: 'Reply Rate', value: '22%', icon: '↩️' }].map(a => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.icon} {a.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>{a.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Workflow indicator */}
          <div className="fitcv-card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
            {steps.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: step.done ? (i === steps.length - 1 ? '#10B981' : '#4F46E5') : 'var(--bg)',
                    border: step.done ? 'none' : '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: step.done ? 'white' : 'var(--text-muted)',
                  }}>
                    {step.done && i < steps.length - 1 ? <Check size={16} /> : step.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: step.done ? 700 : 400, color: step.done ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 80, height: 2, background: steps[i + 1].done ? '#4F46E5' : 'var(--border)', margin: '0 8px', marginBottom: 22 }} />
                )}
              </div>
            ))}
          </div>

          {/* Email card */}
          <div className="fitcv-card" style={{ padding: 24 }}>
            <div style={{ padding: '14px 18px', background: 'var(--bg)', borderRadius: 10, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48 }}>To:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Nguyen Thanh Minh &lt;ntminh@gmail.com&gt;</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48 }}>Subject:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{content.subject}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              {content.body.map((para, i) => (
                <p key={i} style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-line' }}
                  dangerouslySetInnerHTML={{ __html: renderBody(para) }} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              {sent ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#D1FAE5', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: 14 }}>
                  <CheckCircle size={18} color="#10B981" /> Email sent successfully!
                </div>
              ) : (
                <>
                  <button onClick={() => setSent(true)} className="fitcv-btn-primary" style={{ gap: 8 }}>
                    <Send size={15} /> Approve & Send
                  </button>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    <Users size={15} /> Bulk Send to Filtered Group
                  </button>
                  <button style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
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
