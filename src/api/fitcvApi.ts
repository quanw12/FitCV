import { authApi } from "./authApi"

import type { AsyncStatus } from "@/types/app"
import type {
  AnalyzeCvRequest,
  CvVersion,
  MatchAnalysis,
} from "@/types/analyzer"
import type {
  GenerateImprovementResponse,
  ImprovementReport,
  ImprovementReportResponse,
  SuggestionPriority,
} from "@/types/improvement"

import { API_BASE_URL } from "./config"

const USE_IMPROVEMENT_FIXTURE =
  import.meta.env.VITE_IMPROVEMENT_FIXTURE === "true" || !API_BASE_URL
const USE_ANALYZER_FIXTURE = import.meta.env.VITE_ANALYZER_FIXTURE === "true"

interface BackendReport {
  skill_gaps: Array<{
    skill: string
    priority: SuggestionPriority
    reason: string
    jd_evidence: string
  }>

  section_feedback: Array<{
    section: string
    issue: string
    explanation: string
    priority: SuggestionPriority
    suggested_action: string
  }>

  rewrite_suggestions: Array<{
    section: string
    original_text: string
    issue: string
    suggested_text: string
    framework: string
  }>

  quick_wins: Array<{
    title: string
    category: string
    priority: SuggestionPriority
    explanation: string
  }>
}

interface BackendReportResponse {
  match_result_id: number

  status: AsyncStatus

  generated_at: string | null

  error_message: string | null

  overall_score: number | null

  stale: boolean

  report: BackendReport | null
}

interface BackendGenerateResponse {
  match_result_id: number

  status: AsyncStatus

  task_id: number | null
}

interface BackendCvVersion {
  cv_id: number
  file_name: string
  file_type: "PDF" | "DOCX"
  file_size_kb: number | null
  version_number: number
  is_latest: boolean
  uploaded_at: string
  parse_status: AsyncStatus
  parser_version: string | null
  error_message: string | null
}

interface BackendMatchAnalysis {
  match_result_id: number
  status: AsyncStatus
  cv_id: number
  job_description_id: number | null
  title: string
  overall_score: number | null
  match_label: MatchAnalysis["matchLabel"]
  pass_probability: number | null
  breakdown: MatchAnalysis["breakdown"]
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  algorithm_version: string
  error_message: string | null
  generated_at: string
  completed_at: string | null
  disclaimer: string
}

const fixtureReport: ImprovementReport = {
  skillGaps: [
    {
      id: "skill-docker",
      skill: "Docker",
      priority: "High",
      reason:
        "The CV does not demonstrate the containerization experience required by this role.",
      jdEvidence: "Experience with Docker and containerized deployment.",
    },

    {
      id: "skill-cicd",
      skill: "CI/CD",
      priority: "Medium",
      reason:
        "Deployment automation is requested but is not demonstrated in the CV.",
      jdEvidence: "Familiarity with CI/CD pipelines.",
    },

    {
      id: "skill-redis",
      skill: "Redis",
      priority: "Low",
      reason: "Caching knowledge would strengthen the backend profile.",
      jdEvidence: "Knowledge of Redis is preferred.",
    },
  ],

  sectionFeedback: [
    {
      id: "feedback-work",
      section: "WorkExperience",
      issue: "Experience bullets describe responsibilities without outcomes.",
      explanation: "Recruiters cannot assess the scale or impact of the work.",
      priority: "High",
      suggestedAction:
        "Use action verbs and add verified scope or results for each major contribution.",
    },

    {
      id: "feedback-summary",
      section: "Summary",
      issue: "The summary is generic and not tailored to the target role.",
      explanation: "It misses the strongest relevant backend skills.",
      priority: "Medium",
      suggestedAction:
        "Mention the target role and two or three skills already supported by the CV.",
    },
  ],

  rewriteSuggestions: [
    {
      id: "rewrite-backend",
      section: "WorkExperience",
      originalText:
        "Responsible for developing backend features and fixing bugs.",
      issue: "The statement is vague and has no verifiable scope or outcome.",
      suggestedText:
        "Developed [N] backend features using the technologies already listed in your CV, improving [verified outcome].",
      framework: "Problem → Action → Result",
    },

    {
      id: "rewrite-project",
      section: "Projects",
      originalText: "Worked with a team to build a web application.",
      issue: "Your individual action and project result are unclear.",
      suggestedText:
        "Collaborated with a team of [N] to implement [specific feature], resulting in [verified project outcome].",
      framework: "Problem → Action → Result",
    },
  ],

  quickWins: [
    {
      id: "quick-docker",
      title: "Add Docker only if you have used it",
      category: "Skill",
      priority: "High",
      explanation: "Describe a real project or course where you used it.",
    },

    {
      id: "quick-metric",
      title: "Quantify one experience bullet",
      category: "Experience",
      priority: "Medium",
      explanation: "Replace placeholders only with figures you can verify.",
    },

    {
      id: "quick-summary",
      title: "Shorten the summary to three sentences",
      category: "Format",
      priority: "Low",
      explanation: "Keep it focused on evidence relevant to this JD.",
    },
  ],
}

let fixtureCvSequence = 0
const fixtureCvs = new Map<number, CvVersion>()

function sessionToken(): string | undefined {
  return authApi.getSession()?.accessToken
}

function requireAnalyzerBackend() {
  if (!API_BASE_URL)
    throw new Error(
      "Analyzer backend is not configured. Set VITE_API_BASE_URL in .env.local and restart Vite.",
    )
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const token = sessionToken()
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData))
    headers.set("Content-Type", "application/json")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: unknown
    } | null
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `Request failed with status ${response.status}.`,
    )
  }
  return response
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request(path, init)).json() as Promise<T>
}

function stableId(prefix: string, parts: string[]): string {
  let hash = 0

  for (const char of parts.join("|"))
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0

  return `${prefix}-${Math.abs(hash)}`
}

function normalizeReport(report: BackendReport): ImprovementReport {
  return {
    skillGaps: report.skill_gaps.map((item) => ({
      ...item,
      id: stableId("skill", [item.skill]),
      jdEvidence: item.jd_evidence,
    })),

    sectionFeedback: report.section_feedback.map((item) => ({
      ...item,
      id: stableId("feedback", [item.section, item.issue]),
      section: normalizeSection(item.section),
      suggestedAction: item.suggested_action,
    })),

    rewriteSuggestions: report.rewrite_suggestions.map((item) => ({
      id: stableId("rewrite", [item.section, item.original_text]),
      section: normalizeSection(item.section),
      originalText: item.original_text,
      issue: item.issue,
      suggestedText: item.suggested_text,
      framework: item.framework,
    })),

    quickWins: report.quick_wins.map((item) => ({
      ...item,
      id: stableId("quick", [item.title]),
    })),
  }
}

function normalizeSection(
  value: string,
): "Summary" | "WorkExperience" | "Skills" | "Education" | "Projects" | "Other" {
  const allowed = [
    "Summary",
    "WorkExperience",
    "Skills",
    "Education",
    "Projects",
  ] as const

  return allowed.find((section) => section === value) ?? "Other"
}

function normalizeResponse(
  payload: BackendReportResponse,
): ImprovementReportResponse {
  return {
    matchResultId: String(payload.match_result_id),
    status: payload.status,
    generatedAt: payload.generated_at,

    errorMessage: payload.error_message,
    overallScore: payload.overall_score,
    stale: payload.stale,

    report: payload.report ? normalizeReport(payload.report) : null,
  }
}

function fixtureResponse(matchResultId: string): ImprovementReportResponse {
  return {
    matchResultId,
    status: "Success",
    generatedAt: new Date().toISOString(),
    errorMessage: null,
    overallScore: 78,
    stale: false,
    report: fixtureReport,
  }
}

function normalizeCv(payload: BackendCvVersion): CvVersion {
  return {
    cvId: payload.cv_id,
    fileName: payload.file_name,
    fileType: payload.file_type,
    fileSizeKb: payload.file_size_kb,
    versionNumber: payload.version_number,
    isLatest: payload.is_latest,
    uploadedAt: payload.uploaded_at,
    parseStatus: payload.parse_status,
    parserVersion: payload.parser_version,
    errorMessage: payload.error_message,
  }
}

function normalizeMatch(payload: BackendMatchAnalysis): MatchAnalysis {
  return {
    matchResultId: String(payload.match_result_id),
    status: payload.status,
    cvId: payload.cv_id,
    jobDescriptionId: payload.job_description_id,
    title: payload.title,
    overallScore: payload.overall_score,
    matchLabel: payload.match_label,
    passProbability: payload.pass_probability,
    breakdown: payload.breakdown,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    suggestions: payload.suggestions,
    algorithmVersion: payload.algorithm_version,
    errorMessage: payload.error_message,
    generatedAt: payload.generated_at,
    completedAt: payload.completed_at,
    disclaimer: payload.disclaimer,
  }
}

function fixtureMatch(cvId: number): MatchAnalysis {
  return {
    matchResultId: "demo",
    status: "Success",
    cvId,
    jobDescriptionId: 1,
    title: "Senior Backend Developer",
    overallScore: 78,
    matchLabel: "Moderate Match",
    passProbability: 72,
    breakdown: {
      skills: {
        score: 85,
        matched: ["Node.js", "REST APIs", "Git", "TypeScript"],
        missing: ["Docker", "Redis"],
        detail: "Matched 4 of 6 listed skills.",
      },
      experience: {
        score: 68,
        matched: [],
        missing: ["5 years required"],
        detail: "The CV shows less experience than requested.",
      },
      education: {
        score: 90,
        matched: ["Bachelor"],
        missing: [],
        detail: "The education requirement is supported.",
      },
      soft_skills: {
        score: 62,
        matched: ["Teamwork"],
        missing: ["Communication"],
        detail: "One of two stated soft skills is supported.",
      },
    },
    strengths: ["Skills are strongly supported by CV evidence."],
    weaknesses: [],
    suggestions: ["Add Docker evidence only if accurate."],
    algorithmVersion: "fitcv-deterministic-v1",
    errorMessage: null,
    generatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    disclaimer:
      "This score and screening probability are decision-support estimates, not guarantees or automatic hiring decisions.",
  }
}

export const fitcvApi = {
  async uploadCv(file: File): Promise<CvVersion> {
    if (USE_ANALYZER_FIXTURE) {
      const cvId = ++fixtureCvSequence
      const fixture: CvVersion = {
        cvId,
        fileName: file.name,
        fileType: file.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF",
        fileSizeKb: Math.ceil(file.size / 1024),
        versionNumber: cvId,
        isLatest: true,
        uploadedAt: new Date().toISOString(),
        parseStatus: "Success",
        parserVersion: "fitcv-parser-v1",
        errorMessage: null,
      }
      fixtureCvs.set(cvId, fixture)
      return fixture
    }
    requireAnalyzerBackend()
    const body = new FormData()
    body.append("file", file)
    return normalizeCv(
      await requestJson<BackendCvVersion>("/api/cvs", { method: "POST", body }),
    )
  },

  async listCvs(): Promise<CvVersion[]> {
    if (USE_ANALYZER_FIXTURE) return [...fixtureCvs.values()].reverse()
    requireAnalyzerBackend()
    return (await requestJson<BackendCvVersion[]>("/api/cvs")).map(normalizeCv)
  },

  async getCv(cvId: number): Promise<CvVersion> {
    if (USE_ANALYZER_FIXTURE) {
      const cv = fixtureCvs.get(cvId)
      if (!cv) throw new Error("CV not found.")
      return cv
    }
    requireAnalyzerBackend()
    return normalizeCv(await requestJson<BackendCvVersion>(`/api/cvs/${cvId}`))
  },

  async deleteCv(cvId: number): Promise<void> {
    if (USE_ANALYZER_FIXTURE) {
      fixtureCvs.delete(cvId)
      return
    }
    requireAnalyzerBackend()
    await request(`/api/cvs/${cvId}`, { method: "DELETE" })
  },

  async analyzeCv(analyzeRequest: AnalyzeCvRequest): Promise<MatchAnalysis> {
    if (USE_ANALYZER_FIXTURE) return fixtureMatch(analyzeRequest.cvId)
    requireAnalyzerBackend()
    const payload = await requestJson<BackendMatchAnalysis>(
      "/api/analyzer/matches",
      {
        method: "POST",
        body: JSON.stringify({
          cv_id: analyzeRequest.cvId,
          job_description: analyzeRequest.jobDescription,
          title: analyzeRequest.title ?? "Pasted job description",
        }),
      },
    )
    return normalizeMatch(payload)
  },

  async getMatchResult(matchResultId: string): Promise<MatchAnalysis> {
    if (USE_ANALYZER_FIXTURE)
      return fixtureMatch(Number(fixtureCvSequence || 1))
    requireAnalyzerBackend()
    return normalizeMatch(
      await requestJson<BackendMatchAnalysis>(
        `/api/analyzer/matches/${matchResultId}`,
      ),
    )
  },

  async generateImprovementReport(
    matchResultId: string,
    regenerate = false,
  ): Promise<GenerateImprovementResponse> {
    if (USE_IMPROVEMENT_FIXTURE)
      return { matchResultId, status: "Success", taskId: null }

    const payload = await requestJson<BackendGenerateResponse>(
      `/api/match-results/${matchResultId}/improvement-report/generate?regenerate=${regenerate}`,
      { method: "POST" },
    )

    return {
      matchResultId: String(payload.match_result_id),
      status: payload.status,
      taskId: payload.task_id ? String(payload.task_id) : null,
    }
  },

  async getImprovementReport(
    matchResultId: string,
  ): Promise<ImprovementReportResponse> {
    if (USE_IMPROVEMENT_FIXTURE) return fixtureResponse(matchResultId)

    return normalizeResponse(
      await requestJson<BackendReportResponse>(
        `/api/match-results/${matchResultId}/improvement-report`,
      ),
    )
  },
}
