import { describe, expect, it } from "vitest"

import { pdfBase64ToBlob, thumbnailDataUrl } from "./cvRebuildApi"

describe("cvRebuildApi helpers", () => {
  it("converts pdf base64 to a PDF blob", () => {
    const blob = pdfBase64ToBlob("JVBERi0x")
    expect(blob.type).toBe("application/pdf")
    expect(blob.size).toBe(6)
  })

  it("builds a jpeg data url from thumbnail base64", () => {
    expect(thumbnailDataUrl("AAAA")).toBe("data:image/jpeg;base64,AAAA")
  })
})
