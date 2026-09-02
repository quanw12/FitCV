import React, { useEffect, useState } from "react"
import { Check, X } from "lucide-react"

import type { ScreenId } from "@/types/app"
import { authApi } from "@/api/authApi"
import { getStoredImprovementMatchResultId } from "@/services/improvementSelection"
import { isOnboardingCompleted, setOnboardingCompleted } from "@/services/onboarding"

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
    screen: "app-tracker",
    label: "App Tracker",
    hint: "Track your job applications and status.",
  },
  {
    screen: "job-search",
    label: "Job Search",
    hint: "Search active job posts and market JDs.",
  },
]

interface SeekerStageStatus {
  hasCv: boolean
  hasAnalysis: boolean
  hasApplications: boolean
}

function readSeekerStatus(): SeekerStageStatus {
  const matchId = getStoredImprovementMatchResultId()
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
    hasCv: true, // Seeker default screen is cv-rebuild; baseline initial CV active
    hasAnalysis: matchId != null,
    hasApplications,
  }
}

function stageDone(index: number, status: SeekerStageStatus): boolean {
  switch (index) {
    case 0:
      return status.hasCv
    case 1:
      return status.hasAnalysis
    case 2:
      return status.hasAnalysis
    case 3:
      return status.hasApplications
    case 4:
      return status.hasAnalysis || status.hasApplications
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
  const [status, setStatus] = useState<SeekerStageStatus>(readSeekerStatus)
  const [isDismissed, setIsDismissed] = useState<boolean>(() =>
    isOnboardingCompleted("seeker", accountId),
  )

  useEffect(() => {
    setIsDismissed(isOnboardingCompleted("seeker", accountId))
  }, [accountId])

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextStatus = readSeekerStatus()
      setStatus(nextStatus)

      if (
        stageDone(0, nextStatus) &&
        stageDone(1, nextStatus) &&
        stageDone(2, nextStatus) &&
        stageDone(3, nextStatus)
      ) {
        setOnboardingCompleted("seeker", accountId, true)
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [currentScreen, accountId])

  if (isDismissed) {
    return null
  }

  const currentIndex = STAGES.findIndex((stage) => stage.screen === currentScreen)

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOnboardingCompleted("seeker", accountId, true)
    setIsDismissed(true)
  }

  return (
    <nav className="hiring-flow" aria-label="Job seeker workflow progress">
      <div className="hiring-flow__track">
        {STAGES.map((stage, index) => {
          const isCurrent = index === currentIndex
          const isDone = stageDone(index, status)

          let state: "done" | "current" | "todo" = "todo"
          if (isCurrent) state = "current"
          else if (isDone) state = "done"

          return (
            <React.Fragment key={stage.screen}>
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
