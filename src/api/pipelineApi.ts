import { requestJson } from "./httpClient"
import type {
  PipelineApplication,
  PipelineNote,
  PipelineStage,
  PipelineStageHistory,
} from "@/types/pipeline"

export const pipelineApi = {
  list: (jobId?: number) =>
    requestJson<PipelineApplication[]>(
      `/api/hr/pipeline${jobId ? `?job_id=${jobId}` : ""}`,
      { authenticated: true },
    ),
  moveStage: (applicationId: number, stage: PipelineStage) =>
    requestJson<PipelineApplication>(
      `/api/hr/pipeline/applications/${applicationId}/stage`,
      {
        authenticated: true,
        method: "PATCH",
        body: JSON.stringify({ stage }),
      },
    ),
  listNotes: (applicationId: number) =>
    requestJson<PipelineNote[]>(
      `/api/hr/pipeline/applications/${applicationId}/notes`,
      { authenticated: true },
    ),
  addNote: (applicationId: number, content: string) =>
    requestJson<PipelineNote>(
      `/api/hr/pipeline/applications/${applicationId}/notes`,
      {
        authenticated: true,
        method: "POST",
        body: JSON.stringify({ content }),
      },
    ),
  listHistory: (applicationId: number) =>
    requestJson<PipelineStageHistory[]>(
      `/api/hr/pipeline/applications/${applicationId}/history`,
      { authenticated: true },
    ),
}
