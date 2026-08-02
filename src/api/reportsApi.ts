import type { ReportSummary } from "@/types/reports"

import { requestJson } from "./httpClient"

export const reportsApi = {
  summary: (params: { from?: string; to?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.from) query.set("from", params.from)
    if (params.to) query.set("to", params.to)
    const qs = query.toString()
    return requestJson<ReportSummary>(
      `/api/hr/reports/summary${qs ? `?${qs}` : ""}`,
      { authenticated: true },
    )
  },
}
