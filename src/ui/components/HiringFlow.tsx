import React, { useEffect, useState } from "react"
import { Check, X } from "lucide-react"

import type { ScreenId } from "@/types/app"
import { authApi } from "@/api/authApi"
import { getCachedResource } from "@/services/resourceCache"
import {
  getCompletedSteps,
  isOnboardingCompleted,
  markStepsCompleted,
  setOnboardingCompleted,
} from "@/services/onboarding"

interface HiringFlowProps {
  currentScreen: ScreenId | ""
  onNavigate: (screen: ScreenId) => void
  accountId?: string
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

export default function HiringFlow({
  currentScreen,
  onNavigate,
  accountId: propAccountId,
}: HiringFlowProps) {
  const accountId = propAccountId || authApi.getSession()?.user.accountId || "guest"
  const [status, setStatus] = useState<StageStatus>(readStatus)
  const [completedSteps, setCompletedSteps] = useState<number[]>(() =>
    getCompletedSteps("hr", accountId),
  )
  const [isDismissed, setIsDismissed] = useState<boolean>(() =>
    isOnboardingCompleted("hr", accountId),
  )

  const currentIndex = STAGES.findIndex((stage) => stage.screen === currentScreen)

  useEffect(() => {
    setIsDismissed(isOnboardingCompleted("hr", accountId))
    setCompletedSteps(getCompletedSteps("hr", accountId))
  }, [accountId])

  useEffect(() => {
    const nextStatus = readStatus()
    setStatus(nextStatus)

    const newlyDone: number[] = []
    if (nextStatus.jobs > 0) newlyDone.push(0)
    if (nextStatus.rankingBatches > 0) newlyDone.push(1)
    if (nextStatus.pipelineApplications > 0) {
      newlyDone.push(1)
      newlyDone.push(2)
    }
    if (nextStatus.emailDrafts > 0) newlyDone.push(3)

    if (currentIndex > 0) {
      for (let i = 0; i < currentIndex; i++) {
        newlyDone.push(i)
      }
    }

    if (currentIndex === 4) {
      newlyDone.push(4)
    }

    if (newlyDone.length > 0) {
      const updated = markStepsCompleted("hr", accountId, newlyDone)
      setCompletedSteps(updated)

      if ([0, 1, 2, 3, 4].every((idx) => updated.includes(idx))) {
        setOnboardingCompleted("hr", accountId, true)
        setIsDismissed(true)
      }
    }
  }, [currentScreen, currentIndex, accountId])

  if (isDismissed) {
    return null
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOnboardingCompleted("hr", accountId, true)
    setIsDismissed(true)
  }

  const isStepDone = (index: number) => completedSteps.includes(index)

  return (
    <nav className="hiring-flow" aria-label="Hiring workflow progress">
      <div className="hiring-flow__track">
        {STAGES.map((stage, index) => {
          const isCurrent = index === currentIndex
          const isDone = isStepDone(index)
          const meta = stageMeta(index, status)

          let state: "done" | "current" | "todo" = "todo"
          if (isCurrent) state = "current"
          else if (isDone) state = "done"

          return (
            <React.Fragment key={stage.screen}>
              {index > 0 && (
                <span
                  className={`hiring-flow__connector ${
                    isStepDone(index - 1) ? "is-filled" : ""
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
            </React.Fragment>
          )
        })}

        <button
          type="button"
          className="hiring-flow__dismiss"
          onClick={handleDismiss}
          title="Hide onboarding guide"
          aria-label="Hide onboarding guide"
        >
          <X size={14} />
        </button>
      </div>
    </nav>
  )
}
