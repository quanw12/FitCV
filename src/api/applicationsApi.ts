import type {
  RetryApplicationAnalysisResponse,
  StudentApplication,
} from "@/types/applications"

import { requestJson } from "./httpClient"

export const applicationsApi = {
  listMine: () =>
    requestJson<StudentApplication[]>("/api/applications/mine", {
      authenticated: true,
    }),
  retryAnalysis: (applicationId: number) =>
    requestJson<RetryApplicationAnalysisResponse>(
      `/api/applications/${applicationId}/retry-analysis`,
      {
        method: "POST",
        authenticated: true,
      },
    ),
}
