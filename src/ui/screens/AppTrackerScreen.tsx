import { useEffect, useState } from "react"

import FitCVApplicationTracker from "./FitCVApplicationTracker"

import PersonalApplicationTracker from "./PersonalApplicationTracker"

import "./application-tracker.css"

interface AppTrackerScreenProps {
  focusApplicationId?: number | null
}

type TrackerView = "personal" | "fitcv"

export default function AppTrackerScreen({
  focusApplicationId = null,
}: AppTrackerScreenProps) {
  const [view, setView] = useState<TrackerView>(
    focusApplicationId == null ? "personal" : "fitcv",
  )

  useEffect(() => {
    if (focusApplicationId != null) setView("fitcv")
  }, [focusApplicationId])

  return (
    <div className="app-tracker-screen">
      <div
        className="tracker-view-tabs"
        role="tablist"
        aria-label="Application tracker views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "personal"}
          className="at-tab"
          data-active={view === "personal"}
          onClick={() => setView("personal")}
        >
          Personal tracker
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "fitcv"}
          className="at-tab"
          data-active={view === "fitcv"}
          onClick={() => setView("fitcv")}
        >
          FitCV applications
        </button>
      </div>

      {view === "personal" ? (
        <PersonalApplicationTracker />
      ) : (
        <FitCVApplicationTracker focusApplicationId={focusApplicationId} />
      )}
    </div>
  )
}
