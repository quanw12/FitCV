import { analyzerApi } from "@/api/analyzerApi"
import { applicationApi } from "@/api/applicationApi"
import { applicationsApi } from "@/api/applicationsApi"
import { cvRankingApi } from "@/api/cvRankingApi"
import { emailWorkflowApi } from "@/api/emailWorkflowApi"
import { jobsApi } from "@/api/jobsApi"
import { jdLibraryApi } from "@/api/jdLibraryApi"
import { pipelineApi } from "@/api/pipelineApi"
import { profileApi } from "@/api/profileApi"
import { reportsApi } from "@/api/reportsApi"
import type { AuthSession } from "@/types/auth"
import type { EmailStage } from "@/types/emailWorkflow"
import {
  getOrFetchResource,
  setCachedResource,
} from "./resourceCache"

const CV_HISTORY_CACHE_KEY = "cv-history:summary"
const JOB_SEARCH_CVS_CACHE_KEY = "job-search:cvs"
const JD_OPPORTUNITIES_CACHE_KEY = "jd-library:opportunities"
const JD_LIBRARY_EMPTY_CACHE_KEY = "jd-library:saved:"
const PERSONAL_TRACKER_CACHE_KEY = "personal-tracker:summary"
const FITCV_APPLICATIONS_CACHE_KEY = "fitcv-applications:list"
const JOB_POSTS_CACHE_KEY = "hr-job-posts:managed"
const RANKING_JOBS_CACHE_KEY = "hr-ranking:jobs"
const PIPELINE_CACHE_KEY = "pipeline:list:all"
const AUTO_EMAIL_CACHE_KEY = "hr-auto-email:workflow"

const pad = (value: number) => String(value).padStart(2, "0")

const dateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const trailing30Days = () => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from: dateInput(from), to: dateInput(to) }
}

const currentMonthRange = () => {
  const now = new Date()
  return {
    from: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

const hrDashboardCacheKey = (range: { from: string; to: string }) =>
  `hr-dashboard:summary:${range.from}:${range.to}`

const hrReportsCacheKey = (range: { from: string; to: string }) =>
  `hr-reports:summary:${range.from}:${range.to}`

const rankingHistoryCacheKey =
  "hr-ranking:history:::::"

const autoEmailAudienceCacheKey = (
  stage: EmailStage,
  templateKey: string,
) => `hr-auto-email:audience:${stage}:all:${templateKey}`

const stageTemplates: Record<EmailStage, string> = {
  Applied: "confirmation",
  Screening: "shortlist",
  Interview: "interview",
  Offer: "offer_discussion",
  Hired: "onboarding_welcome",
  Rejected: "rejection",
}

type SeekerCvHistorySnapshot = Awaited<
  ReturnType<typeof prefetchSeekerCvHistory>
>

async function prefetchSeekerCvHistory() {
  const [cvs, comparisons] = await Promise.all([
    analyzerApi.listCvs(),
    analyzerApi.listCvComparisons(),
  ])

  return { cvs, comparisons }
}

export async function prefetchAuthenticatedResources(
  session: AuthSession,
): Promise<void> {
  if (!session.user.role) return

  const tasks: Promise<unknown>[] = [profileApi.get()]

  if (session.user.role === "Student") {
    const cvHistory = getOrFetchResource<SeekerCvHistorySnapshot>(
      CV_HISTORY_CACHE_KEY,
      prefetchSeekerCvHistory,
    )
    tasks.push(
      cvHistory.then((snapshot) => {
        setCachedResource(JOB_SEARCH_CVS_CACHE_KEY, snapshot.cvs)
        return snapshot
      }),
    )

    const opportunities = getOrFetchResource(
      JD_OPPORTUNITIES_CACHE_KEY,
      async () => {
        const [jobs, applications] = await Promise.all([
          jobsApi.listPublic(),
          applicationsApi.listMine(),
        ])
        return { jobs, applications }
      },
    )
    tasks.push(
      opportunities.then((snapshot) => {
        setCachedResource(FITCV_APPLICATIONS_CACHE_KEY, snapshot.applications)
        return snapshot
      }),
    )

    tasks.push(
      getOrFetchResource(JD_LIBRARY_EMPTY_CACHE_KEY, async () => {
        const [items, insights] = await Promise.all([
          jdLibraryApi.list(),
          jdLibraryApi.getInsights(),
        ])
        return { items, insights }
      }),
    )

    tasks.push(
      getOrFetchResource(PERSONAL_TRACKER_CACHE_KEY, async () => {
        const [applications, stats] = await Promise.all([
          applicationApi.list(),
          applicationApi.stats(),
        ])
        return { applications, stats }
      }),
    )

    await Promise.allSettled(tasks)
    return
  }

  const managedJobs = getOrFetchResource(JOB_POSTS_CACHE_KEY, async () => {
    const [active, archived] = await Promise.all([
      jobsApi.listManaged(false),
      jobsApi.listManaged(true),
    ])
    return { active, archived }
  })
  tasks.push(
    managedJobs.then((snapshot) => {
      setCachedResource(RANKING_JOBS_CACHE_KEY, snapshot.active)
      return snapshot
    }),
  )

  const pipeline = getOrFetchResource(PIPELINE_CACHE_KEY, async () => {
    const [applications, jobs] = await Promise.all([
      pipelineApi.list(),
      jobsApi.listManaged(false),
    ])
    return { applications, jobs }
  })
  tasks.push(pipeline)

  const autoEmail = getOrFetchResource(AUTO_EMAIL_CACHE_KEY, async () => {
    const [templates, pipelineSnapshot, drafts] = await Promise.all([
      emailWorkflowApi.listTemplates(),
      pipeline,
      emailWorkflowApi.listDrafts(),
    ])
    return {
      templates,
      applications: pipelineSnapshot.applications,
      drafts,
    }
  })
  tasks.push(autoEmail)

  const dashboardRange = trailing30Days()
  tasks.push(
    getOrFetchResource(
      hrDashboardCacheKey(dashboardRange),
      () => reportsApi.summary(dashboardRange),
    ),
  )

  const reportsRange = currentMonthRange()
  tasks.push(
    getOrFetchResource(
      hrReportsCacheKey(reportsRange),
      () => reportsApi.summary(reportsRange),
    ),
  )

  tasks.push(
    getOrFetchResource(rankingHistoryCacheKey, () => cvRankingApi.listBatches()),
  )

  tasks.push(
    managedJobs.then((snapshot) => {
      const firstJobId = snapshot.active[0]?.job_id
      if (firstJobId == null) return null

      return getOrFetchResource(
        `hr-ranking:applications:${firstJobId}`,
        () => cvRankingApi.listApplications(firstJobId),
      )
    }),
  )

  tasks.push(
    autoEmail.then((snapshot) => {
      const firstStage =
        snapshot.templates[0]?.default_stage ??
        (snapshot.applications[0]?.current_stage as EmailStage | undefined) ??
        "Applied"
      const templateKey =
        snapshot.templates.find((template) => template.key === stageTemplates[firstStage])
          ?.key ?? snapshot.templates[0]?.key

      if (!templateKey) return null

      return getOrFetchResource(
        autoEmailAudienceCacheKey(firstStage, templateKey),
        () => emailWorkflowApi.listAudience(firstStage, undefined, templateKey),
      )
    }),
  )

  await Promise.allSettled(tasks)
}
