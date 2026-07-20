import { useEffect, useState } from "react"

import FitCVApplicationTracker from "./FitCVApplicationTracker"
import PersonalApplicationTracker from "./PersonalApplicationTracker"

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
    <div>
      <div
        role="tablist"
        aria-label="Application tracker views"
        style={{
          display: "inline-flex",
          gap: 4,
          marginBottom: 20,
          padding: 4,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--surface)",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "personal"}
          className={
            view === "personal" ? "fitcv-btn-primary" : "fitcv-btn-secondary"
          }
          onClick={() => setView("personal")}
        >
          Personal tracker
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "fitcv"}
          className={
            view === "fitcv" ? "fitcv-btn-primary" : "fitcv-btn-secondary"
          }
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
