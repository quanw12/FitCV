import { useEffect, useState } from "react"

import { Check } from "lucide-react"

import type { ScreenId } from "@/types/app"

import { getCachedResource } from "@/services/resourceCache"

interface HiringFlowProps {
  currentScreen: ScreenId | ""
  onNavigate: (screen: ScreenId) => void
}

interface StageDef {
  screen: ScreenId
  label: string
  hint: string
}

const STAGES: StageDef[] = [
  {
    screen: "job-posts",
    label: "Job Posts",
    hint: "Publish the roles you are hiring for.",
  },
  {
    screen: "cv-ranking",
    label: "CV Ranking",
    hint: "Score applicants or external CVs against the JD.",
  },
  {
    screen: "pipeline",
    label: "Pipeline",
    hint: "Move shortlisted candidates through hiring stages.",
  },
  {
    screen: "auto-email",
    label: "Auto Email",
    hint: "Send stage-aware emails to candidates.",
  },
  {
    screen: "reports",
    label: "Reports",
    hint: "Review hiring performance over time.",
  },
]

interface StageStatus {
  jobs: number
  rankingBatches: number
  pipelineApplications: number
  emailDrafts: number
}

function readStatus(): StageStatus {
  const managed = getCachedResource<{ active?: unknown[]; archived?: unknown[] }>(
    "hr-job-posts:managed",
  )
  const ranking = getCachedResource<unknown[]>("hr-ranking:history:::::")
  const pipeline = getCachedResource<{ applications?: unknown[] }>(
    "pipeline:list:all",
  )
  const autoEmail = getCachedResource<{ drafts?: unknown[] }>(
    "hr-auto-email:workflow",
  )

  return {
    jobs: (managed?.active?.length ?? 0) + (managed?.archived?.length ?? 0),
    rankingBatches: ranking?.length ?? 0,
    pipelineApplications: pipeline?.applications?.length ?? 0,
    emailDrafts: autoEmail?.drafts?.length ?? 0,
  }
}

function stageDone(index: number, status: StageStatus): boolean {
  switch (index) {
    case 0:
      return status.jobs > 0
    case 1:
      return status.rankingBatches > 0 || status.pipelineApplications > 0
    case 2:
      return status.pipelineApplications > 0
    case 3:
      return status.emailDrafts > 0
    case 4:
      return status.rankingBatches > 0 || status.pipelineApplications > 0
    default:
      return false
  }
}

function stageMeta(index: number, status: StageStatus): string {
  switch (index) {
    case 0:
      return status.jobs > 0 ? `${status.jobs} job${status.jobs > 1 ? "s" : ""}` : ""
    case 1:
      return status.rankingBatches > 0
        ? `${status.rankingBatches} batch${status.rankingBatches > 1 ? "es" : ""}`
        : ""
    case 2:
      return status.pipelineApplications > 0
        ? `${status.pipelineApplications} in pipeline`
        : ""
    case 3:
      return status.emailDrafts > 0
        ? `${status.emailDrafts} draft${status.emailDrafts > 1 ? "s" : ""}`
        : ""
    default:
      return ""
  }
}

export default function HiringFlow({ currentScreen, onNavigate }: HiringFlowProps) {
  const [status, setStatus] = useState<StageStatus>(readStatus)

  useEffect(() => {
    // Prefetch resolves shortly after login; re-read once so the stepper
    // reflects real progress instead of an all-empty first paint.
    const timer = setTimeout(() => setStatus(readStatus()), 1200)

    return () => clearTimeout(timer)
  }, [currentScreen])

  const currentIndex = STAGES.findIndex((stage) => stage.screen === currentScreen)

  return (
    <nav className="hiring-flow" aria-label="Hiring workflow progress">
      <div className="hiring-flow__track">
        {STAGES.map((stage, index) => {
          const isCurrent = index === currentIndex
          const isDone = stageDone(index, status)
          const meta = stageMeta(index, status)

          let state: "done" | "current" | "todo" = "todo"
          if (isCurrent) state = "current"
          else if (isDone) state = "done"

          return (
            <div className="hiring-flow__step" key={stage.screen}>
              {index > 0 && (
                <span
                  className={`hiring-flow__connector ${
                    stageDone(index - 1, status) ? "is-filled" : ""
                  }`}
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                className={`hiring-flow__node hiring-flow__node--${state}`}
                onClick={() => onNavigate(stage.screen)}
                aria-current={isCurrent ? "step" : undefined}
                title={stage.hint}
              >
                <span className="hiring-flow__marker">
                  {state === "done" ? (
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hiring-flow__labels">
                  <span className="hiring-flow__label">{stage.label}</span>
                  {meta && <span className="hiring-flow__meta">{meta}</span>}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
