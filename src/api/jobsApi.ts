import type {
  JobApplicationCreated,
  JobApplicationWrite,
  JobExtraction,
  JobPost,
  JobWrite,
} from "@/types/jobs"
import { requestJson } from "./httpClient"

export const jobsApi = {
  listPublic: () => requestJson<JobPost[]>("/api/jobs/public"),
  getPublic: (jobId: number) =>
    requestJson<JobPost>(`/api/jobs/public/${jobId}`),
  extract: (jdText: string) =>
    requestJson<JobExtraction>("/api/jobs/extract", {
      authenticated: true,
      method: "POST",
      body: JSON.stringify({ jd_text: jdText }),
    }),
  listManaged: (archived = false) =>
    requestJson<JobPost[]>(`/api/jobs/manage?archived=${archived}`, {
      authenticated: true,
    }),
  create: (payload: JobWrite) =>
    requestJson<JobPost>("/api/jobs", {
      authenticated: true,
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (jobId: number, payload: Partial<JobWrite>) =>
    requestJson<JobPost>(`/api/jobs/${jobId}`, {
      authenticated: true,
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  publish: (jobId: number) =>
    requestJson<JobPost>(`/api/jobs/${jobId}/publish`, {
      authenticated: true,
      method: "POST",
    }),
  close: (jobId: number) =>
    requestJson<JobPost>(`/api/jobs/${jobId}/close`, {
      authenticated: true,
      method: "POST",
    }),
  archive: (jobId: number) =>
    requestJson<JobPost>(`/api/jobs/${jobId}/archive`, {
      authenticated: true,
      method: "POST",
    }),
  unarchive: (jobId: number) =>
    requestJson<JobPost>(`/api/jobs/${jobId}/unarchive`, {
      authenticated: true,
      method: "POST",
    }),
  apply: (jobId: number, payload: JobApplicationWrite) => {
    const formData = new FormData()
    formData.append("full_name", payload.fullName)
    formData.append("email", payload.email)
    formData.append("phone", payload.phone)
    formData.append("file", payload.file)
    return requestJson<JobApplicationCreated>(`/api/jobs/${jobId}/apply`, {
      authenticated: true,
      method: "POST",
      body: formData,
    })
  },
}
