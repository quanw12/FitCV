import { afterEach, describe, expect, it, vi } from "vitest"

import { buildCv, pdfBase64ToBlob, rebuildCv, thumbnailDataUrl } from "./cvRebuildApi"

const fetchMock = vi.fn()

vi.stubGlobal("fetch", fetchMock)

describe("cvRebuildApi helpers", () => {
  it("converts pdf base64 to a PDF blob", () => {
    const blob = pdfBase64ToBlob("JVBERi0x")
    expect(blob.type).toBe("application/pdf")
    expect(blob.size).toBe(6)
  })

  it("builds a jpeg data url from thumbnail base64", () => {
    expect(thumbnailDataUrl("AAAA")).toBe("data:image/jpeg;base64,AAAA")
  })

  it("sends a job description with a rebuilt file", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          filename: "rebuilt_cv.pdf",
          preview_json: {},
          pdf_base64: "cGRm",
          thumbnail_base64: "dGh1bWI=",
          warnings: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )

    await rebuildCv(new File(["pdf"], "cv.pdf"), undefined, "Python role")

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const form = request.body as FormData
    expect(form.get("jd_text")).toBe("Python role")
  })

  it("maps jdText to the backend jd_text field for a form build", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          filename: "built_cv.pdf",
          preview_json: {},
          pdf_base64: "cGRm",
          thumbnail_base64: "dGh1bWI=",
          warnings: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )

    await buildCv({
      cv: { name: "A", email: "", phone: "", links: [], summary: "", experience: [], core_competencies: [], skills: [], skill_groups: [], projects: [], certifications: [], education: [], languages: [], publications: [], awards: [] },
      language: "en",
      jdText: "Python role",
    })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(request.body as string)).toMatchObject({ jd_text: "Python role" })
  })
})

afterEach(() => {
  fetchMock.mockReset()
})
