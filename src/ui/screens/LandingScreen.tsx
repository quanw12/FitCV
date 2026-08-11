import { useEffect, useRef, type PointerEvent, type ReactNode } from "react"
import {
  ArrowRight,
  Briefcase,
  Buildings,
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
import BrandMark from "@/ui/components/BrandMark"

import "./landing.css"

interface LandingScreenProps {
  onGetStarted: () => void
  onSignIn?: () => void
}

interface Feature {
  icon: ReactNode
  title: string
  copy: string
}

const SEEKER_FEATURES: Feature[] = [
  {
    icon: <FileText size={18} weight="duotone" />,
    title: "Parse and version every CV",
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
  {
    icon: <MagnifyingGlass size={18} weight="duotone" />,
    title: "Find matching jobs with AI",
    copy: "Select a parsed CV and FitCV scans freehire.me and LinkedIn for jobs that match your skills, experience and location — no manual searching needed.",
  },
]

const HR_FEATURES: Feature[] = [
  {
    icon: <Buildings size={18} weight="duotone" />,
    title: "Create and publish job posts",
    copy: "Paste a raw job description and AI extracts structured fields. Review, tweak, and publish — then copy the public link for candidates.",
  },
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
  {
    icon: <FileText size={18} weight="duotone" />,
    title: "Upload external CVs and rank them",
    copy: "Paste a job description, upload up to 20 CVs from your own sourcing, and FitCV parses, scores and ranks them side by side — no FitCV job post required.",
  },
]

/* Job seeker: the fork lets the candidate either send the version or loop back
   through improvement — every rebuild is saved, so nothing is discarded. */

const SEEKER_FLOW: TimelineSpec = {
  badge: "LIVE",
  marker: "CV v1 · PDF",
  stages: ["CV uploaded", "Parsed · sections", "JD attached", "Scored · 4 categories"],
  gate: "YOU DECIDE",

  up: {
    badge: "APPLY",
    title: "Send this version",
    note: "Strong match · gaps closed",
    tone: "pass",
    nodes: [
      { label: "Applied", glyph: "check" },
      { label: "Screening", glyph: "dot" },
      { label: "Interview", glyph: "up" },
    ],
    ending: { kind: "rejoin", label: "Offer · tracked" },
  },

  down: {
    badge: "IMPROVE",
    title: "Close the gaps",
    note: "Weak match · keywords missing",
    tone: "loop",
    nodes: [
      { label: "AI suggestions", glyph: "spark" },
      { label: "Saved as v2", glyph: "plus" },
      { label: "Re-scored", glyph: "loop" },
    ],
    ending: { kind: "loop", label: "Same JD · new version · back through the flow" },
  },
}

/* Recruiter: the score ranks, HR decides — a candidate is moved or held by a
   person, never by the number, and the record stays even when not moved on. */

const HR_FLOW: TimelineSpec = {
  badge: "OPEN",
  marker: "Sr Frontend · 24 CVs",
  stages: ["Role published", "CVs collected", "Parsed · evidence", "Ranked vs JD"],
  gate: "HR DECIDES",

  up: {
    badge: "SHORTLIST",
    title: "Moved to screening",
    note: "Above threshold · reviewed",
    tone: "pass",
    nodes: [
      { label: "Invite drafted", glyph: "mail" },
      { label: "HR approved · sent", glyph: "check" },
      { label: "Offer", glyph: "up" },
    ],
    ending: { kind: "rejoin", label: "Hired" },
  },

  down: {
    badge: "NOT NOW",
    title: "Not moved forward",
    note: "Below threshold · reviewed",
    tone: "fail",
    nodes: [
      { label: "Rejection drafted", glyph: "mail" },
      { label: "HR approved · sent", glyph: "check" },
      { label: "Rejected", glyph: "cross" },
    ],
    ending: { kind: "stop", label: "Stage history kept" },
  },
}

function handleCardPointerMove(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget
  const box = card.getBoundingClientRect()
  card.style.setProperty("--lp-mx", `${event.clientX - box.left}px`)
  card.style.setProperty("--lp-my", `${event.clientY - box.top}px`)
}

export default function LandingScreen({
  onGetStarted,
  onSignIn = onGetStarted,
}: LandingScreenProps) {
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
            <BrandMark size={26} className="lp-brand-mark" />
            FitCV
          </span>

          <nav className="lp-nav" aria-label="Landing navigation">
            <a href="#seekers">Job seekers</a>
            <a href="#recruiters">Recruiters</a>
          </nav>

          <div className="lp-header-actions">
            <button
              type="button"
              className="lp-btn lp-btn-ghost"
              onClick={onSignIn}
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
              CV analysis that shows
              <br />
              <em>the evidence</em>
            </h1>

            <p className="lp-hero-sub">
              FitCV parses resumes, scores them against a specific job
              description across four categories, and shows exactly which
              keywords matched and which were missing. Job seekers rebuild and
              track; recruiters rank and manage the pipeline.
            </p>
          </div>

          <HeroStage onGetStarted={onGetStarted} />
        </div>
      </section>

      <section className="lp-section" id="seekers">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">For job seekers</span>
            <h2>Upload, score, rebuild — and track every version</h2>
            <p>
              Drop in a CV and a job description. The analyzer returns scored
              categories with evidence, improvement suggestions, and a versioned
              history — so the next edit closes the gap instead of restating it.
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

          <div className="lp-reveal">
            <InteractiveDemo />
          </div>

          <div className="lp-reveal">
            <BranchTimeline
              spec={SEEKER_FLOW}
              caption="Job seeker workflow — illustrative flow, not recorded activity"
            />
          </div>
        </div>
      </section>

      <section className="lp-section" id="recruiters">
        <div className="lp-section-inner">
          <div className="lp-section-head lp-reveal">
            <span className="lp-mono">For recruiters</span>
            <h2>Rank, pipeline, and hire with the same scoring</h2>
            <p>
              Post a role, receive CVs, and rank every candidate against the
              same criteria job seekers see. The scoring engine is identical —
              the workflow adapts to who you are.
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
              caption="Recruiter workflow — the score ranks, HR decides. Illustrative flow, not recorded activity"
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
                <h2>Analyze a CV or rank a candidate pool</h2>
                <p>
                  Upload once, score against a real posting, and keep every
                  version you build along the way. Recruiters get their own
                  workspace with the same scoring engine.
                </p>
              </div>

              <div className="lp-close-buttons">
                <button
                  type="button"
                  className="lp-btn lp-btn-primary"
                  onClick={onGetStarted}
                >
                  Get started
                  <ArrowRight size={16} weight="bold" />
                </button>

                <a href="#seekers" className="lp-btn lp-btn-outline">
                  See what it does
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-brand">
            <BrandMark size={26} className="lp-brand-mark" />
            FitCV
          </span>
          <p>CV analysis, rebuilding and application tracking.</p>
        </div>
      </footer>
    </div>
  )
}
