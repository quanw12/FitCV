import type {
  ApplicationDetail,
  ApplicationInput,
  ApplicationNote,
  ApplicationStats,
  ApplicationStatus,
  ApplicationUpdate,
  TrackedApplication,
} from "@/types/application"

import { requestJson } from "./httpClient"

interface BackendApplication {
  application_id: number
  company_name: string
  position_title: string
  applied_on: string
  source: string
  status: ApplicationStatus
  job_url: string | null
  reminder_at: string | null
  last_activity_at: string
  created_at: string
  updated_at: string | null
  note_count: number
  reminder_due: boolean
  reminder_reason: string | null
  days_since_update: number
}

interface BackendApplicationNote {
  note_id: number
  content: string
  created_at: string
  updated_at: string | null
}

interface BackendStatusHistory {
  status_history_id: number
  previous_status: ApplicationStatus | null
  new_status: ApplicationStatus
  changed_at: string
}

interface BackendApplicationDetail extends BackendApplication {
  notes: BackendApplicationNote[]
  status_history: BackendStatusHistory[]
}

interface BackendStats {
  total: number
  reminders_due: number
  by_status: Record<ApplicationStatus, number>
}

function utcDateTime(value: string | null): string | null {
  if (!value || /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value
  return `${value}Z`
}

function normalizeApplication(payload: BackendApplication): TrackedApplication {
  return {
    applicationId: payload.application_id,
    companyName: payload.company_name,
    positionTitle: payload.position_title,
    appliedOn: payload.applied_on,
    source: payload.source,
    status: payload.status,
    jobUrl: payload.job_url,
    reminderAt: utcDateTime(payload.reminder_at),
    lastActivityAt: utcDateTime(payload.last_activity_at)!,
    createdAt: utcDateTime(payload.created_at)!,
    updatedAt: utcDateTime(payload.updated_at),
    noteCount: payload.note_count,
    reminderDue: payload.reminder_due,
    reminderReason: payload.reminder_reason,
    daysSinceUpdate: payload.days_since_update,
  }
}

function normalizeNote(payload: BackendApplicationNote): ApplicationNote {
  return {
    noteId: payload.note_id,
    content: payload.content,
    createdAt: utcDateTime(payload.created_at)!,
    updatedAt: utcDateTime(payload.updated_at),
  }
}

function normalizeDetail(payload: BackendApplicationDetail): ApplicationDetail {
  return {
    ...normalizeApplication(payload),
    notes: payload.notes.map(normalizeNote),
    statusHistory: payload.status_history.map((item) => ({
      statusHistoryId: item.status_history_id,
      previousStatus: item.previous_status,
      newStatus: item.new_status,
      changedAt: utcDateTime(item.changed_at)!,
    })),
  }
}

function toBackendPayload(payload: ApplicationUpdate) {
  return {
    company_name: payload.companyName,
    position_title: payload.positionTitle,
    applied_on: payload.appliedOn,
    source: payload.source,
    status: payload.status,
    job_url: payload.jobUrl,
    reminder_at: payload.reminderAt,
  }
}

export const applicationApi = {
  async list(): Promise<TrackedApplication[]> {
    const payload = await requestJson<BackendApplication[]>(
      "/api/applications",
      {
        authenticated: true,
      },
    )
    return payload.map(normalizeApplication)
  },

  async stats(): Promise<ApplicationStats> {
    const payload = await requestJson<BackendStats>("/api/applications/stats", {
      authenticated: true,
    })
    return {
      total: payload.total,
      remindersDue: payload.reminders_due,
      byStatus: payload.by_status,
    }
  },

  async get(applicationId: number): Promise<ApplicationDetail> {
    const payload = await requestJson<BackendApplicationDetail>(
      `/api/applications/${applicationId}`,
      { authenticated: true },
    )
    return normalizeDetail(payload)
  },

  async create(payload: ApplicationInput): Promise<ApplicationDetail> {
    const response = await requestJson<BackendApplicationDetail>(
      "/api/applications",
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify(toBackendPayload(payload)),
      },
    )
    return normalizeDetail(response)
  },

  async update(
    applicationId: number,
    payload: ApplicationUpdate,
  ): Promise<ApplicationDetail> {
    const response = await requestJson<BackendApplicationDetail>(
      `/api/applications/${applicationId}`,
      {
        method: "PATCH",
        authenticated: true,
        body: JSON.stringify(toBackendPayload(payload)),
      },
    )
    return normalizeDetail(response)
  },

  delete(applicationId: number): Promise<void> {
    return requestJson(`/api/applications/${applicationId}`, {
      method: "DELETE",
      authenticated: true,
    })
  },

  async addNote(
    applicationId: number,
    content: string,
  ): Promise<ApplicationNote> {
    const payload = await requestJson<BackendApplicationNote>(
      `/api/applications/${applicationId}/notes`,
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ content }),
      },
    )
    return normalizeNote(payload)
  },

  deleteNote(applicationId: number, noteId: number): Promise<void> {
    return requestJson(`/api/applications/${applicationId}/notes/${noteId}`, {
      method: "DELETE",
      authenticated: true,
    })
  },
}
