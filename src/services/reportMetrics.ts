import { getScoreTone } from "@/services/matchScore"

export interface ReportDateWindow {
  from: string
  to: string
}

export type DeltaDirection = "up" | "down" | "flat" | "unknown"

export interface DeltaSummary {
  text: string
  direction: DeltaDirection
  color: string
}

const pad = (n: number) => String(n).padStart(2, "0")

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const trailingDaysWindow = (days = 30): ReportDateWindow => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - (days - 1))
  return { from: toDateInput(from), to: toDateInput(to) }
}

export const monthWindow = (year: number, month: number): ReportDateWindow => ({
  from: toDateInput(new Date(year, month, 1)),
  to: toDateInput(new Date(year, month + 1, 0)),
})

const sameYear = (a: Date, b: Date) => a.getFullYear() === b.getFullYear()

/**
 * Human range such as "Jul 3 – Aug 1" (or "Jul 3 – Aug 1, 2026" when
 * the window crosses years). Inputs are ISO `yyyy-mm-dd` strings.
 */
export const formatWindowRange = ({ from, to }: ReportDateWindow) => {
  const fromParts = from.split("-").map(Number)
  const toParts = to.split("-").map(Number)
  const fromDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2])
  const toDate = new Date(toParts[0], toParts[1] - 1, toParts[2])
  const format = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    })
  return `${format(fromDate, !sameYear(fromDate, toDate))} – ${format(toDate, true)}`
}

export const formatScore = (score: number | null | undefined) =>
  score == null ? "—" : `${Math.round(score)}%`

export const formatDays = (days: number | null | undefined) =>
  days == null ? "—" : `${days} ${days === 1 ? "day" : "days"}`

export interface ComparePeriodsOptions {
  suffix?: string
  lowerIsBetter?: boolean
}

/**
 * Compare a KPI against the previous window. Direction-aware: a delta is
 * colored good/bad by whether the change actually helps, not by the card
 * accent. `lowerIsBetter` flips the interpretation for cycle-time metrics.
 */
export const comparePeriods = (
  current: number | null | undefined,
  prev: number | null | undefined,
  options: ComparePeriodsOptions = {},
): DeltaSummary => {
  const { suffix = "", lowerIsBetter = false } = options

  if (current == null) {
    return {
      text: "No data yet",
      direction: "unknown",
      color: "var(--text-muted)",
    }
  }
  if (prev == null) {
    return {
      text: "No prior period to compare",
      direction: "unknown",
      color: "var(--text-muted)",
    }
  }

  const diff = Math.round((current - prev) * 10) / 10

  if (diff === 0) {
    return {
      text: "Unchanged vs prev. period",
      direction: "flat",
      color: "var(--text-muted)",
    }
  }

  const improved = lowerIsBetter ? diff < 0 : diff > 0
  const sign = diff > 0 ? "+" : ""

  return {
    text: `${sign}${diff}${suffix} vs prev. period`,
    direction: diff > 0 ? "up" : "down",
    color: improved ? "var(--success)" : "var(--danger)",
  }
}

/** Color for an average match score using the documented 80/50 bands. */
export const avgScoreColor = (score: number | null | undefined) =>
  score == null ? "var(--text-muted)" : getScoreTone(score).color

/**
 * Color for a score-distribution bucket label (e.g. "80-89%", "<50%")
 * mapped onto the same Strong / Moderate / Weak bands. The literal band
 * colors stay blue for Moderate even on the amber HR portal.
 */
export const scoreBucketColor = (rangeLabel: string) => {
  if (rangeLabel.trim().startsWith("<")) return getScoreTone(0).color
  const lowerBound = Number(rangeLabel.match(/\d+/)?.[0] ?? 0)
  return getScoreTone(lowerBound).color
}

/**
 * CVs still awaiting review for a job, derived from its review progress.
 * Returns 0 when progress is unknown (no applications to review).
 */
export const pendingReviewCount = (
  cvCount: number,
  progress: number | null | undefined,
) => {
  if (progress == null || cvCount <= 0) return 0
  return Math.max(0, Math.round(cvCount * (1 - progress / 100)))
}
