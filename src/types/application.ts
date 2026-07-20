export const APPLICATION_STATUSES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected",
] as const

export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export interface TrackedApplication {
  applicationId: number
  companyName: string
  positionTitle: string
  appliedOn: string
  source: string
  status: ApplicationStatus
  jobUrl: string | null
  reminderAt: string | null
  lastActivityAt: string
  createdAt: string
  updatedAt: string | null
  noteCount: number
  reminderDue: boolean
  reminderReason: string | null
  daysSinceUpdate: number
}

export interface ApplicationNote {
  noteId: number
  content: string
  createdAt: string
  updatedAt: string | null
}

export interface ApplicationStatusHistory {
  statusHistoryId: number
  previousStatus: ApplicationStatus | null
  newStatus: ApplicationStatus
  changedAt: string
}

export interface ApplicationDetail extends TrackedApplication {
  notes: ApplicationNote[]
  statusHistory: ApplicationStatusHistory[]
}

export interface ApplicationInput {
  companyName: string
  positionTitle: string
  appliedOn: string
  source: string
  status: ApplicationStatus
  jobUrl?: string | null
  reminderAt?: string | null
}

export type ApplicationUpdate = Partial<ApplicationInput>

export interface ApplicationStats {
  total: number
  remindersDue: number
  byStatus: Record<ApplicationStatus, number>
}
