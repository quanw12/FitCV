import { useState } from "react"

import { CaretDown, CaretUp, Plus, Trash } from "@phosphor-icons/react"

import type { CvBuildPayload } from "@/api/cvRebuildApi"

interface CVBuildFormProps {
  avatarUrl?: string | null

  busy: boolean

  onSubmit: (payload: CvBuildPayload) => void
}

interface LinkEntry {
  label: string

  url: string
}

interface ExperienceEntry {
  title: string

  company: string

  location: string

  date: string

  bullets: string
}

interface ProjectEntry {
  name: string

  description: string
}

interface EducationEntry {
  degree: string

  institution: string

  date: string
}

interface LanguageEntry {
  name: string

  proficiency: string
}

interface PublicationEntry {
  title: string

  venue: string

  date: string
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean)
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "white",
  padding: 20,
}

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
  minWidth: 0,
}

export default function CVBuildForm({
  avatarUrl,
  busy,
  onSubmit,
}: CVBuildFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [links, setLinks] = useState<LinkEntry[]>([])
  const [summary, setSummary] = useState("")
  const [experience, setExperience] = useState<ExperienceEntry[]>([])
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [education, setEducation] = useState<EducationEntry[]>([])
  const [languages, setLanguages] = useState<LanguageEntry[]>([])
  const [skillsText, setSkillsText] = useState("")
  const [certificationsText, setCertificationsText] = useState("")
  const [awardsText, setAwardsText] = useState("")
  const [publications, setPublications] = useState<PublicationEntry[]>([])
  const [language, setLanguage] = useState<"en" | "vi">("en")
  const [useAvatar, setUseAvatar] = useState(false)

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Please enter your full name.")

      return
    }

    const payload: CvBuildPayload = {
      language,
      avatar:
        useAvatar && avatarUrl ? avatarUrl : undefined,
      cv: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        links: links
          .filter((link) => link.url.trim())
          .map((link) => ({
            label: link.label.trim(),
            url: link.url.trim(),
          })),
        summary: summary.trim(),
        experience: experience
          .filter((entry) => entry.title.trim() || entry.company.trim())
          .map((entry) => ({
            title: entry.title.trim(),
            company: entry.company.trim(),
            location: entry.location.trim(),
            date: entry.date.trim(),
            bullets: splitLines(entry.bullets),
          })),
        core_competencies: [],
        skills: splitList(skillsText),
        skill_groups: [],
        projects: projects
          .filter((entry) => entry.name.trim())
          .map((entry) => ({
            name: entry.name.trim(),
            description: entry.description.trim(),
            links: [],
          })),
        certifications: splitList(certificationsText),
        education: education
          .filter((entry) => entry.degree.trim() || entry.institution.trim())
          .map((entry) => ({
            degree: entry.degree.trim(),
            institution: entry.institution.trim(),
            date: entry.date.trim(),
          })),
        languages: languages
          .filter((entry) => entry.name.trim())
          .map((entry) => ({
            name: entry.name.trim(),
            proficiency: entry.proficiency.trim(),
          })),
        publications: publications
          .filter((entry) => entry.title.trim())
          .map((entry) => ({
            title: entry.title.trim(),
            venue: entry.venue.trim(),
            date: entry.date.trim(),
          })),
        awards: splitList(awardsText),
      },
    }

    onSubmit(payload)
  }

  const updateList = <T,>(
    setter: (updater: (list: T[]) => T[]) => void,
    index: number,
    next: T,
  ) => setter((list) => list.map((item, i) => (i === index ? next : item)))

  const removeList = <T,>(
    setter: (updater: (list: T[]) => T[]) => void,
    index: number,
  ) => setter((list) => list.filter((_, i) => i !== index))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`@keyframes fitcv-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Personal information
        </h3>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ ...fieldStyle, flexBasis: 240 }}>
            <label style={labelStyle} htmlFor="cv-build-name">Full name *</label>
            <input
              id="cv-build-name"
              data-testid="cv-build-name"
              style={inputStyle}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nguyen Van A"
            />
          </div>
          <div style={{ ...fieldStyle, flexBasis: 240 }}>
            <label style={labelStyle} htmlFor="cv-build-email">Email</label>
            <input
              id="cv-build-email"
              style={inputStyle}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="a@example.com"
            />
          </div>
          <div style={{ ...fieldStyle, flexBasis: 200 }}>
            <label style={labelStyle} htmlFor="cv-build-phone">Phone</label>
            <input
              id="cv-build-phone"
              style={inputStyle}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+84 912 345 678"
            />
          </div>
        </div>

        {links.map((link, index) => (
          <div key={index} style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end" }}>
            <div style={{ ...fieldStyle, flexBasis: 160 }}>
              <label style={labelStyle}>Label</label>
              <input
                style={inputStyle}
                value={link.label}
                onChange={(event) =>
                  updateList(setLinks, index, { ...link, label: event.target.value })
                }
                placeholder="LinkedIn"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 320 }}>
              <label style={labelStyle}>URL</label>
              <input
                style={inputStyle}
                value={link.url}
                onChange={(event) =>
                  updateList(setLinks, index, { ...link, url: event.target.value })
                }
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <button
              type="button"
              aria-label="Remove link"
              onClick={() => removeList(setLinks, index)}
              style={{
                ...inputStyle,
                width: 40,
                flex: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        {links.length < 5 && (
          <button
            type="button"
            onClick={() => setLinks((list) => [...list, { label: "", url: "" }])}
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "none",
              color: "var(--accent)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Plus size={14} weight="bold" /> Add link
          </button>
        )}

        <label style={{ ...labelStyle, marginTop: 16 }} htmlFor="cv-build-summary">
          Summary / career goal
        </label>
        <textarea
          id="cv-build-summary"
          data-testid="cv-build-summary"
          style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Short intro and the role you are aiming for..."
        />
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Experience
        </h3>
        {experience.map((entry, index) => (
          <div key={index} style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ ...fieldStyle, flexBasis: 220 }}>
                <label style={labelStyle}>Title</label>
                <input
                  style={inputStyle}
                  value={entry.title}
                  onChange={(event) =>
                    updateList(setExperience, index, { ...entry, title: event.target.value })
                  }
                  placeholder="Backend Engineer"
                />
              </div>
              <div style={{ ...fieldStyle, flexBasis: 180 }}>
                <label style={labelStyle}>Company</label>
                <input
                  style={inputStyle}
                  value={entry.company}
                  onChange={(event) =>
                    updateList(setExperience, index, { ...entry, company: event.target.value })
                  }
                  placeholder="Acme"
                />
              </div>
              <div style={{ ...fieldStyle, flexBasis: 140 }}>
                <label style={labelStyle}>Location</label>
                <input
                  style={inputStyle}
                  value={entry.location}
                  onChange={(event) =>
                    updateList(setExperience, index, { ...entry, location: event.target.value })
                  }
                  placeholder="Ho Chi Minh City"
                />
              </div>
              <div style={{ ...fieldStyle, flexBasis: 150 }}>
                <label style={labelStyle}>Dates</label>
                <input
                  style={inputStyle}
                  value={entry.date}
                  onChange={(event) =>
                    updateList(setExperience, index, { ...entry, date: event.target.value })
                  }
                  placeholder="2022 — Present"
                />
              </div>
              <button
                type="button"
                aria-label={`Remove experience ${index + 1}`}
                onClick={() => removeList(setExperience, index)}
                style={{
                  ...inputStyle,
                  width: 40,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  alignSelf: "flex-end",
                }}
              >
                <Trash size={16} />
              </button>
            </div>
            <label style={{ ...labelStyle, marginTop: 10 }}>Bullets (one per line)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              value={entry.bullets}
              onChange={(event) =>
                updateList(setExperience, index, { ...entry, bullets: event.target.value })
              }
              placeholder={"Built payment APIs with JWT auth...\nCut API latency by 42% with Redis..."}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setExperience((list) => [
              ...list,
              { title: "", company: "", location: "", date: "", bullets: "" },
            ])
          }
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "none",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={14} weight="bold" /> Add experience
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Education
        </h3>
        {education.map((entry, index) => (
          <div key={index} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ ...fieldStyle, flexBasis: 220 }}>
              <label style={labelStyle}>Degree</label>
              <input
                style={inputStyle}
                value={entry.degree}
                onChange={(event) =>
                  updateList(setEducation, index, { ...entry, degree: event.target.value })
                }
                placeholder="B.Sc. in Computer Science"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 220 }}>
              <label style={labelStyle}>Institution</label>
              <input
                style={inputStyle}
                value={entry.institution}
                onChange={(event) =>
                  updateList(setEducation, index, { ...entry, institution: event.target.value })
                }
                placeholder="University of Science, VNU-HCM"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 140 }}>
              <label style={labelStyle}>Dates</label>
              <input
                style={inputStyle}
                value={entry.date}
                onChange={(event) =>
                  updateList(setEducation, index, { ...entry, date: event.target.value })
                }
                placeholder="2016 — 2020"
              />
            </div>
            <button
              type="button"
              aria-label={`Remove education ${index + 1}`}
              onClick={() => removeList(setEducation, index)}
              style={{
                ...inputStyle,
                width: 40,
                flex: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEducation((list) => [...list, { degree: "", institution: "", date: "" }])
          }
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "none",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={14} weight="bold" /> Add education
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Projects
        </h3>
        {projects.map((entry, index) => (
          <div key={index} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "flex-end" }}>
            <div style={{ ...fieldStyle, flexBasis: 220 }}>
              <label style={labelStyle}>Name</label>
              <input
                style={inputStyle}
                value={entry.name}
                onChange={(event) =>
                  updateList(setProjects, index, { ...entry, name: event.target.value })
                }
                placeholder="FitCV"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 340 }}>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={entry.description}
                onChange={(event) =>
                  updateList(setProjects, index, { ...entry, description: event.target.value })
                }
                placeholder="What you built and the tech you used (JWT, VNPay...)"
              />
            </div>
            <button
              type="button"
              aria-label={`Remove project ${index + 1}`}
              onClick={() => removeList(setProjects, index)}
              style={{
                ...inputStyle,
                width: 40,
                flex: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setProjects((list) => [...list, { name: "", description: "" }])}
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "none",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={14} weight="bold" /> Add project
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Skills & more
        </h3>
        <label style={labelStyle} htmlFor="cv-build-skills">
          Skills (comma separated)
        </label>
        <input
          id="cv-build-skills"
          data-testid="cv-build-skills"
          style={inputStyle}
          value={skillsText}
          onChange={(event) => setSkillsText(event.target.value)}
          placeholder="Python, FastAPI, Docker, JWT..."
        />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ ...fieldStyle, flexBasis: 260 }}>
            <label style={labelStyle} htmlFor="cv-build-certs">Certifications (comma separated)</label>
            <input
              id="cv-build-certs"
              style={inputStyle}
              value={certificationsText}
              onChange={(event) => setCertificationsText(event.target.value)}
              placeholder="AWS Solutions Architect, CEH..."
            />
          </div>
          <div style={{ ...fieldStyle, flexBasis: 260 }}>
            <label style={labelStyle} htmlFor="cv-build-awards">Awards (comma separated)</label>
            <input
              id="cv-build-awards"
              style={inputStyle}
              value={awardsText}
              onChange={(event) => setAwardsText(event.target.value)}
              placeholder="Dean's List, Hackathon Winner..."
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Languages
        </h3>
        {languages.map((entry, index) => (
          <div key={index} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ ...fieldStyle, flexBasis: 200 }}>
              <label style={labelStyle}>Language</label>
              <input
                style={inputStyle}
                value={entry.name}
                onChange={(event) =>
                  updateList(setLanguages, index, { ...entry, name: event.target.value })
                }
                placeholder="English"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 240 }}>
              <label style={labelStyle}>Proficiency</label>
              <input
                style={inputStyle}
                value={entry.proficiency}
                onChange={(event) =>
                  updateList(setLanguages, index, { ...entry, proficiency: event.target.value })
                }
                placeholder="Fluent / Thành thạo"
              />
            </div>
            <button
              type="button"
              aria-label={`Remove language ${index + 1}`}
              onClick={() => removeList(setLanguages, index)}
              style={{
                ...inputStyle,
                width: 40,
                flex: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLanguages((list) => [...list, { name: "", proficiency: "" }])}
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "none",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={14} weight="bold" /> Add language
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          Publications
        </h3>
        {publications.map((entry, index) => (
          <div key={index} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ ...fieldStyle, flexBasis: 240 }}>
              <label style={labelStyle}>Title</label>
              <input
                style={inputStyle}
                value={entry.title}
                onChange={(event) =>
                  updateList(setPublications, index, { ...entry, title: event.target.value })
                }
                placeholder="Paper title"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 180 }}>
              <label style={labelStyle}>Venue</label>
              <input
                style={inputStyle}
                value={entry.venue}
                onChange={(event) =>
                  updateList(setPublications, index, { ...entry, venue: event.target.value })
                }
                placeholder="Journal"
              />
            </div>
            <div style={{ ...fieldStyle, flexBasis: 120 }}>
              <label style={labelStyle}>Date</label>
              <input
                style={inputStyle}
                value={entry.date}
                onChange={(event) =>
                  updateList(setPublications, index, { ...entry, date: event.target.value })
                }
                placeholder="2024"
              />
            </div>
            <button
              type="button"
              aria-label={`Remove publication ${index + 1}`}
              onClick={() => removeList(setPublications, index)}
              style={{
                ...inputStyle,
                width: 40,
                flex: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPublications((list) => [...list, { title: "", venue: "", date: "" }])}
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "none",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={14} weight="bold" /> Add publication
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
          CV options
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="cv-build-language">
            CV language
          </label>
          <div style={{ position: "relative" }}>
            <select
              id="cv-build-language"
              data-testid="cv-build-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as "en" | "vi")}
              style={{ ...inputStyle, width: 180, appearance: "none", paddingRight: 32, cursor: "pointer" }}
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
            <CaretDown
              size={14}
              weight="bold"
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-secondary)" }}
            />
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 10,
              fontSize: 14,
              color: avatarUrl ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: avatarUrl ? "pointer" : "not-allowed",
            }}
          >
            <input
              type="checkbox"
              data-testid="cv-build-avatar"
              checked={useAvatar}
              disabled={!avatarUrl || busy}
              onChange={(event) => setUseAvatar(event.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "inherit" }}
            />
            Use my profile avatar on the CV
          </label>
          {avatarUrl && useAvatar && (
            <img
              src={avatarUrl}
              alt="Profile avatar preview"
              data-testid="cv-build-avatar-preview"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
        {!avatarUrl && (
          <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
            No profile avatar yet — add one in Profile to use it on your CV.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          data-testid="cv-build-submit"
          onClick={handleSubmit}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 12,
            background: "var(--accent)",
            color: "white",
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <>
              <CaretUp size={16} style={{ animation: "fitcv-spin 1s linear infinite" }} />
              Building with AI…
            </>
          ) : (
            <>
              <Plus size={16} weight="bold" /> Build my CV
            </>
          )}
        </button>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          AI will polish your wording, group your skills, and render the PDF.
        </p>
      </div>
    </div>
  )
}
