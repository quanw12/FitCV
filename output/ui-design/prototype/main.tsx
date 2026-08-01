import { useState } from "react"
import { createRoot } from "react-dom/client"
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserRound,
  WandSparkles,
  Zap,
} from "lucide-react"

import "../../../src/index.css"
import "./prototype.css"

import Layout from "../../../src/ui/components/Layout"
import SeekerDashboard from "../../../src/ui/screens/SeekerDashboard"
import AnalyzerScreen from "../../../src/ui/screens/AnalyzerScreen"
import type {
  AnalyzerDraftState,
  MatchAnalysis,
} from "../../../src/types/analyzer"

const mockFile = new File(["FitCV design preview"], "Minh_Nguyen_Backend_CV.pdf", {
  type: "application/pdf",
})

const mockResult: MatchAnalysis = {
  matchResultId: "preview-uc02",
  status: "Success",
  cvId: 42,
  jobDescriptionId: 18,
  title: "Backend Developer - Fintech Platform",
  overallScore: 78,
  matchLabel: "Moderate Match",
  passProbability: 68,
  breakdown: {
    skills: {
      score: 82,
      matched: ["Python", "FastAPI", "SQL", "REST APIs", "Git"],
      missing: ["Docker", "Redis", "AWS"],
      detail: "Five required technical skills are grounded in the CV.",
    },
    experience: {
      score: 74,
      matched: ["Backend internship", "API development"],
      missing: ["2+ years production experience"],
      detail: "Relevant work is present, but the requested duration is not met.",
    },
    education: {
      score: 88,
      matched: ["BSc Information Technology"],
      missing: [],
      detail: "The education requirement is satisfied.",
    },
    soft_skills: {
      score: 65,
      matched: ["Team collaboration", "Problem solving"],
      missing: ["Stakeholder communication"],
      detail: "Two soft skills are supported by project evidence.",
    },
  },
  strengths: [
    "Strong Python and FastAPI evidence",
    "Relevant database and REST API projects",
  ],
  weaknesses: [
    "No explicit Docker or Redis evidence",
    "Production experience is below the requested level",
  ],
  suggestions: [
    "Add measurable outcomes to the backend internship bullets.",
    "Mention containerization experience if it can be supported.",
    "Surface database optimization work in the skills summary.",
  ],
  algorithmVersion: "fitcv-source-grounded-v2",
  errorMessage: null,
  generatedAt: "2026-07-25T07:00:00Z",
  completedAt: "2026-07-25T07:00:08Z",
  disclaimer:
    "This heuristic supports review and does not predict or automate a hiring decision.",
}

function CurrentDashboard() {
  return (
    <Layout
      portal="seeker"
      currentScreen="seeker-dashboard"
      onNavigate={() => undefined}
      onLogout={() => undefined}
      userName="Nguyen Minh"
    >
      <SeekerDashboard onNavigate={() => undefined} />
    </Layout>
  )
}

function CurrentAnalyzer({ result = false }: { result?: boolean }) {
  const [draft, setDraft] = useState<AnalyzerDraftState>({
    cvFile: result ? mockFile : null,
    uploadedCvId: result ? 42 : null,
    jdText: result
      ? "We are seeking a Backend Developer with Python, FastAPI, SQL, REST API, Docker, Redis and cloud experience. The successful candidate collaborates across teams and communicates clearly with stakeholders."
      : "",
    result: result ? mockResult : null,
  })

  return (
    <Layout
      portal="seeker"
      currentScreen="analyzer"
      onNavigate={() => undefined}
      onLogout={() => undefined}
      userName="Nguyen Minh"
    >
      <div className={result ? "current-result-capture" : undefined}>
        <AnalyzerScreen
          draft={draft}
          setDraft={setDraft}
          onAnalysisComplete={() => undefined}
          onAnalysisInvalidated={() => undefined}
          onViewSuggestions={() => undefined}
        />
      </div>
    </Layout>
  )
}

const altNav = [
  { icon: <LayoutDashboard size={19} />, label: "Overview", active: true },
  { icon: <Target size={19} />, label: "Analyze match" },
  { icon: <Lightbulb size={19} />, label: "Improve CV" },
  { icon: <BookOpen size={19} />, label: "My library" },
]

function AltShell({
  active = "Overview",
  children,
}: {
  active?: string
  children: React.ReactNode
}) {
  return (
    <div className="alt-app">
      <aside className="alt-rail">
        <div className="alt-logo">
          <Zap size={22} fill="white" />
        </div>
        <div className="alt-wordmark">FitCV</div>
        <nav>
          {altNav.map((item) => (
            <button
              key={item.label}
              className={item.label === active ? "active" : ""}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="alt-user">
          <span>NM</span>
          <div>
            <strong>Nguyen Minh</strong>
            <small>Job seeker</small>
          </div>
        </div>
      </aside>
      <div className="alt-workspace">
        <header className="alt-topbar">
          <div className="alt-search">
            <Search size={16} />
            <span>Search your CVs and analyses</span>
          </div>
          <button className="alt-icon">
            <Bell size={19} />
          </button>
          <button className="alt-profile">
            <span>NM</span>
            <ChevronDown size={14} />
          </button>
        </header>
        <main className="alt-main">{children}</main>
      </div>
    </div>
  )
}

function AlternativeDashboard() {
  const recent = [
    ["Backend Developer", "VNG Corporation", "78", "+6 pts", "Today"],
    ["Software Engineer", "Shopee Vietnam", "71", "+3 pts", "22 Jul"],
    ["Python Developer", "FPT Software", "66", "Baseline", "18 Jul"],
  ]

  return (
    <AltShell>
      <div className="alt-heading">
        <div>
          <span className="alt-kicker">YOUR JOB READINESS</span>
          <h1>Good afternoon, Minh.</h1>
          <p>Start with a role. FitCV will show where your CV already fits.</p>
        </div>
        <div className="alt-streak">
          <Sparkles size={18} />
          <span>
            <strong>3-week</strong> improvement streak
          </span>
        </div>
      </div>

      <section className="command-hero">
        <div className="command-copy">
          <span className="command-label">
            <WandSparkles size={15} /> NEW MATCH ANALYSIS
          </span>
          <h2>Which opportunity are you preparing for?</h2>
          <p>
            Choose a CV and add a job description. You will receive an
            evidence-based score in one guided flow.
          </p>
          <div className="command-fields">
            <button>
              <FileCheck2 size={18} />
              <span>
                <small>Selected CV</small>
                Minh_Backend_CV_v3.pdf
              </span>
              <ChevronDown size={16} />
            </button>
            <button>
              <Link2 size={18} />
              <span>
                <small>Target job</small>
                Paste a JD or choose saved job
              </span>
              <ChevronDown size={16} />
            </button>
          </div>
          <button className="command-cta">
            Start guided analysis <ArrowRight size={17} />
          </button>
        </div>
        <div className="readiness-orbit">
          <div className="orbit-score">
            <strong>73</strong>
            <span>Readiness</span>
          </div>
          <span className="orbit-tag tag-one">Skills 82</span>
          <span className="orbit-tag tag-two">Experience 71</span>
          <span className="orbit-tag tag-three">Education 86</span>
        </div>
      </section>

      <div className="alt-dashboard-grid">
        <section className="alt-card recent-card">
          <div className="alt-card-title">
            <div>
              <span className="alt-kicker">RECENT ANALYSES</span>
              <h3>Keep the momentum going</h3>
            </div>
            <button>View all</button>
          </div>
          <div className="recent-list">
            {recent.map(([role, company, score, delta, date]) => (
              <div className="recent-row" key={role}>
                <span className="company-mark">{company.slice(0, 1)}</span>
                <div>
                  <strong>{role}</strong>
                  <small>{company}</small>
                </div>
                <span className="score-pill">{score}%</span>
                <span className="delta">{delta}</span>
                <time>{date}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="alt-card next-card">
          <span className="alt-kicker">NEXT BEST ACTION</span>
          <div className="next-icon">
            <Target size={24} />
          </div>
          <h3>Add evidence for Docker</h3>
          <p>
            Docker appears in 4 of your last 5 target jobs but is not grounded
            in your current CV.
          </p>
          <div className="next-progress">
            <span style={{ width: "68%" }} />
          </div>
          <button>
            Review recommendation <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </AltShell>
  )
}

function StepStatus({
  number,
  label,
  state,
}: {
  number: string
  label: string
  state: "done" | "active" | "next"
}) {
  return (
    <div className={`step-status ${state}`}>
      <span>{state === "done" ? <Check size={15} /> : number}</span>
      <div>
        <small>STEP {number}</small>
        <strong>{label}</strong>
      </div>
    </div>
  )
}

function AlternativeAnalyzerInput() {
  return (
    <AltShell active="Analyze match">
      <div className="analysis-header">
        <div>
          <button className="back-link">← Back to overview</button>
          <h1>Build your match analysis</h1>
          <p>Review both sources before FitCV begins evidence extraction.</p>
        </div>
        <span className="draft-state">
          <CircleDot size={14} /> Draft saved
        </span>
      </div>

      <div className="stepper-bar">
        <StepStatus number="1" label="Choose CV" state="done" />
        <span />
        <StepStatus number="2" label="Add job description" state="active" />
        <span />
        <StepStatus number="3" label="Review and analyze" state="next" />
      </div>

      <div className="guided-grid">
        <section className="guided-main">
          <div className="source-card completed">
            <div className="source-number">
              <Check size={18} />
            </div>
            <div className="source-copy">
              <div className="source-title">
                <div>
                  <span className="alt-kicker">SOURCE 1</span>
                  <h2>Your CV</h2>
                </div>
                <button>Change</button>
              </div>
              <div className="selected-document">
                <span>
                  <FileText size={22} />
                </span>
                <div>
                  <strong>Minh_Backend_CV_v3.pdf</strong>
                  <small>PDF · 624 KB · Parsed successfully</small>
                </div>
                <span className="verified">
                  <ShieldCheck size={15} /> Ready
                </span>
              </div>
            </div>
          </div>

          <div className="source-card active">
            <div className="source-number">2</div>
            <div className="source-copy">
              <div className="source-title">
                <div>
                  <span className="alt-kicker">SOURCE 2</span>
                  <h2>Target job description</h2>
                </div>
                <span className="required">Required</span>
              </div>
              <div className="jd-tabs">
                <button className="active">Paste text</button>
                <button>Upload file</button>
                <button>Choose saved JD</button>
              </div>
              <div className="jd-editor">
                <div className="jd-editor-head">
                  <strong>Backend Developer - Fintech Platform</strong>
                  <span>1,284 characters</span>
                </div>
                <p>
                  We are seeking a Backend Developer with strong Python,
                  FastAPI, SQL and REST API experience. You will design reliable
                  services, work with Docker and Redis, and collaborate with
                  product and engineering teams...
                </p>
                <div className="jd-quality">
                  <CheckCircle2 size={16} />
                  Complete enough to analyze
                  <span>Title, responsibilities and requirements detected</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="review-panel">
          <span className="alt-kicker">ANALYSIS CHECK</span>
          <h2>Ready when you are</h2>
          <p>FitCV will compare only evidence found in these two sources.</p>
          <div className="check-row">
            <span>
              <FileCheck2 size={17} />
            </span>
            <div>
              <strong>CV parsed</strong>
              <small>5 evidence categories found</small>
            </div>
            <Check size={16} />
          </div>
          <div className="check-row">
            <span>
              <BriefcaseBusiness size={17} />
            </span>
            <div>
              <strong>JD complete</strong>
              <small>8 requirements detected</small>
            </div>
            <Check size={16} />
          </div>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <p>
              Contact information is redacted before semantic extraction.
            </p>
          </div>
          <button className="analyze-button">
            <Zap size={18} fill="white" />
            Analyze evidence
          </button>
          <small className="run-time">
            <Clock3 size={13} /> Usually completes in under one minute
          </small>
        </aside>
      </div>
    </AltShell>
  )
}

const requirementRows = [
  {
    label: "Python / FastAPI",
    status: "match",
    cv: "Built 3 REST services with FastAPI",
    jd: "Strong Python and FastAPI experience",
  },
  {
    label: "SQL",
    status: "match",
    cv: "Optimized MySQL queries by 34%",
    jd: "Production SQL experience",
  },
  {
    label: "Docker",
    status: "gap",
    cv: "No grounded evidence found",
    jd: "Containerize services with Docker",
  },
  {
    label: "Experience level",
    status: "partial",
    cv: "12-month backend internship",
    jd: "2+ years production experience",
  },
]

function AlternativeAnalyzerResult() {
  return (
    <AltShell active="Analyze match">
      <div className="result-title-row">
        <div>
          <button className="back-link">← All analyses</button>
          <span className="alt-kicker">COMPLETED 25 JUL 2026, 14:00</span>
          <h1>Backend Developer - Fintech Platform</h1>
          <p>Minh_Backend_CV_v3.pdf compared with a complete job description</p>
        </div>
        <div className="result-actions">
          <button>Export report</button>
          <button className="primary">Improve this CV</button>
        </div>
      </div>

      <section className="score-summary">
        <div className="score-number">
          <strong>78</strong>
          <span>/100</span>
        </div>
        <div className="score-meaning">
          <span>MODERATE MATCH</span>
          <h2>You meet the core requirements, with three clear gaps.</h2>
          <p>
            The score supports your review. It is not an automated hiring
            decision.
          </p>
        </div>
        <div className="score-categories">
          {[
            ["Skills", "82", "#2563eb"],
            ["Experience", "74", "#d97706"],
            ["Education", "88", "#16a34a"],
            ["Soft skills", "65", "#7c3aed"],
          ].map(([label, score, color]) => (
            <div key={label}>
              <span>{label}</span>
              <strong style={{ color }}>{score}%</strong>
              <i>
                <b style={{ width: `${score}%`, background: color }} />
              </i>
            </div>
          ))}
        </div>
      </section>

      <div className="evidence-workspace">
        <section className="evidence-table">
          <div className="evidence-head">
            <div>
              <span className="alt-kicker">SOURCE-GROUNDED COMPARISON</span>
              <h2>Requirement evidence</h2>
            </div>
            <div className="legend">
              <span className="match">Matched</span>
              <span className="partial">Partial</span>
              <span className="gap">Gap</span>
            </div>
          </div>
          <div className="evidence-columns">
            <strong>Requirement</strong>
            <strong>Your CV evidence</strong>
            <strong>Job description evidence</strong>
          </div>
          {requirementRows.map((row) => (
            <div className="evidence-row" key={row.label}>
              <div>
                <span className={`status-dot ${row.status}`} />
                <strong>{row.label}</strong>
              </div>
              <p className={row.status === "gap" ? "muted-evidence" : ""}>
                “{row.cv}”
              </p>
              <p>“{row.jd}”</p>
            </div>
          ))}
          <button className="show-evidence">Show all 8 requirements</button>
        </section>

        <aside className="decision-panel">
          <span className="alt-kicker">WHAT TO DO NEXT</span>
          <div className="priority-callout">
            <Target size={22} />
            <div>
              <strong>Highest-impact gap</strong>
              <h3>Docker evidence</h3>
              <p>Add it only if you can support it with a real project.</p>
            </div>
          </div>
          <div className="insight-block">
            <span>
              <CheckCircle2 size={17} /> 5 strengths
            </span>
            <p>Python, FastAPI, SQL, REST APIs, technical education</p>
          </div>
          <div className="insight-block warning">
            <span>
              <Gauge size={17} /> 3 gaps
            </span>
            <p>Docker, Redis, production experience duration</p>
          </div>
          <button className="improve-button">
            View prioritized suggestions <ArrowRight size={16} />
          </button>
          <button className="rerun-button">Change sources and re-analyze</button>
        </aside>
      </div>
    </AltShell>
  )
}

const page = new URLSearchParams(window.location.search).get("screen")

const screens: Record<string, React.ReactNode> = {
  "dashboard-a": <CurrentDashboard />,
  "analyzer-input-a": <CurrentAnalyzer />,
  "analyzer-result-a": <CurrentAnalyzer result />,
  "dashboard-b": <AlternativeDashboard />,
  "analyzer-input-b": <AlternativeAnalyzerInput />,
  "analyzer-result-b": <AlternativeAnalyzerResult />,
}

createRoot(document.getElementById("root")!).render(
  screens[page ?? "dashboard-a"] ?? screens["dashboard-a"],
)
