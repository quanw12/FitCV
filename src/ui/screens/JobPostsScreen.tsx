import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

import {
  Archive,
  ArrowClockwise,
  ArrowCounterClockwise,
  Briefcase,
  CalendarBlank,
  CheckCircle,
  CopySimple,
  Eye,
  FloppyDisk,
  Link,
  MagicWand,
  MapPin,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Users,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react"

import { jobsApi } from "@/api/jobsApi"
import {
  getCachedResource,
  getOrFetchResource,
  setCachedResource,
} from "@/services/resourceCache"
import type { JobPost, JobStatus, JobWrite } from "@/types/jobs"

type JobListView = "active" | "archived"
type JobAction =
  | "publish"
  | "close"
  | "reopen"
  | "duplicate"
  | "archive"
  | "unarchive"

interface ManagedJobs {
  active: JobPost[]
  archived: JobPost[]
}

const JOB_POSTS_CACHE_KEY = "hr-job-posts:managed"

const weightFields = [
  ["skill_weight", "Skills", "Technical and role-specific skills"],
  ["experience_weight", "Experience", "Relevant work and project experience"],
  ["education_weight", "Education", "Degree and academic background"],
  ["soft_skill_weight", "Soft skills", "Communication and collaboration"],
] as const

const sections = [
  ["about_job", "About the job *"],
  ["responsibilities", "Responsibilities *"],
  ["requirements", "Requirements *"],
  ["we_offer", "We offer"],
  ["life_at_company", "Life at company"],
  ["hiring_process", "How we hire"],
] as const

const createEmptyForm = (): JobWrite => ({
  title: "",
  about_job: "",
  responsibilities: "",
  requirements: "",
  we_offer: "",
  life_at_company: "",
  hiring_process: "",
  location: "",
  employment_type: "",
  deadline: "",
  openings_count: 1,
  skill_weight: 45,
  experience_weight: 30,
  education_weight: 15,
  soft_skill_weight: 10,
})

const requiredJobFields: Array<[keyof JobWrite, string]> = [
  ["title", "Title"],
  ["about_job", "About the job"],
  ["responsibilities", "Responsibilities"],
  ["requirements", "Requirements"],
]

interface RoleTemplate {
  name: string
  icon: string
  title: string
  location: string
  employment_type: string
  about_job: string
  responsibilities: string
  requirements: string
  we_offer: string
  life_at_company: string
  hiring_process: string
  skill_weight: number
  experience_weight: number
  education_weight: number
  soft_skill_weight: number
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: "Senior Frontend Engineer",
    icon: "💻",
    title: "Senior Frontend Engineer (React / TypeScript)",
    location: "Ho Chi Minh City / Hybrid",
    employment_type: "Full-time",
    about_job: "We are seeking an experienced Senior Frontend Engineer to architect, build, and optimize next-generation web interfaces with high performance and accessibility.",
    responsibilities: "• Architect responsive, scalable web applications using React, TypeScript, and modern CSS/Tailwind.\n• Collaborate with UX/UI designers and product managers to craft seamless user experiences.\n• Optimize web performance, Core Web Vitals, and client-side caching strategies.\n• Mentor junior developers and drive engineering best practices.",
    requirements: "• 4+ years of professional experience with React, TypeScript, and modern frontend tools (Vite/Webpack).\n• Deep understanding of state management, browser rendering performance, and DOM optimization.\n• Solid experience with automated testing (Jest, Vitest, Playwright/Cypress).\n• Strong communication skills and collaborative team mindset.",
    we_offer: "• Competitive salary package + 13th month bonus & equity options.\n• Flexible hybrid working model and high-end workstation gear.\n• Premium health insurance for employee & family.\n• Annual training budget & clear promotion paths.",
    life_at_company: "A fast-paced, product-driven culture where innovation is rewarded and work-life balance is prioritized.",
    hiring_process: "1. Initial screening chat (30 mins)\n2. Technical & architecture interview (60 mins)\n3. Culture fit with founders/engineering leads (45 mins)\n4. Offer & onboarding",
    skill_weight: 45,
    experience_weight: 30,
    education_weight: 15,
    soft_skill_weight: 10,
  },
  {
    name: "Backend Engineer",
    icon: "⚙️",
    title: "Senior Backend Engineer (Node.js / Python)",
    location: "Ho Chi Minh City / Remote",
    employment_type: "Full-time",
    about_job: "Join our core engineering team to build scalable microservices, resilient APIs, and data pipelines processing thousands of transactions daily.",
    responsibilities: "• Design and maintain robust RESTful & GraphQL APIs using Node.js/Python.\n• Optimize SQL queries, database indexing (PostgreSQL/MySQL), and Redis caching.\n• Implement CI/CD automation and containerized deployments via Docker & Kubernetes.\n• Ensure system reliability, security compliance, and sub-100ms response times.",
    requirements: "• 3+ years experience designing backend services in Python (FastAPI/Django) or Node.js/TypeScript.\n• Strong database proficiency with relational (PostgreSQL/MySQL) and NoSQL stores.\n• Experience with message queues (Kafka/RabbitMQ) and distributed caching.\n• Familiarity with cloud services (AWS/GCP) and CI/CD pipelines.",
    we_offer: "• Top-tier compensation package.\n• Fully remote work option.\n• Comprehensive health and dental coverage.\n• Yearly wellness and home-office stipends.",
    life_at_company: "Transparent engineering culture focused on code quality, automated testing, and continuous learning.",
    hiring_process: "1. Phone screening (30 mins)\n2. System design & coding session (75 mins)\n3. Team fit discussion (45 mins)\n4. Offer letter",
    skill_weight: 45,
    experience_weight: 35,
    education_weight: 10,
    soft_skill_weight: 10,
  },
  {
    name: "AI / ML Engineer",
    icon: "🧠",
    title: "AI / Machine Learning Engineer (LLMs & NLP)",
    location: "Ho Chi Minh City / Hybrid",
    employment_type: "Full-time",
    about_job: "Looking for an innovative AI/ML Engineer to build intelligent pipelines, RAG systems, and LLM-powered features for our Talent Intelligence platform.",
    responsibilities: "• Develop and fine-tune NLP/LLM models, prompt pipelines, and embeddings for text extraction.\n• Implement efficient Retrieval-Augmented Generation (RAG) architectures with Vector DBs.\n• Deploy, monitor, and optimize inference latency of generative AI microservices.\n• Conduct experimentations and benchmark AI performance against rubric metrics.",
    requirements: "• Strong Python background and experience with PyTorch, LangChain/LlamaIndex, and HuggingFace.\n• Hands-on experience with OpenAI/Gemini/Claude APIs and vector search (Qdrant/Pinecone/Milvus).\n• Solid understanding of OCR, NER, text parsing, and classification algorithms.\n• BS/MS in Computer Science, Data Science, or related quantitative field.",
    we_offer: "• Highly competitive compensation + AI compute credits & resources.\n• Direct impact on core AI products used by thousands.\n• Sponsorship for attending top AI/ML research conferences.\n• Full health insurance and flexible hours.",
    life_at_company: "Pioneering AI-first team with open research sharing and fast execution velocity.",
    hiring_process: "1. Intro call (30 mins)\n2. ML & architecture deep-dive (60 mins)\n3. Product alignment discussion (45 mins)\n4. Offer",
    skill_weight: 50,
    experience_weight: 30,
    education_weight: 10,
    soft_skill_weight: 10,
  },
  {
    name: "Product Designer (UI/UX)",
    icon: "🎨",
    title: "Senior Product Designer (UI/UX & Design Systems)",
    location: "Ho Chi Minh City",
    employment_type: "Full-time",
    about_job: "We are seeking a talented Product Designer with strong visual craft and user empathy to create intuitive, delightful digital experiences.",
    responsibilities: "• Own end-to-end design workflows: user research, wireframing, high-fidelity UI, and interactive prototypes.\n• Maintain and expand our multi-brand design system in Figma.\n• Work closely with frontend engineers to ensure pixel-perfect implementation.\n• Conduct user testing and synthesize qualitative feedback into actionable design iterations.",
    requirements: "• 3+ years in UX/UI and product design for SaaS or consumer apps.\n• Expert mastery of Figma, auto-layout, design tokens, and prototyping.\n• Proven portfolio demonstrating aesthetic excellence, typography hierarchy, and UX rigor.\n• Understanding of modern web capabilities (CSS/Tailwind, mobile responsiveness).",
    we_offer: "• Competitive salary & creative bonus.\n• Latest MacBook Pro & 4K monitor setup.\n• Creative workshop and conference allowances.\n• Generous annual leave & wellness benefits.",
    life_at_company: "Design-centric environment where every pixel matters and creative ideas are celebrated.",
    hiring_process: "1. Portfolio review & intro (45 mins)\n2. Design challenge walkthrough (60 mins)\n3. Team culture chat (30 mins)\n4. Offer",
    skill_weight: 45,
    experience_weight: 30,
    education_weight: 10,
    soft_skill_weight: 15,
  },
]

const hasTimezone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
const padDatePart = (value: number) => String(value).padStart(2, "0")

const parseApiDate = (value: string) =>
  new Date(hasTimezone(value) ? value : `${value}Z`)

const toLocalDateTimeInput = (value: string | null) => {
  if (!value) return ""
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

const toUtcIso = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const formatDate = (value: string | null) => {
  if (!value) return "Not set"
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return "Invalid date"
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

const statusBadge = (status: JobStatus) => {
  if (status === "Published") return "fc-badge--green"
  if (status === "Closed") return "fc-badge--gray"
  return "fc-badge--amber"
}

const actionLabels: Record<JobAction, string> = {
  publish: "Publishing...",
  close: "Closing...",
  reopen: "Reopening...",
  duplicate: "Duplicating...",
  archive: "Archiving...",
  unarchive: "Restoring...",
}

export default function JobPostsScreen() {
  const cachedManagedJobs =
    getCachedResource<ManagedJobs>(JOB_POSTS_CACHE_KEY)
  const [managedJobs, setManagedJobs] = useState<ManagedJobs>(
    cachedManagedJobs ?? {
      active: [],
      archived: [],
    },
  )
  const [listView, setListView] = useState<JobListView>("active")
  const [form, setForm] = useState<JobWrite>(createEmptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [loading, setLoading] = useState(() => !cachedManagedJobs)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [rawJobDescription, setRawJobDescription] = useState("")
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([])
  const [pendingAction, setPendingAction] = useState<{
    jobId: number
    action: JobAction
  } | null>(null)
  const [loadError, setLoadError] = useState("")
  const [formError, setFormError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState("")
  const [success, setSuccess] = useState("")
  const [previewJob, setPreviewJob] = useState<JobPost | null>(null)
  const [previewingId, setPreviewingId] = useState<number | null>(null)

  const commitManagedJobs = useCallback(
    (updater: (current: ManagedJobs) => ManagedJobs) => {
      setManagedJobs((current) => {
        const next = updater(current)

        setCachedResource(JOB_POSTS_CACHE_KEY, next)

        return next
      })
    },
    [],
  )

  const load = useCallback(async (force = false) => {
    const cached = getCachedResource<ManagedJobs>(JOB_POSTS_CACHE_KEY)

    if (cached && !force) {
      setManagedJobs(cached)
      setLoading(false)

      return
    }

    setLoading(!cached)
    setLoadError("")
    try {
      setManagedJobs(
        await getOrFetchResource(
          JOB_POSTS_CACHE_KEY,
          async () => {
            const [active, archived] = await Promise.all([
              jobsApi.listManaged(false),
              jobsApi.listManaged(true),
            ])

            return { active, archived }
          },
          { force },
        ),
      )
    } catch (cause) {
      setLoadError(errorMessage(cause, "Could not load company jobs."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const weightTotal = useMemo(
    () =>
      weightFields.reduce((total, [key]) => total + Number(form[key] ?? 0), 0),
    [form],
  )
  const weightsValid =
    weightFields.every(([key]) => {
      const value = Number(form[key])
      return Number.isFinite(value) && value >= 0 && value <= 100
    }) && Math.abs(weightTotal - 100) < 0.001

  const activeApplications = managedJobs.active.reduce(
    (total, job) => total + job.application_count,
    0,
  )
  const publishedCount = managedJobs.active.filter(
    (job) => job.status === "Published",
  ).length
  const visibleJobs = managedJobs[listView]

  const setField = (key: keyof JobWrite, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }

  const scrollToEditor = () => {
    window.requestAnimationFrame(() => {
      document
        .getElementById("job-editor")
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" })
    })
  }

  const startCreate = () => {
    setForm(createEmptyForm())
    setEditingId(null)
    setFormError("")
    setActionError("")
    setSuccess("")
    setRawJobDescription("")
    setExtractionWarnings([])
    setEditorOpen(true)
    scrollToEditor()
  }

  const startEdit = (job: JobPost) => {
    setEditingId(job.job_id)
    setForm({
      title: job.title,
      about_job: job.about_job ?? "",
      responsibilities: job.responsibilities ?? "",
      requirements: job.requirements ?? "",
      we_offer: job.we_offer ?? "",
      life_at_company: job.life_at_company ?? "",
      hiring_process: job.hiring_process ?? "",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "",
      deadline: toLocalDateTimeInput(job.deadline),
      openings_count: job.openings_count,
      skill_weight: job.skill_weight,
      experience_weight: job.experience_weight,
      education_weight: job.education_weight,
      soft_skill_weight: job.soft_skill_weight,
    })
    setFormError("")
    setActionError("")
    setSuccess("")
    setRawJobDescription("")
    setExtractionWarnings([])
    setEditorOpen(true)
    scrollToEditor()
  }

  const applyTemplate = (tpl: RoleTemplate) => {
    setForm((current) => ({
      ...current,
      title: tpl.title,
      location: tpl.location,
      employment_type: tpl.employment_type,
      about_job: tpl.about_job,
      responsibilities: tpl.responsibilities,
      requirements: tpl.requirements,
      we_offer: tpl.we_offer,
      life_at_company: tpl.life_at_company,
      hiring_process: tpl.hiring_process,
      skill_weight: tpl.skill_weight,
      experience_weight: tpl.experience_weight,
      education_weight: tpl.education_weight,
      soft_skill_weight: tpl.soft_skill_weight,
    }))
    setSuccess(`Applied starter template: “${tpl.name}”. Review and adjust as needed!`)
    setFormError("")
  }

  const applyWeightPreset = (preset: "standard" | "tech" | "experience") => {
    if (preset === "standard") {
      setForm((cur) => ({
        ...cur,
        skill_weight: 40,
        experience_weight: 30,
        education_weight: 20,
        soft_skill_weight: 10,
      }))
    } else if (preset === "tech") {
      setForm((cur) => ({
        ...cur,
        skill_weight: 50,
        experience_weight: 30,
        education_weight: 10,
        soft_skill_weight: 10,
      }))
    } else if (preset === "experience") {
      setForm((cur) => ({
        ...cur,
        skill_weight: 30,
        experience_weight: 45,
        education_weight: 15,
        soft_skill_weight: 10,
      }))
    }
  }

  const closeEditor = () => {
    setForm(createEmptyForm())
    setEditingId(null)
    setEditorOpen(false)
    setFormError("")
    setFieldErrors({})
    setRawJobDescription("")
    setExtractionWarnings([])
  }

  const extractJobDescription = async () => {
    const value = rawJobDescription.trim()
    if (value.length < 80) {
      setFormError(
        "Paste at least 80 characters so AI has enough job context to extract.",
      )
      return
    }

    setExtracting(true)
    setFormError("")
    setSuccess("")
    try {
      const result = await jobsApi.extract(value)
      setForm((current) => ({
        ...current,
        title: current.title.trim() ? current.title : (result.title || ""),
        about_job: current.about_job.trim() ? current.about_job : (result.about_job || ""),
        responsibilities: current.responsibilities.trim() ? current.responsibilities : (result.responsibilities || ""),
        requirements: current.requirements.trim() ? current.requirements : (result.requirements || ""),
        we_offer: current.we_offer.trim() ? current.we_offer : (result.we_offer || ""),
        life_at_company: current.life_at_company.trim() ? current.life_at_company : (result.life_at_company || ""),
        hiring_process: current.hiring_process.trim() ? current.hiring_process : (result.hiring_process || ""),
        location: current.location?.trim() ? current.location : (result.location || ""),
        employment_type: current.employment_type?.trim() ? current.employment_type : (result.employment_type || ""),
      }))
      setExtractionWarnings(result.warnings)
      setSuccess(
        "AI đã trích xuất thông tin. Các ô bạn đã nhập nội dung trước đó được giữ nguyên, chỉ các ô trống mới được điền tự động.",
      )
    } catch (cause) {
      setFormError(
        errorMessage(cause, "Could not extract this job description."),
      )
    } finally {
      setExtracting(false)
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()

    const errors: Record<string, string> = {}
    if (!form.title.trim()) errors.title = "Vui lòng nhập Chức danh tuyển dụng (Title)"
    if (!form.about_job.trim()) errors.about_job = "Vui lòng nhập Giới thiệu công việc (About the job)"
    if (!form.responsibilities.trim()) errors.responsibilities = "Vui lòng nhập Trách nhiệm công việc (Responsibilities)"
    if (!form.requirements.trim()) errors.requirements = "Vui lòng nhập Yêu cầu công việc (Requirements)"
    if (Number(form.openings_count) < 1) errors.openings_count = "Số lượng tuyển dụng phải từ 1 trở lên"
    if (!weightsValid) errors.weights = "Tổng 4 trọng số chấm điểm phải bằng đúng 100%"

    const deadline = toUtcIso(form.deadline)
    if (deadline === undefined) {
      errors.deadline = "Vui lòng nhập hạn chót nhận hồ sơ hợp lệ"
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError("Vui lòng kiểm tra và điền các trường còn thiếu (được đánh dấu đỏ bên dưới).")
      const firstKey = Object.keys(errors)[0]
      const targetId = firstKey === "weights" ? "job-scoring-title" : `job-field-${firstKey}`
      const fieldElem = document.getElementById(targetId)
      if (fieldElem) {
        fieldElem.scrollIntoView({ behavior: "smooth", block: "center" })
        if ("focus" in fieldElem && typeof fieldElem.focus === "function") {
          fieldElem.focus()
        }
      }
      return
    }

    setSaving(true)
    setFormError("")
    setFieldErrors({})
    setActionError("")
    setSuccess("")
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        deadline,
      }

      if (editingId) {
        const updated = await jobsApi.update(editingId, payload)
        commitManagedJobs((current) => ({
          ...current,
          active: current.active.map((job) =>
            job.job_id === updated.job_id ? updated : job,
          ),
        }))
        setSuccess(`Đã lưu thay đổi cho “${updated.title}”.`)
      } else {
        const created = await jobsApi.create(payload)
        commitManagedJobs((current) => ({
          ...current,
          active: [created, ...current.active],
        }))
        setListView("active")
        setSuccess(`Đã tạo bài tuyển dụng “${created.title}”.`)
      }
      closeEditor()
    } catch (cause) {
      const rawMsg = errorMessage(cause, "Could not save this job.")
      if (rawMsg.toLowerCase().includes("company")) {
        setFormError(
          "Tài khoản HR của bạn chưa được liên kết với Công ty nào. Vui lòng vào Cài đặt / Hồ sơ HR (Profile) để cập nhật Tên công ty trước khi tạo bài đăng tuyển dụng.",
        )
      } else {
        setFormError(rawMsg)
      }
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (job: JobPost, action: JobAction) => {
    setPendingAction({ jobId: job.job_id, action })
    setActionError("")
    setSuccess("")
    try {
      const updated = await jobsApi[action](job.job_id)

      if (action === "duplicate") {
        commitManagedJobs((current) => ({
          ...current,
          active: [updated, ...current.active],
        }))
        setListView("active")
        setSuccess(`Created draft copy “${updated.title}”. Applications were not copied.`)
      } else if (action === "archive") {
        commitManagedJobs((current) => ({
          active: current.active.filter(
            (item) => item.job_id !== updated.job_id,
          ),
          archived: [updated, ...current.archived],
        }))
        if (editingId === updated.job_id) closeEditor()
        setSuccess(`Archived “${updated.title}”.`)
      } else if (action === "unarchive") {
        commitManagedJobs((current) => ({
          active: [updated, ...current.active],
          archived: current.archived.filter(
            (item) => item.job_id !== updated.job_id,
          ),
        }))
        setSuccess(`Restored “${updated.title}” to active jobs.`)
      } else {
        commitManagedJobs((current) => ({
          ...current,
          active: current.active.map((item) =>
            item.job_id === updated.job_id ? updated : item,
          ),
        }))
        setSuccess(
          action === "publish"
            ? `Published “${updated.title}”.`
            : action === "reopen"
              ? `Reopened “${updated.title}”.`
              : `Closed “${updated.title}”.`,
        )
      }
    } catch (cause) {
      setActionError(errorMessage(cause, `Could not ${action} this job.`))
    } finally {
      setPendingAction(null)
    }
  }

  const preview = async (job: JobPost) => {
    if (previewingId !== null) return
    setPreviewingId(job.job_id)
    setActionError("")
    try {
      setPreviewJob(await jobsApi.preview(job.job_id))
    } catch (cause) {
      setActionError(errorMessage(cause, "Could not load this job preview."))
    } finally {
      setPreviewingId(null)
    }
  }

  const copyShareLink = async (job: JobPost) => {
    setActionError("")
    setSuccess("")
    const shareUrl = new URL(window.location.href)
    shareUrl.search = ""
    shareUrl.hash = ""
    shareUrl.searchParams.set("job", String(job.job_id))

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.")
      }
      await navigator.clipboard.writeText(shareUrl.toString())
      setSuccess(`Copied the public link for “${job.title}”.`)
    } catch (cause) {
      setActionError(errorMessage(cause, "Could not copy the public job link."))
    }
  }

  return (
    <div className="fc-stagger job-posts-page">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            Recruitment
          </div>
          <h1>Job Post Management</h1>
          <p>Create, publish, and maintain your company jobs.</p>
        </div>
        <button
          type="button"
          className="fc-btn fc-btn--primary"
          onClick={startCreate}
        >
          <Plus size={16} />
          New job
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
        aria-label="Job post summary"
      >
        {[
          {
            label: "Active records",
            value: managedJobs.active.length,
            icon: <Briefcase size={19} />,
            color: "var(--accent)",
            soft: "var(--accent-soft)",
          },
          {
            label: "Published",
            value: publishedCount,
            icon: <CheckCircle size={19} />,
            color: "var(--success)",
            soft: "var(--success-soft)",
          },
          {
            label: "Applications",
            value: activeApplications,
            icon: <Users size={19} />,
            color: "var(--warning)",
            soft: "var(--warning-soft)",
          },
        ].map((stat) => (
          <div className="fc-card fc-card--pad" key={stat.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                className="fc-stat__icon"
                style={{ color: stat.color, background: stat.soft }}
              >
                {stat.icon}
              </span>
              <div>
                <strong className="fc-stat__value">{stat.value}</strong>
                <span
                  style={{
                    display: "block",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                  }}
                >
                  {stat.label}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {success && (
        <div className="job-alert job-alert--success" role="status">
          <CheckCircle size={17} />
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="job-alert job-alert--error" role="alert">
          <WarningCircle size={17} />
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {previewJob && (
        <section
          className="fc-card fc-card--pad"
          aria-label="Job post preview"
          style={{ marginBottom: 28 }}
        >
          <div className="fc-section-title" style={{ marginBottom: 14 }}>
            <Eye size={18} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <h2>{previewJob.title}</h2>
              <p>
                Candidate-facing preview · {previewJob.location || "Location pending"}
                {previewJob.employment_type ? ` · ${previewJob.employment_type}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="fc-icon-btn"
              onClick={() => setPreviewJob(null)}
              aria-label="Close job preview"
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {sections.map(([key, label]) => {
              const value = previewJob[key]
              return value ? (
                <div key={key}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{value}</p>
                </div>
              ) : null
            })}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16 }}>
            {previewJob.application_count} existing applications stay attached to this job.
          </p>
        </section>
      )}

      {editorOpen && (
        <form
          id="job-editor"
          className="fc-card fc-card--pad"
          onSubmit={save}
          style={{ marginBottom: 28 }}
        >
          <div
            className="fc-section-title"
            style={{ marginBottom: 18, alignItems: "flex-start" }}
          >
            <Briefcase size={18} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <h2>{editingId ? "Edit job post" : "Create job draft"}</h2>
              <p>
                Fields marked * are required to create or publish. Other LinkedIn
                details are optional; review AI suggestions before publishing.
              </p>
            </div>
            <button
              type="button"
              className="fc-icon-btn"
              onClick={closeEditor}
              aria-label="Close job editor"
            >
              <X size={18} />
            </button>
          </div>

          {formError && (
            <div
              className="job-alert job-alert--error"
              role="alert"
              style={{ marginBottom: 16 }}
            >
              <WarningCircle size={17} />
              <span>{formError}</span>
            </div>
          )}

          {/* 1-Click Starter Role Templates */}
          <div className="hr-template-group">
            <div className="hr-template-group__head">
              <span>⚡ 1-Click Starter Role Templates</span>
              <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                Instant complete JD, weights &amp; requirements
              </small>
            </div>
            <div className="hr-template-chips">
              {ROLE_TEMPLATES.map((tpl) => (
                <button
                  type="button"
                  key={tpl.name}
                  className="hr-template-chip"
                  onClick={() => applyTemplate(tpl)}
                >
                  <span>{tpl.icon}</span>
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          <section
            className="fc-panel"
            style={{ padding: 16, marginBottom: 18 }}
            aria-labelledby="job-ai-extractor-title"
          >
            <div className="fc-section-title" style={{ marginBottom: 12 }}>
              <MagicWand size={17} color="var(--accent)" />
              <div>
                <h3 id="job-ai-extractor-title">
                  AI job description extractor
                </h3>
                <p>Paste a full JD; FitCV suggests editable fields only.</p>
              </div>
            </div>
            <label>
              <span className="fc-field-label">Full job description</span>
              <textarea
                className="fc-input"
                rows={6}
                value={rawJobDescription}
                onChange={(event) => setRawJobDescription(event.target.value)}
                placeholder="Paste the full job description here..."
              />
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="fc-btn fc-btn--secondary"
                disabled={extracting || saving}
                onClick={() => void extractJobDescription()}
              >
                <MagicWand size={15} />
                {extracting ? "Extracting..." : "Extract fields with AI"}
              </button>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                AI output requires recruiter review.
              </span>
            </div>

            {extractionWarnings.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  color: "var(--warning)",
                  fontSize: 13,
                }}
                role="status"
              >
                <strong>Review notes</strong>
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {extractionWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section style={{ marginBottom: 18 }}>
            <div className="fc-eyebrow" style={{ marginBottom: 12 }}>
              Job basics
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(100%,210px),1fr))",
                gap: 14,
              }}
            >
              <label style={{ gridColumn: "span 2" }}>
                <span className="fc-field-label">Title *</span>
                <input
                  id="job-field-title"
                  className="fc-input"
                  style={
                    fieldErrors.title
                      ? {
                          borderColor: "var(--danger)",
                          boxShadow: "0 0 0 2px var(--danger-soft)",
                        }
                      : undefined
                  }
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  required
                />
                {fieldErrors.title && (
                  <span
                    style={{
                      color: "var(--danger)",
                      fontSize: 12,
                      marginTop: 4,
                      display: "block",
                    }}
                  >
                    {fieldErrors.title}
                  </span>
                )}
              </label>
              <label>
                <span className="fc-field-label">Location</span>
                <input
                  id="job-field-location"
                  className="fc-input"
                  value={form.location ?? ""}
                  onChange={(event) => setField("location", event.target.value)}
                  placeholder="Ho Chi Minh City"
                />
              </label>
              <label>
                <span className="fc-field-label">Employment type</span>
                <input
                  id="job-field-employment_type"
                  className="fc-input"
                  value={form.employment_type ?? ""}
                  onChange={(event) =>
                    setField("employment_type", event.target.value)
                  }
                  placeholder="Full-time"
                  list="employment-types"
                />
                <datalist id="employment-types">
                  <option value="Full-time" />
                  <option value="Part-time" />
                  <option value="Contract" />
                  <option value="Internship" />
                </datalist>
              </label>
              <label>
                <span className="fc-field-label">Deadline</span>
                <input
                  id="job-field-deadline"
                  className="fc-input"
                  style={
                    fieldErrors.deadline
                      ? {
                          borderColor: "var(--danger)",
                          boxShadow: "0 0 0 2px var(--danger-soft)",
                        }
                      : undefined
                  }
                  type="datetime-local"
                  value={form.deadline ?? ""}
                  onChange={(event) => setField("deadline", event.target.value)}
                />
                {fieldErrors.deadline && (
                  <span
                    style={{
                      color: "var(--danger)",
                      fontSize: 12,
                      marginTop: 4,
                      display: "block",
                    }}
                  >
                    {fieldErrors.deadline}
                  </span>
                )}
              </label>
              <label>
                <span className="fc-field-label">Openings</span>
                <input
                  id="job-field-openings_count"
                  className="fc-input"
                  style={
                    fieldErrors.openings_count
                      ? {
                          borderColor: "var(--danger)",
                          boxShadow: "0 0 0 2px var(--danger-soft)",
                        }
                      : undefined
                  }
                  type="number"
                  min={1}
                  value={form.openings_count ?? 1}
                  onChange={(event) =>
                    setField("openings_count", Number(event.target.value))
                  }
                />
                {fieldErrors.openings_count && (
                  <span
                    style={{
                      color: "var(--danger)",
                      fontSize: 12,
                      marginTop: 4,
                      display: "block",
                    }}
                  >
                    {fieldErrors.openings_count}
                  </span>
                )}
              </label>
            </div>
          </section>

          <section style={{ marginBottom: 18 }}>
            <div className="fc-eyebrow" style={{ marginBottom: 12 }}>
              Job description
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(100%,300px),1fr))",
                gap: 14,
              }}
            >
              {sections.map(([key, label]) => {
                const hasError = Boolean(fieldErrors[key])
                return (
                  <label key={key}>
                    <span className="fc-field-label">{label}</span>
                    <textarea
                      id={`job-field-${key}`}
                      className="fc-input"
                      style={{
                        minHeight: 120,
                        ...(hasError
                          ? {
                              borderColor: "var(--danger)",
                              boxShadow: "0 0 0 2px var(--danger-soft)",
                            }
                          : {}),
                      }}
                      value={form[key] ?? ""}
                      onChange={(event) => setField(key, event.target.value)}
                      required={label.endsWith("*")}
                    />
                    {hasError && (
                      <span
                        style={{
                          color: "var(--danger)",
                          fontSize: 12,
                          marginTop: 4,
                          display: "block",
                        }}
                      >
                        {fieldErrors[key]}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </section>

          <section
            className="fc-panel"
            style={{ padding: 16, marginBottom: 18 }}
            aria-labelledby="job-scoring-title"
          >
            <div
              className="fc-section-title"
              style={{ marginBottom: 12, alignItems: "flex-start" }}
            >
              <SlidersHorizontal size={17} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <h3 id="job-scoring-title">Candidate scoring weights</h3>
                <p>These four values must total exactly 100%.</p>
              </div>
              <strong
                className={`fc-badge ${
                  weightsValid ? "fc-badge--green" : "fc-badge--red"
                }`}
                aria-live="polite"
              >
                Total {weightTotal}%
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                gap: 12,
              }}
            >
              {weightFields.map(([key, label, description]) => (
                <label key={key}>
                  <span className="fc-field-label">{label}</span>
                  <div style={{ position: "relative" }}>
                    <input
                      className="fc-input"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form[key] ?? 0}
                      aria-label={`${label} weight`}
                      aria-invalid={!weightsValid}
                      onChange={(event) =>
                        setField(key, Number(event.target.value))
                      }
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                      }}
                    >
                      %
                    </span>
                  </div>
                  <small style={{ color: "var(--text-muted)" }}>
                    {description}
                  </small>
                </label>
              ))}
            </div>

            <div className="hr-weight-presets">
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                1-Click Presets:
              </span>
              <button
                type="button"
                className="hr-weight-preset-btn"
                onClick={() => applyWeightPreset("standard")}
              >
                ⚖️ Standard (40/30/20/10)
              </button>
              <button
                type="button"
                className="hr-weight-preset-btn"
                onClick={() => applyWeightPreset("tech")}
              >
                ⚡ Technical (50/30/10/10)
              </button>
              <button
                type="button"
                className="hr-weight-preset-btn"
                onClick={() => applyWeightPreset("experience")}
              >
                💼 Experience (30/45/15/10)
              </button>
            </div>

            {fieldErrors.weights && (
              <span
                style={{
                  color: "var(--danger)",
                  fontSize: 12,
                  marginTop: 8,
                  display: "block",
                  fontWeight: 600,
                }}
              >
                {fieldErrors.weights}
              </span>
            )}
          </section>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="fc-btn fc-btn--primary"
              disabled={saving}
              type="submit"
            >
              <FloppyDisk size={15} />
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Create job post"}
            </button>
            <button
              className="fc-btn fc-btn--secondary"
              type="button"
              onClick={closeEditor}
              disabled={saving}
            >
              <ArrowCounterClockwise size={15} />
              Cancel
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="company-jobs-title">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div className="fc-section-title">
            <Briefcase size={17} color="var(--accent)" />
            <div>
              <h2 id="company-jobs-title">Company jobs</h2>
              <p>Manage active and archived recruitment records.</p>
            </div>
          </div>
          <button
            type="button"
            className="fc-btn fc-btn--secondary"
            onClick={() => void load(true)}
            disabled={loading}
          >
            <ArrowClockwise size={15} />
            Refresh
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Job record filters"
          style={{
            display: "inline-flex",
            gap: 6,
            padding: 5,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            marginBottom: 14,
          }}
        >
          {(["active", "archived"] as const).map((view) => (
            <button
              type="button"
              key={view}
              role="tab"
              aria-selected={listView === view}
              className={
                listView === view
                  ? "fc-btn fc-btn--primary"
                  : "fc-btn fc-btn--ghost"
              }
              onClick={() => setListView(view)}
            >
              {view === "active" ? "Active" : "Archived"}
              <span className="fc-badge fc-badge--gray">
                {managedJobs[view].length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: 12 }} aria-live="polite">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="fc-card fc-card--pad"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 18,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 440px", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div className="fc-skeleton" style={{ width: 220, height: 20, borderRadius: 6, marginBottom: 6 }} />
                      <div style={{ display: "flex", gap: 12 }}>
                        <div className="fc-skeleton" style={{ width: 100, height: 13, borderRadius: 4 }} />
                        <div className="fc-skeleton" style={{ width: 130, height: 13, borderRadius: 4 }} />
                      </div>
                    </div>
                    <div className="fc-skeleton" style={{ width: 70, height: 24, borderRadius: 999 }} />
                  </div>
                  <div className="fc-skeleton" style={{ width: "85%", height: 14, borderRadius: 4, marginTop: 12 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <div className="fc-skeleton" style={{ width: 60, height: 22, borderRadius: 999 }} />
                    <div className="fc-skeleton" style={{ width: 80, height: 22, borderRadius: 999 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <div className="fc-skeleton" style={{ width: 36, height: 36, borderRadius: 9 }} />
                  <div className="fc-skeleton" style={{ width: 36, height: 36, borderRadius: 9 }} />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div
            className="fc-card fc-card--pad"
            role="alert"
            style={{ textAlign: "center" }}
          >
            <WarningCircle size={28} color="var(--danger)" />
            <strong style={{ display: "block", margin: "8px 0" }}>
              Jobs could not be loaded
            </strong>
            <p>{loadError}</p>
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              onClick={() => void load(true)}
              style={{ marginTop: 12 }}
            >
              <ArrowClockwise size={15} />
              Retry
            </button>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="fc-card fc-card--pad" style={{ textAlign: "center" }}>
            {listView === "active" ? (
              <>
                <Briefcase size={30} />
                <strong style={{ display: "block", margin: "8px 0" }}>
                  No active job records yet
                </strong>
                <p>Create a draft, complete its details, then publish it.</p>
                <button
                  type="button"
                  className="fc-btn fc-btn--primary"
                  onClick={startCreate}
                  style={{ marginTop: 12 }}
                >
                  <Plus size={15} />
                  Create first job
                </button>
              </>
            ) : (
              <>
                <Archive size={30} />
                <strong style={{ display: "block", margin: "8px 0" }}>
                  No archived jobs
                </strong>
                <p>Archived jobs remain available here for restoration.</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {visibleJobs.map((job) => {
              const busyAction =
                pendingAction?.jobId === job.job_id
                  ? pendingAction.action
                  : null

              return (
                <article
                  className="fc-card fc-card--pad fc-card--lift"
                  key={job.job_id}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 18,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 440px", minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <h3>{job.title}</h3>
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              flexWrap: "wrap",
                              color: "var(--text-muted)",
                              fontSize: 12,
                              marginTop: 5,
                            }}
                          >
                            <span>
                              <MapPin size={13} />{" "}
                              {job.location || "Location pending"}
                            </span>
                            <span>
                              <CalendarBlank size={13} /> Deadline{" "}
                              {formatDate(job.deadline)}
                            </span>
                          </div>
                        </div>
                        <span className={`fc-badge ${statusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </div>

                      {job.about_job && (
                        <p
                          style={{
                            color: "var(--text-secondary)",
                            marginTop: 12,
                          }}
                        >
                          {job.about_job}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <span className="fc-badge fc-badge--gray">
                          {job.employment_type || "Type pending"}
                        </span>
                        <span className="fc-badge fc-badge--gray">
                          {job.openings_count} openings
                        </span>
                        <span className="fc-badge fc-badge--blue">
                          {job.application_count} applications
                        </span>
                        {job.archived_at && (
                          <span className="fc-badge fc-badge--gray">
                            Archived {formatDate(job.archived_at)}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(110px,1fr))",
                          gap: 8,
                          marginTop: 12,
                        }}
                        aria-label="Candidate scoring weights"
                      >
                        {weightFields.map(([key, label]) => (
                          <span
                            className="fc-panel"
                            style={{
                              padding: "8px 10px",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                            }}
                            key={key}
                          >
                            {label} <strong>{job[key]}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      {listView === "archived" ? (
                        <>
                          <button
                            type="button"
                            className="fc-btn fc-btn--secondary"
                            disabled={Boolean(busyAction) || previewingId !== null}
                            onClick={() => void preview(job)}
                          >
                            <Eye size={14} />
                            {previewingId === job.job_id ? "Loading..." : "Preview"}
                          </button>
                          <button
                            type="button"
                            className="fc-btn fc-btn--secondary"
                            disabled={Boolean(busyAction)}
                            onClick={() => void runAction(job, "duplicate")}
                          >
                            <CopySimple size={14} />
                            {busyAction === "duplicate" ? actionLabels.duplicate : "Duplicate"}
                          </button>
                          <button
                            type="button"
                            className="fc-btn fc-btn--secondary"
                            disabled={Boolean(busyAction)}
                            onClick={() => void runAction(job, "unarchive")}
                          >
                            <ArrowCounterClockwise size={14} />
                            {busyAction === "unarchive"
                              ? actionLabels.unarchive
                              : "Restore"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="fc-btn fc-btn--secondary"
                            disabled={Boolean(busyAction) || previewingId !== null}
                            onClick={() => void preview(job)}
                          >
                            <Eye size={14} />
                            {previewingId === job.job_id ? "Loading..." : "Preview"}
                          </button>

                          <button
                            type="button"
                            className="fc-btn fc-btn--secondary"
                            disabled={Boolean(busyAction)}
                            onClick={() => void runAction(job, "duplicate")}
                          >
                            <CopySimple size={14} />
                            {busyAction === "duplicate" ? actionLabels.duplicate : "Duplicate"}
                          </button>

                          {job.status !== "Published" && (
                            <button
                              type="button"
                              className="fc-btn fc-btn--secondary"
                              disabled={Boolean(busyAction)}
                              onClick={() => startEdit(job)}
                            >
                              <PencilSimple size={14} />
                              Edit
                            </button>
                          )}

                          {job.status === "Draft" && (
                            <button
                              type="button"
                              className="fc-btn fc-btn--primary"
                              disabled={Boolean(busyAction)}
                              onClick={() => void runAction(job, "publish")}
                            >
                              <Plus size={14} />
                              {busyAction === "publish"
                                ? actionLabels.publish
                                : "Publish"}
                            </button>
                          )}

                          {job.status === "Closed" && (
                            <button
                              type="button"
                              className="fc-btn fc-btn--primary"
                              disabled={Boolean(busyAction)}
                              onClick={() => void runAction(job, "reopen")}
                            >
                              <ArrowCounterClockwise size={14} />
                              {busyAction === "reopen" ? actionLabels.reopen : "Reopen"}
                            </button>
                          )}

                          {job.status === "Published" && (
                            <>
                              <button
                                type="button"
                                className="fc-btn fc-btn--secondary"
                                disabled={Boolean(busyAction)}
                                onClick={() => void copyShareLink(job)}
                              >
                                <Link size={14} />
                                Copy public link
                              </button>
                              <button
                                type="button"
                                className="fc-btn fc-btn--secondary"
                                disabled={Boolean(busyAction)}
                                onClick={() => void runAction(job, "close")}
                              >
                                <XCircle size={14} />
                                {busyAction === "close"
                                  ? actionLabels.close
                                  : "Close"}
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="fc-btn fc-btn--ghost"
                            disabled={Boolean(busyAction)}
                            onClick={() => void runAction(job, "archive")}
                          >
                            <Archive size={14} />
                            {busyAction === "archive"
                              ? actionLabels.archive
                              : "Archive"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
