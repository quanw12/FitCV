import type { CvRebuildData, CvRebuildResponse } from "@/types/cvRebuild"

import { API_BASE_URL } from "./config"
import { requestJson } from "./httpClient"

export interface CvBuildPayload {
  cv: CvRebuildData

  language: "en" | "vi"

  avatar?: string

  jdText?: string
}

export function rebuildCv(
  file: File,
  avatar?: string,
  jdText?: string,
): Promise<CvRebuildResponse> {
  const form = new FormData()

  form.append("file", file)

  if (avatar) form.append("avatar", avatar)

  if (jdText) form.append("jd_text", jdText)

  return requestJson<CvRebuildResponse>("/api/cv/rebuild", {
    method: "POST",
    body: form,
    authenticated: true,
  })
}

export function buildCv(payload: CvBuildPayload): Promise<CvRebuildResponse> {
  return requestJson<CvRebuildResponse>("/api/cv/build", {
    method: "POST",
    body: JSON.stringify({
      cv: payload.cv,
      language: payload.language,
      avatar: payload.avatar,
      jd_text: payload.jdText,
    }),
    authenticated: true,
  })
}

export async function profileAvatarDataUrl(
  avatarUrl: string | null | undefined,
): Promise<string | null> {
  if (!avatarUrl) return null

  if (avatarUrl.startsWith("data:image/")) return avatarUrl

  const absoluteUrl = avatarUrl.startsWith("http")
    ? avatarUrl
    : `${API_BASE_URL}${avatarUrl}`

  try {
    const response = await fetch(absoluteUrl)

    if (!response.ok) return null

    const blob = await response.blob()

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()

      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null)

      reader.onerror = () => resolve(null)

      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
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
