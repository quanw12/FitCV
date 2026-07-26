import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Lightning,
  FileText,
  Users,
  ChartBar,
  ArrowRight,
  User,
  Briefcase,
  MagnifyingGlass,
  Sparkle,
  Handshake,
  CloudArrowUp,
  Gear,
  CaretDown,
  CheckCircle,
} from "@phosphor-icons/react"

import ParticleField from "@/ui/components/landing/ParticleField"
import TypedText from "@/ui/components/landing/TypedText"
import ScrollReveal from "@/ui/components/landing/ScrollReveal"

interface LandingScreenProps {
  onGetStarted: () => void
}

const ACCENT = "124, 58, 237"

const features = [
  {
    icon: <FileText size={28} weight="duotone" />,
    title: "AI-Powered CV Analysis",
    description:
      "Upload your CV and get a detailed match score against any job description. Our engine extracts skills, experience, and qualifications with source-grounded accuracy.",
  },
  {
    icon: <Lightning size={28} weight="duotone" />,
    title: "Smart Job Matching",
    description:
      "Compare CVs against job requirements with a weighted scoring system. See exactly where you excel and where you need improvement.",
  },
  {
    icon: <Users size={28} weight="duotone" />,
    title: "HR Screening Suite",
    description:
      "Upload batch CVs, rank candidates against any JD, manage your hiring pipeline, and draft candidate emails — all from one platform.",
  },
  {
    icon: <ChartBar size={28} weight="duotone" />,
    title: "Insights & Reports",
    description:
      "Track application history, view market insights from JD libraries, and generate hiring reports to make data-driven decisions.",
  },
]

const studentBenefits = [
  {
    icon: <MagnifyingGlass size={20} weight="duotone" />,
    text: "Analyze your CV against any job description",
  },
  {
    icon: <Sparkle size={20} weight="duotone" />,
    text: "Get AI improvement suggestions tailored to your target role",
  },
  {
    icon: <ChartBar size={20} weight="duotone" />,
    text: "Track applications and view market insights",
  },
]

const hrBenefits = [
  {
    icon: <Briefcase size={20} weight="duotone" />,
    text: "Create job posts and collect applications",
  },
  {
    icon: <Users size={20} weight="duotone" />,
    text: "Upload batch CVs and rank against any JD",
  },
  {
    icon: <Handshake size={20} weight="duotone" />,
    text: "Manage pipeline, draft emails, and generate reports",
  },
]

const steps = [
  {
    icon: <CloudArrowUp size={32} weight="duotone" />,
    title: "Upload",
    description:
      "Upload a CV or paste a job description. We support PDF, DOCX, and plain text.",
  },
  {
    icon: <Gear size={32} weight="duotone" />,
    title: "AI Analysis",
    description:
      "Our engine parses, extracts, and scores every skill, qualification, and experience against the target role.",
  },
  {
    icon: <Sparkle size={32} weight="duotone" />,
    title: "Act on Insights",
    description:
      "View match scores, skill gaps, improvement suggestions, and rank candidates — all driven by source-grounded evidence.",
  },
]

const faqs = [
  {
    q: "Is FitCV free to use?",
    a: "Students can analyze their CVs and get improvement suggestions for free. HR teams can start with a free trial that includes batch upload and ranking features.",
  },
  {
    q: "What file formats are supported?",
    a: "We accept PDF, DOCX, and plain text files. Each file must be under 10 MB. CVs are processed securely and never shared without your consent.",
  },
  {
    q: "How accurate is the AI matching?",
    a: "Our engine uses source-grounded extraction — every score point is traced back to specific content in the CV or job description. This ensures transparency and auditability in every match.",
  },
  {
    q: "Can HR use FitCV without publishing a job?",
    a: "Yes. The batch upload flow lets you paste screening criteria and rank external CVs directly — no job post required. It is designed for internal screening and agency use.",
  },
  {
    q: "Is my data secure?",
    a: "All CVs and job data are encrypted at rest and in transit. We do not use your data to train external AI models. Files are stored securely and can be deleted at any time.",
  },
]

export default function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }, [])

  return (
    <div
      style={{
        background: "#0a0a1a",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "'Geist', system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      <ParticleField accent={ACCENT} count={120} />

      {/* Floating Header */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: scrolled ? "10px 28px" : "18px 28px",
          background: scrolled ? "rgba(10, 10, 26, 0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <Lightning size={16} color="white" weight="fill" />
          </div>
          <span
            style={{
              fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: "-0.02em",
            }}
          >
            FitCV
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <button
            onClick={() => scrollTo("features")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.65)",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 500,
              transition: "color 0.15s",
              display: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.65)")
            }
          >
            Features
          </button>
          <button
            onClick={() => scrollTo("for-you")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.65)",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 500,
              transition: "color 0.15s",
              display: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.65)")
            }
          >
            For You
          </button>
          <button
            onClick={onGetStarted}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
          >
            Get Started
          </button>
        </nav>
      </motion.header>

      {/* Hero */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ maxWidth: 860 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.25)",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#A78BFA",
              marginBottom: 28,
              letterSpacing: "0.02em",
            }}
          >
            <Lightning size={12} weight="fill" />
            AI-Powered Talent Intelligence
          </motion.div>

          <h1
            style={{
              fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(40px, 7.5vw, 76px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              marginBottom: 24,
            }}
          >
            Match talent to{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #A78BFA, #7C3AED, #0891B2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              opportunity
            </span>
            <br />
            with AI that{" "}
            <TypedText
              words={["understands", "scores", "analyzes", "accelerates"]}
              className=""
              cursorClassName=""
            />
          </h1>
          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              color: "rgba(255,255,255,0.5)",
              maxWidth: 580,
              margin: "0 auto 40px",
              lineHeight: 1.65,
            }}
          >
            FitCV combines AI-driven CV parsing, intelligent job matching, and a
            complete hiring pipeline — so students land better roles and
            recruiters find top talent faster.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "15px 34px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 8px 28px rgba(124,58,237,0.35)",
              }}
            >
              Get Started Free <ArrowRight size={16} weight="bold" />
            </motion.button>
            <motion.button
              onClick={() => scrollTo("how-it-works")}
              whileHover={{ background: "rgba(255,255,255,0.1)" }}
              style={{
                padding: "15px 28px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              How It Works
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1 }}
          style={{ position: "absolute", bottom: 32 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 20,
              height: 32,
              borderRadius: 10,
              border: "2px solid rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "4px 0",
            }}
          >
            <div
              style={{
                width: 2,
                height: 8,
                borderRadius: 2,
                background: "rgba(255,255,255,0.4)",
              }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works — dual lane */}
      <section
        id="how-it-works"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "100px 24px",
        }}
      >
        <ScrollReveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2
              style={{
                fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(30px, 5vw, 48px)",
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              One engine,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                two workflows
              </span>
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 15,
                maxWidth: 540,
                margin: "0 auto",
              }}
            >
              FitCV adapts to who you are. Students analyze and improve their
              CVs. HR teams screen and rank candidates — all powered by the same
              AI engine.
            </p>
          </div>
        </ScrollReveal>

        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          {/* Student lane */}
          <ScrollReveal direction="left">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                flexWrap: "wrap",
                padding: "28px 32px",
                borderRadius: 20,
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))",
                border: "1px solid rgba(37,99,235,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(37,99,235,0.05))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#60A5FA",
                  }}
                >
                  <User size={18} weight="duotone" />
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#60A5FA",
                  }}
                >
                  For Students
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {[
                  { label: "Upload CV", icon: <CloudArrowUp size={18} /> },
                  { label: "AI Match Score", icon: <Lightning size={18} /> },
                  {
                    label: "View Skill Gaps",
                    icon: <MagnifyingGlass size={18} />,
                  },
                  {
                    label: "Improve & Re-analyze",
                    icon: <Sparkle size={18} />,
                  },
                ].map((step, i) => (
                  <div
                    key={step.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 10,
                        background: "rgba(37,99,235,0.1)",
                        border: "1px solid rgba(37,99,235,0.15)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.75)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ color: "#60A5FA" }}>{step.icon}</span>
                      {step.label}
                    </div>
                    {i < 3 && (
                      <ArrowRight
                        size={12}
                        color="rgba(37,99,235,0.3)"
                        weight="bold"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* HR lane */}
          <ScrollReveal direction="right">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                flexWrap: "wrap",
                padding: "28px 32px",
                borderRadius: 20,
                background:
                  "linear-gradient(135deg, rgba(217,119,6,0.06), rgba(217,119,6,0.02))",
                border: "1px solid rgba(217,119,6,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, rgba(217,119,6,0.2), rgba(217,119,6,0.05))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FBBF24",
                  }}
                >
                  <Briefcase size={18} weight="duotone" />
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#FBBF24",
                  }}
                >
                  For HR & Recruiters
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {[
                  {
                    label: "Post JD / Upload CVs",
                    icon: <FileText size={18} />,
                  },
                  {
                    label: "AI Candidate Ranking",
                    icon: <ChartBar size={18} />,
                  },
                  {
                    label: "Review Evidence",
                    icon: <MagnifyingGlass size={18} />,
                  },
                  { label: "Screen & Pipeline", icon: <Users size={18} /> },
                ].map((step, i) => (
                  <div
                    key={step.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 10,
                        background: "rgba(217,119,6,0.1)",
                        border: "1px solid rgba(217,119,6,0.15)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.75)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ color: "#FBBF24" }}>{step.icon}</span>
                      {step.label}
                    </div>
                    {i < 3 && (
                      <ArrowRight
                        size={12}
                        color="rgba(217,119,6,0.3)"
                        weight="bold"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Common engine note */}
          <ScrollReveal>
            <div
              style={{
                textAlign: "center",
                padding: "16px 24px",
                borderRadius: 12,
                background: "rgba(124,58,237,0.06)",
                border: "1px solid rgba(124,58,237,0.1)",
                alignSelf: "center",
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <Lightning
                size={14}
                style={{ verticalAlign: "middle", marginRight: 6 }}
                color="rgba(124,58,237,0.5)"
                weight="fill"
              />
              Both workflows share the same AI parsing, evidence extraction, and
              weighted scoring engine.
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* AI Engine Deep-Dive */}
      <section
        id="ai-engine"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "100px 24px",
        }}
      >
        <ScrollReveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2
              style={{
                fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(30px, 5vw, 48px)",
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Inside the{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI engine
              </span>
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 15,
                maxWidth: 540,
                margin: "0 auto",
              }}
            >
              Every match passes through five stages — from raw document to
              scored result, fully auditable and source-grounded.
            </p>
          </div>
        </ScrollReveal>

        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: <CloudArrowUp size={22} weight="duotone" />,
              title: "Document Ingestion",
              description:
                "PDF/DOCX validated, encrypted at rest, and text-extracted via OCR or direct parsing into structured sections.",
              tag: "PyMuPDF · python-docx",
            },
            {
              icon: <FileText size={22} weight="duotone" />,
              title: "Structured Parsing",
              description:
                "Raw text segmented into sections — skills, experience, education, certifications — with confidence scoring at each level.",
              tag: "NLP section classifier",
            },
            {
              icon: <Sparkle size={22} weight="duotone" />,
              title: "AI Fact Extraction",
              description:
                "Gemini extracts source-grounded facts with verbatim citations. Every claim is traced to its exact location in the original document.",
              tag: "Gemini AI · fitcv-v2",
            },
            {
              icon: <ChartBar size={22} weight="duotone" />,
              title: "Weighted Scoring",
              description:
                "Multi-category engine compares extracted facts against job requirements. Skills weighted by relevance, experience by seniority match.",
              tag: "Weighted scorer · evidence_json",
            },
            {
              icon: <CheckCircle size={22} weight="duotone" />,
              title: "Results & Insights",
              description:
                "Match score, skill gap analysis, AI improvement suggestions, ranked candidates — all backed by auditable evidence from extraction.",
              tag: "match_result · fitcv-engine",
            },
          ].map((stage, i) => (
            <ScrollReveal key={stage.title} delay={i * 0.1}>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  position: "relative",
                  paddingLeft: 40,
                }}
              >
                {i < 4 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 17,
                      top: 44,
                      bottom: 0,
                      width: 2,
                      background:
                        "linear-gradient(180deg, rgba(124,58,237,0.3), rgba(124,58,237,0.05))",
                    }}
                  />
                )}

                <div
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 24,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                    boxShadow:
                      "0 0 0 3px #0a0a1a, 0 0 0 5px rgba(124,58,237,0.2)",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {i + 1}
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: "24px 28px",
                    borderRadius: 20,
                    background:
                      "linear-gradient(135deg, rgba(124,58,237,0.05), rgba(255,255,255,0.015))",
                    border: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background:
                          "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#A78BFA",
                        flexShrink: 0,
                        border: "1px solid rgba(124,58,237,0.12)",
                      }}
                    >
                      {stage.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <h3
                          style={{
                            fontFamily:
                              "'Cabinet Grotesk', 'Geist', sans-serif",
                            fontWeight: 700,
                            fontSize: 17,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {stage.title}
                        </h3>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(124,58,237,0.12)",
                            color: "#A78BFA",
                            border: "1px solid rgba(124,58,237,0.15)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stage.tag}
                        </span>
                      </div>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 13.5,
                          lineHeight: 1.7,
                          margin: 0,
                        }}
                      >
                        {stage.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "100px 24px",
        }}
      >
        <ScrollReveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2
              style={{
                fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(30px, 5vw, 48px)",
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Everything you need to{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                hire smarter
              </span>
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 16,
                maxWidth: 500,
                margin: "0 auto",
              }}
            >
              From CV parsing to pipeline management — FitCV equips both sides
              of the hiring table.
            </p>
          </div>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                style={{
                  padding: 32,
                  borderRadius: 20,
                  background:
                    "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(8,145,178,0.04))",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(12px)",
                  cursor: "default",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background:
                      "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#A78BFA",
                    marginBottom: 18,
                    border: "1px solid rgba(124,58,237,0.15)",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                    fontWeight: 700,
                    fontSize: 18,
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}
                >
                  {f.description}
                </p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* For You — Two sides */}
      <section
        id="for-you"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "100px 24px",
        }}
      >
        <ScrollReveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2
              style={{
                fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(30px, 5vw, 48px)",
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Built for{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                both sides
              </span>{" "}
              of hiring
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 16,
                maxWidth: 500,
                margin: "0 auto",
              }}
            >
              Whether you are looking for your next role or building your team,
              FitCV adapts to you.
            </p>
          </div>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 32,
            maxWidth: 960,
            margin: "0 auto",
          }}
        >
          <ScrollReveal direction="left">
            <motion.div
              whileHover={{ y: -4 }}
              style={{
                padding: 36,
                borderRadius: 24,
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02))",
                border: "1px solid rgba(37,99,235,0.15)",
                backdropFilter: "blur(12px)",
                height: "100%",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(37,99,235,0.05))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60A5FA",
                  marginBottom: 20,
                  border: "1px solid rgba(37,99,235,0.2)",
                }}
              >
                <User size={26} weight="duotone" />
              </div>
              <h3
                style={{
                  fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                For Students
              </h3>
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 14,
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                Land the role you deserve. Upload your CV, compare against real
                job descriptions, and get actionable AI feedback.
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {studentBenefits.map((b) => (
                  <div
                    key={b.text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "#60A5FA", flexShrink: 0 }}>
                      {b.icon}
                    </span>
                    {b.text}
                  </div>
                ))}
              </div>
            </motion.div>
          </ScrollReveal>

          <ScrollReveal direction="right">
            <motion.div
              whileHover={{ y: -4 }}
              style={{
                padding: 36,
                borderRadius: 24,
                background:
                  "linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.02))",
                border: "1px solid rgba(217,119,6,0.15)",
                backdropFilter: "blur(12px)",
                height: "100%",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(217,119,6,0.2), rgba(217,119,6,0.05))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FBBF24",
                  marginBottom: 20,
                  border: "1px solid rgba(217,119,6,0.2)",
                }}
              >
                <Briefcase size={26} weight="duotone" />
              </div>
              <h3
                style={{
                  fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                For HR & Recruiters
              </h3>
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 14,
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                Screen smarter, not harder. Score candidates against your
                requirements with AI-driven evidence extraction.
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {hrBenefits.map((b) => (
                  <div
                    key={b.text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "#FBBF24", flexShrink: 0 }}>
                      {b.icon}
                    </span>
                    {b.text}
                  </div>
                ))}
              </div>
            </motion.div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "100px 24px",
        }}
      >
        <ScrollReveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(28px, 4vw, 42px)",
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Frequently asked{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                questions
              </span>
            </h2>
          </div>
        </ScrollReveal>

        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.q} delay={i * 0.06}>
              <div
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background:
                    "linear-gradient(135deg, rgba(124,58,237,0.04), rgba(255,255,255,0.02))",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%",
                    padding: "18px 22px",
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.8)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  {faq.q}
                  <motion.div
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      flexShrink: 0,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    <CaretDown size={14} weight="bold" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          padding: "0 22px 18px",
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 14,
                          lineHeight: 1.7,
                        }}
                      >
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "120px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            borderRadius: 32,
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.1), rgba(8,145,178,0.05))",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "72px 40px",
            backdropFilter: "blur(16px)",
          }}
        >
          <ScrollReveal>
            <h2
              style={{
                fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(30px, 4.5vw, 48px)",
                letterSpacing: "-0.02em",
                marginBottom: 20,
              }}
            >
              Ready to{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #A78BFA, #7C3AED, #0891B2)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                transform hiring
              </span>
              ?
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 16,
                marginBottom: 36,
                lineHeight: 1.6,
                maxWidth: 500,
                margin: "0 auto 36px",
              }}
            >
              Join thousands of students and recruiters using FitCV to make
              smarter talent decisions with AI.
            </p>
            <motion.button
              onClick={onGetStarted}
              whileHover={{
                scale: 1.03,
                boxShadow: "0 12px 36px rgba(124,58,237,0.45)",
              }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "16px 40px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 8px 28px rgba(124,58,237,0.35)",
              }}
            >
              Get Started Free <ArrowRight size={16} weight="bold" />
            </motion.button>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "48px 24px 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 32,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Lightning size={16} color="rgba(124,58,237,0.6)" weight="fill" />
              <span
                style={{
                  fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                  fontWeight: 800,
                  fontSize: 17,
                  letterSpacing: "-0.02em",
                }}
              >
                FitCV
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.6,
                maxWidth: 260,
              }}
            >
              AI-powered talent intelligence platform. Built for students,
              recruiters, and hiring teams.
            </p>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              Platform
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Features", "How It Works", "Pricing", "FAQ"].map((item) => (
                <span
                  key={item}
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              Company
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["About", "Blog", "Careers", "Contact"].map((item) => (
                <span
                  key={item}
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              Legal
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Privacy", "Terms", "Security", "Cookies"].map((item) => (
                <span
                  key={item}
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            maxWidth: 1100,
            margin: "40px auto 0",
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
            color: "rgba(255,255,255,0.2)",
          }}
        >
          <span>
            &copy; {new Date().getFullYear()} FitCV. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  )
}
