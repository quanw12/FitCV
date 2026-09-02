import React, { useEffect, useState } from "react"
import { Check, X } from "lucide-react"

import type { ScreenId } from "@/types/app"
import { authApi } from "@/api/authApi"
import { getStoredImprovementMatchResultId } from "@/services/improvementSelection"
import {
  getCompletedSteps,
  isOnboardingCompleted,
  markStepsCompleted,
  setOnboardingCompleted,
} from "@/services/onboarding"

interface SeekerFlowProps {
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
    screen: "cv-rebuild",
    label: "CV Build",
    hint: "Upload or create your master CV.",
  },
  {
    screen: "analyzer",
    label: "Match Analyzer",
    hint: "Compare your CV against target job descriptions.",
  },
  {
    screen: "improvement",
    label: "Improvement Tips",
    hint: "Apply AI suggestions and fill skill gaps.",
  },
  {
    screen: "job-search",
    label: "Job Search",
    hint: "Search active job posts and market JDs.",
  },
  {
    screen: "app-tracker",
    label: "App Tracker",
    hint: "Track your job applications and status.",
  },
]

interface SeekerStageStatus {
  hasCv: boolean
  hasAnalysis: boolean
  hasApplications: boolean
}

function readSeekerStatus(accountId: string): SeekerStageStatus {
  const matchId = getStoredImprovementMatchResultId(accountId)
  let hasApplications = false

  try {
    const rawTracker = window.localStorage.getItem("fitcv.personal_app_tracker")
    if (rawTracker) {
      const parsed = JSON.parse(rawTracker)
      hasApplications = Array.isArray(parsed) && parsed.length > 0
    }
  } catch {
    hasApplications = false
  }

  return {
    hasCv: true,
    hasAnalysis: matchId != null,
    hasApplications,
  }
}

function stageDone(screen: ScreenId, status: SeekerStageStatus): boolean {
  switch (screen) {
    case "cv-rebuild":
      return status.hasCv
    case "analyzer":
      return status.hasAnalysis
    case "improvement":
      return status.hasAnalysis
    case "job-search":
      return status.hasAnalysis || status.hasApplications
    case "app-tracker":
      return status.hasApplications
    default:
      return false
  }
}

export default function SeekerFlow({
  currentScreen,
  onNavigate,
  accountId: propAccountId,
}: SeekerFlowProps) {
  const accountId = propAccountId || authApi.getSession()?.user.accountId || "guest"
  const [status, setStatus] = useState<SeekerStageStatus>(() =>
    readSeekerStatus(accountId),
  )
  const [completedSteps, setCompletedSteps] = useState<number[]>(() =>
    getCompletedSteps("seeker", accountId),
  )
  const [isDismissed, setIsDismissed] = useState<boolean>(() =>
    isOnboardingCompleted("seeker", accountId),
  )

  const currentIndex = STAGES.findIndex((stage) => stage.screen === currentScreen)

  useEffect(() => {
    setIsDismissed(isOnboardingCompleted("seeker", accountId))
    setCompletedSteps(getCompletedSteps("seeker", accountId))
    setStatus(readSeekerStatus(accountId))
  }, [accountId])

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextStatus = readSeekerStatus(accountId)
      setStatus(nextStatus)

      const newlyDone = STAGES.flatMap((stage, index) =>
        stageDone(stage.screen, nextStatus) ? [index] : [],
      )

      if (currentIndex > 0) {
        for (let index = 0; index < currentIndex; index += 1) {
          newlyDone.push(index)
        }
      }

      if (currentIndex === STAGES.length - 1) {
        newlyDone.push(currentIndex)
      }

      if (newlyDone.length > 0) {
        const updated = markStepsCompleted("seeker", accountId, newlyDone)
        setCompletedSteps(updated)

        if (STAGES.every((_, index) => updated.includes(index))) {
          setOnboardingCompleted("seeker", accountId, true)
          setIsDismissed(true)
        }
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [currentScreen, currentIndex, accountId])

  if (isDismissed) {
    return null
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOnboardingCompleted("seeker", accountId, true)
    setIsDismissed(true)
  }

  const isStepDone = (index: number) => completedSteps.includes(index)

  return (
    <nav className="hiring-flow" aria-label="Job seeker workflow progress">
      <div className="hiring-flow__track">
        {STAGES.map((stage, index) => {
          const isCurrent = index === currentIndex
          const isDone = isStepDone(index) || stageDone(stage.screen, status)

          let state: "done" | "current" | "todo" = "todo"
          if (isCurrent) state = "current"
          else if (isDone) state = "done"

          return (
            <React.Fragment key={stage.screen}>
              {index > 0 && (
                <span
                  className={`hiring-flow__connector ${
                    isStepDone(index - 1) ||
                    stageDone(STAGES[index - 1].screen, status)
                      ? "is-filled"
                      : ""
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
