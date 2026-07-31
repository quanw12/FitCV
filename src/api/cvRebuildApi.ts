import type { CvRebuildResponse, CvTemplateStyle } from "@/types/cvRebuild"

import { requestJson } from "./httpClient"

export function rebuildCv(
  file: File,
  style: CvTemplateStyle = "modern",
): Promise<CvRebuildResponse> {
  const form = new FormData()

  form.append("file", file)

  form.append("style", style)

  return requestJson<CvRebuildResponse>("/api/cv/rebuild", {
    method: "POST",
    body: form,
    authenticated: true,
  })
}

export function pdfBase64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64)

  const byteNumbers = new Array<number>(byteCharacters.length)

  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteNumbers[index] = byteCharacters.charCodeAt(index)
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" })
}

export function thumbnailDataUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`
}
