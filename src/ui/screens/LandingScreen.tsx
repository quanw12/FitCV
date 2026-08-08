import { useEffect, useRef, type PointerEvent, type ReactNode } from "react"
import {
  ArrowRight,
  Briefcase,
  ChartBar,
  FileText,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  User,
} from "@phosphor-icons/react"

import BranchTimeline, {
  type TimelineSpec,
} from "@/ui/components/landing/BranchTimeline"
import HeroStage from "@/ui/components/landing/HeroStage"
import HRDemo from "@/ui/components/landing/HRDemo"
import InteractiveDemo from "@/ui/components/landing/InteractiveDemo"
import ScoreChart, { type ScoreBar } from "@/ui/components/landing/ScoreChart"

import "./landing.css"

interface LandingScreenProps {
  onGetStarted: () => void
}

interface Feature {
  icon: ReactNode
  title: string
  copy: string
}

interface Step {
  title: string
  copy: string
}

interface Fact {
  value: string
  label: string
}

const SEEKER_FEATURES: Feature[] = [
  {
    icon: <FileText size={18} weight="duotone" />,
    title: "Rebuild from the CV you already have",
    copy: "Upload a PDF or DOCX and FitCV parses it into structured sections. Every rebuild is saved as its own version, so drafts stack up instead of overwriting each other.",
  },
  {
    icon: <MagnifyingGlass size={18} weight="duotone" />,
    title: "Score against a real job description",
    copy: "Paste the posting you are actually applying to. The analyzer returns a score for skills, experience, education and soft skills — each one backed by the keywords it matched and the ones it could not find.",
  },
  {
    icon: <Sparkle size={18} weight="duotone" />,
    title: "Suggestions tied to the gaps",
    copy: "Strengths, weaknesses and suggestions come out of the same analysis. You are not reading generic CV advice — you are reading what this CV is missing for this role.",
  },
  {
    icon: <Briefcase size={18} weight="duotone" />,
    title: "Track where each version went",
    copy: "An application keeps its job description and the CV version you sent, and moves through stages as you go. No side spreadsheet required.",
  },
]

const HR_FEATURES: Feature[] = [
  {
    icon: <ChartBar size={18} weight="duotone" />,
    title: "Rank a candidate pool",
    copy: "Score every submitted CV against one job description and read them in ranked order, with the same category breakdown candidates see.",
  },
  {
    icon: <User size={18} weight="duotone" />,
    title: "Move candidates through stages",
    copy: "Screening, interview and offer live on one board, so a candidate's status is a property of the pipeline rather than an inbox thread.",
  },
  {
    icon: <ShieldCheck size={18} weight="duotone" />,
    title: "Separate workspaces per role",
    copy: "Job seekers and recruiters sign in to different portals. Which one you land in is decided at sign-up and enforced on every request.",
  },
]

const STEPS: Step[] = [
  {
    title: "Upload your CV",
    copy: "PDF or DOCX. Parsing runs in the background and reports its status instead of leaving you guessing.",
  },
  {
    title: "Add a job description",
    copy: "Paste the posting you care about. It stays attached to the analysis and to any application you create from it.",
  },
  {
    title: "Read the breakdown",
    copy: "Four scored categories, the evidence behind each score, and an overall match label rather than one opaque number.",
  },
  {
    title: "Rebuild and apply",
    copy: "Accept the suggestions that matter, rebuild into a new version, then send that exact version and track it.",
  },
]

const FACTS: Fact[] = [
  { value: "PDF · DOCX", label: "Upload formats the parser accepts" },

  {
    value: "4",
    label:
      "Scored categories per analysis: skills, experience, education, soft skills",
  },
  { value: "Versioned", label: "Every rebuild is kept as its own CV version" },

  {
    value: "2 portals",
    label: "Separate workspaces for job seekers and recruiters",
  },
]

const SAMPLE_BARS: ScoreBar[] = [
  { label: "Skills", score: 82 },
  { label: "Experience", score: 68 },
  { label: "Education", score: 91 },
  { label: "Soft skills", score: 44 },
]

/* Both flows share one shape: three stages on the main line, then a fork where
   the attempt either earns its place on the line or is left off it. */

const SEEKER_FLOW: TimelineSpec = {
  badge: "LIVE",
  marker: "Current CV",
  branchBadge: "DRAFT",
  stages: ["CV uploaded", "Parsed", "Scored vs JD"],

  pass: {
    changed: "Changed · Skills",
    pill: "Rebuilt draft",
    first: "Score improved",
    second: "New version",
  },

  fail: {
    changed: "Changed · Summary",
    pill: "Reworded draft",
    first: "Score dropped",
    second: "Not saved",
  },
  outcome: "Version sent",
}

const HR_FLOW: TimelineSpec = {
  badge: "OPEN",
  marker: "Open role",
  branchBadge: "CANDIDATE",
  stages: ["Role posted", "CVs received", "Pool scored"],

  pass: {
    changed: "Ranked · Top match",
    pill: "Shortlisted",
    first: "Interviewed",
    second: "Offer sent",
  },

  fail: {
    changed: "Ranked · Low match",
    pill: "Left in pool",
    first: "Below the bar",
    second: "Not advanced",
  },
  outcome: "Role filled",
}

function handleCardPointerMove(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget
  const box = card.getBoundingClientRect()
  card.style.setProperty("--lp-mx", `${event.clientX - box.left}px`)
  card.style.setProperty("--lp-my", `${event.clientY - box.top}px`)
}

export default function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    let ticking = false

    const sync = () => {
      ticking = false
      header.classList.toggle("is-scrolled", window.scrollY > 8)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(sync)
    }

    sync()
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".lp-reveal"))

    if (typeof IntersectionObserver === "undefined") {
      for (const target of targets) target.classList.add("is-visible")

      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    )

    for (const target of targets) observer.observe(target)

    return () => observer.disconnect()
  }, [])

  return (
    <div className="fitcv-landing" ref={rootRef}>
      <header className="lp-header" ref={headerRef}>
        <div className="lp-header-inner">
          <span className="lp-brand">
            <span className="lp-brand-mark" aria-hidden="true">
              F
            </span>
            FitCV
          </span>

          <nav className="lp-nav" aria-label="Landing navigation">
            <a href="#product">Product</a>
            <a href="#preview">Preview</a>
            <a href="#scoring">Scoring</a>
            <a href="#workflow">Workflow</a>
            <a href="#recruiters">Recruiters</a>
          </nav>

          <div className="lp-header-actions">
            <button
              type="button"
              className="lp-btn lp-btn-ghost"
              onClick={onGetStarted}
            >
              Sign in
            </button>
            <button
              type="button"
              className="lp-btn lp-btn-primary"
              onClick={onGetStarted}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-grid" aria-hidden="true" />
          <div className="lp-hero-glow" aria-hidden="true" />

          <div className="lp-hero-copy">
            <span className="lp-badge">
              <span className="lp-badge-dot" aria-hidden="true" />
              CV analysis with the evidence attached
            </span>

            <h1 className="lp-hero-title">
              Stop guessing why your CV
              <br />
              never <em>matches the role</em>
            </h1>

            <p className="lp-hero-sub">
              FitCV parses your CV, scores it against a specific job description
              across four categories, and shows exactly which keywords it
              matched and which it could not find. Then it helps you rebuild and
              send the version that closes the gap.
            </p>
          </div>

          <HeroStage onGetStarted={onGetStarted} />
        </div>
      </section>

      <section className="lp-section" id="product">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">For job seekers</span>
            <h2>Everything that happens between uploading and applying</h2>
            <p>
              Four things you can do with one CV and one job description — each
              feeding the next, so the work compounds instead of restarting.
            </p>
          </div>

          <div className="lp-cards lp-reveal">
            {SEEKER_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="lp-card"
                onPointerMove={handleCardPointerMove}
              >
                <span className="lp-card-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>

          <div className="lp-stats lp-reveal">
            {FACTS.map((fact) => (
              <div key={fact.value} className="lp-stat">
                <span className="lp-stat-value">{fact.value}</span>
                <span className="lp-stat-label">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="preview">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">Product preview</span>
            <h2>The shape of the data you get back</h2>
            <p>
              Step through the four stages to see what each one actually
              returns. These are the fields the product works with, not a
              mock-up of a dashboard.
            </p>
          </div>

          <div className="lp-reveal">
            <InteractiveDemo />
          </div>
        </div>
      </section>

      <section className="lp-section" id="scoring">
        <div className="lp-section-inner">
          <div className="lp-split lp-reveal">
            <div className="lp-section-head">
              <span className="lp-mono">Scoring</span>
              <h2>A score per category, never one blind number</h2>
              <p>
                Each category carries its own score plus the evidence behind it
                — the skills it found, the ones it did not, and a short
                explanation. A weak soft-skills score next to a strong education
                score tells you where the next edit belongs.
              </p>
            </div>

            <ScoreChart
              bars={SAMPLE_BARS}
              caption="Sample analyzer output — illustrative values, not aggregate statistics"
            />
          </div>
        </div>
      </section>

      <section className="lp-section" id="workflow">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">Job seeker workflow</span>
            <h2>Upload, score, rebuild — and only keep what scored better</h2>
            <p>
              Your CV moves along one line: uploaded, parsed, scored against the
              job description. Every rebuild forks off that line as a draft.
              Re-score it, and it either earns a version of its own or is
              dropped — the CV you already sent never changes underneath you.
            </p>
          </div>

          <div className="lp-reveal">
            <BranchTimeline
              spec={SEEKER_FLOW}
              caption="Job seeker workflow — illustrative flow, not recorded activity"
            />
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">How it works</span>
            <h2>Four steps, in the order you would actually do them</h2>
          </div>

          <div className="lp-steps lp-reveal">
            {STEPS.map((step) => (
              <article key={step.title} className="lp-step">
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="recruiters">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">For recruiters</span>
            <h2>The same scoring, pointed at a candidate pool</h2>
            <p>
              Recruiters get their own workspace built on the identical
              analyzer, so the score a candidate sees and the score you rank by
              come from the same place.
            </p>
          </div>

          <div className="lp-cards lp-reveal">
            {HR_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="lp-card"
                onPointerMove={handleCardPointerMove}
              >
                <span className="lp-card-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>

          <div className="lp-reveal">
            <HRDemo />
          </div>

          <div className="lp-reveal">
            <BranchTimeline
              spec={HR_FLOW}
              caption="Recruiter workflow — illustrative flow, not recorded activity"
            />
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-close">
        <div className="lp-section-inner">
          <div className="lp-close">
            <div className="lp-close-grid" aria-hidden="true" />

            <div className="lp-close-body lp-reveal">
              <div className="lp-section-head lp-close-head">
                <span className="lp-mono">Get started</span>
                <h2>Run your CV against the job you actually want</h2>
                <p>
                  Upload once, score against a real posting, and keep every
                  version you build along the way. Job seekers and recruiters
                  each get their own workspace.
                </p>
              </div>

              <div className="lp-close-buttons">
                <button
                  type="button"
                  className="lp-btn lp-btn-primary"
                  onClick={onGetStarted}
                >
                  Analyze my CV
                  <ArrowRight size={16} weight="bold" />
                </button>

                <a href="#product" className="lp-btn lp-btn-outline">
                  Read what it does
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-brand">
            <span className="lp-brand-mark" aria-hidden="true">
              F
            </span>
            FitCV
          </span>
          <p>CV analysis, rebuilding and application tracking.</p>
        </div>
      </footer>
    </div>
  )
}
