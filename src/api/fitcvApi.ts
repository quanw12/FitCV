import type { AsyncStatus } from '@/types/app'

export interface AnalyzeCvRequest {
  cvId: string
  jobDescription: string
}

export interface AnalyzeCvResponse {
  matchResultId: string
  status: AsyncStatus
}

export const fitcvApi = {
  async analyzeCv(_request: AnalyzeCvRequest): Promise<AnalyzeCvResponse> {
    throw new Error('FitCV API client is not connected yet.')
  },
}
