export type Portal = "seeker" | "hr"

export type SeekerScreenId = "cv-rebuild" | "analyzer" | "improvement" | "cv-history" | "app-tracker" | "jd-library" | "linkedin-jobs" | "profile"

export type HrScreenId = "hr-dashboard" | "job-posts" | "cv-ranking" | "pipeline" | "auto-email" | "reports" | "hr-settings"

export type ScreenId = SeekerScreenId | HrScreenId

export type MatchLabel = "Strong Match" | "Moderate Match" | "Weak Match"

export type AsyncStatus = "Pending" | "Processing" | "Success" | "Failed"
