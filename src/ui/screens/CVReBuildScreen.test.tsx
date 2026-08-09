import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  rebuildCv: vi.fn(),
  buildCv: vi.fn(),
  profileAvatarDataUrl: vi.fn(async () => "data:image/png;base64,QUFB"),
  pdfBase64ToBlob: vi.fn(),
  thumbnailDataUrl: vi.fn(),
  uploadCv: vi.fn(),
}))

vi.mock("@/api/cvRebuildApi", () => apiMocks)

vi.mock("@/api/analyzerApi", () => ({
  analyzerApi: { uploadCv: apiMocks.uploadCv },
}))

import ToastProvider from "@/ui/components/ToastProvider"

import CVReBuildScreen from "./CVReBuildScreen"

function makeFile(name = "cv.pdf", type = "application/pdf"): File {
  return new File(["%PDF-1.4"], name, { type })
}

const RESULT = {
  filename: "rebuilt_cv.pdf",
  preview_json: {
    name: "Nguyen Van A",
    email: "a@example.com",
    phone: "",
    links: [],
    summary: "Backend engineer.",
    experience: [],
    core_competencies: [],
    skills: ["Python"],
    skill_groups: [],
    projects: [],
    certifications: [],
    education: [],
    languages: [],
    publications: [],
    awards: [],
  },
  pdf_base64: "cGRm",
  thumbnail_base64: "aW1n",
  warnings: [],
}

describe("CVReBuildScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    apiMocks.pdfBase64ToBlob.mockReturnValue(
      new Blob(["pdf"], { type: "application/pdf" }),
    )
    apiMocks.thumbnailDataUrl.mockImplementation(
      (base64: string) => `data:image/jpeg;base64,${base64}`,
    )
    apiMocks.uploadCv.mockResolvedValue({
      cvId: 5,
      fileName: "rebuilt_cv.pdf",
      fileType: "PDF",
      fileSizeKb: 4,
      versionNumber: 2,
      isLatest: true,
      uploadedAt: "2026-07-25T10:00:00Z",
      parseStatus: "Pending",
      parserVersion: "1.0",
      errorMessage: null,
    })
  })

  it("shows a skeleton while the pipeline is processing", async () => {
    apiMocks.rebuildCv.mockImplementation(() => new Promise(() => {}))

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    expect(await screen.findByText(/rebuilding/i)).toBeInTheDocument()
  })

  it("renders a thumbnail card and opens a PDF modal on click", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    const thumbnail = await screen.findByRole("img", {
      name: /built cv preview/i,
    })

    expect(apiMocks.thumbnailDataUrl).toHaveBeenCalledWith("aW1n")

    fireEvent.click(thumbnail)

    expect(await screen.findByTitle("Built CV")).toBeInTheDocument()
  })

  it("downloads from cached base64 without calling the API again", async () => {
    const createObjectURL = vi.fn(() => "blob:mock")
    const revokeObjectURL = vi.fn()
    const anchorClick = vi.fn()

    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    })

    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    })

    HTMLAnchorElement.prototype.click = anchorClick

    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    fireEvent.click(
      await screen.findByRole("img", { name: /built cv preview/i }),
    )

    const dialog = await screen.findByRole("dialog")

    fireEvent.click(
      within(dialog).getByRole("button", { name: /download pdf/i }),
    )

    await waitFor(() => {
      expect(apiMocks.pdfBase64ToBlob).toHaveBeenCalledWith("cGRm")
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(anchorClick).toHaveBeenCalledTimes(1)
      expect(apiMocks.rebuildCv).toHaveBeenCalledTimes(1)
    })
  })

  it("rejects invalid file types with an error toast", async () => {
    render(
      <>
        <ToastProvider />
        <CVReBuildScreen />
      </>,
    )

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: {
        files: [
          new File(["x"], "cv.exe", { type: "application/octet-stream" }),
        ],
      },
    })

    expect(await screen.findByText(/only pdf and docx/i)).toBeInTheDocument()
    expect(apiMocks.rebuildCv).not.toHaveBeenCalled()
  })

  it("shows the API error message on failure", async () => {
    apiMocks.rebuildCv.mockRejectedValue(
      new Error("Gemini is busy. Try again later."),
    )

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    expect(await screen.findByText(/gemini is busy/i)).toBeInTheDocument()
  })

  it("restores the last result from session storage without rebuilding", async () => {
    sessionStorage.setItem(
      "fitcv:rebuild:last-result",
      JSON.stringify({ fileName: "cv.pdf", result: RESULT }),
    )

    render(<CVReBuildScreen />)

    expect(
      await screen.findByRole("img", { name: /built cv preview/i }),
    ).toBeInTheDocument()
    expect(apiMocks.rebuildCv).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /create another cv/i }))

    expect(screen.getByTestId("cv-rebuild-input")).toBeInTheDocument()
    expect(sessionStorage.getItem("fitcv:rebuild:last-result")).toBeNull()
  })

  it("saves a successful result to session storage", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile("my_cv.pdf")] },
    })

    await screen.findByRole("img", { name: /built cv preview/i })

    const saved = sessionStorage.getItem("fitcv:rebuild:last-result")

    expect(saved).not.toBeNull()

    const cached = JSON.parse(saved as string) as {
      fileName: string
      result: { pdf_base64: string }
    }

    expect(cached.fileName).toBe("my_cv.pdf")
    expect(cached.result.pdf_base64).toBe("cGRm")
  })

  it("saves the built PDF to CV history when Save to History is clicked", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(
      <>
        <ToastProvider />
        <CVReBuildScreen />
      </>,
    )

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    await screen.findByRole("img", { name: /built cv preview/i })

    fireEvent.click(
      screen.getByRole("button", { name: /save to history/i }),
    )

    await waitFor(() => {
      expect(apiMocks.pdfBase64ToBlob).toHaveBeenCalledWith("cGRm")
      expect(apiMocks.uploadCv).toHaveBeenCalledTimes(1)
    })

    const uploaded = apiMocks.uploadCv.mock.calls[0][0] as File
    expect(uploaded.name).toBe("rebuilt_cv.pdf")
    expect(uploaded.type).toBe("application/pdf")
    expect(await screen.findByText(/saved to cv history/i)).toBeInTheDocument()
  })

  it("passes the rebuilt PDF to Match Analyzer when requested", async () => {
    const onAnalyzeCv = vi.fn()
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen onAnalyzeCv={onAnalyzeCv} />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    fireEvent.click(
      await screen.findByRole("button", { name: /analyze against a job/i }),
    )

    expect(apiMocks.pdfBase64ToBlob).toHaveBeenCalledWith("cGRm")
    expect(onAnalyzeCv).toHaveBeenCalledTimes(1)
    const file = onAnalyzeCv.mock.calls[0][0] as File
    expect(file.name).toBe("rebuilt_cv.pdf")
    expect(file.type).toBe("application/pdf")
  })

  it("shows an error toast when saving to history fails", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)
    apiMocks.uploadCv.mockRejectedValue(new Error("CV files must be 10 MB or smaller."))

    render(
      <>
        <ToastProvider />
        <CVReBuildScreen />
      </>,
    )

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    await screen.findByRole("img", { name: /built cv preview/i })

    fireEvent.click(
      screen.getByRole("button", { name: /save to history/i }),
    )

    expect(
      await screen.findByText(/cv files must be 10 mb or smaller/i),
    ).toBeInTheDocument()
  })

  it("switches to the build form and submits the entered data to the API", async () => {
    apiMocks.buildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.click(screen.getByRole("tab", { name: /build from form/i }))

    fireEvent.change(screen.getByTestId("cv-build-name"), {
      target: { value: "Tran Thi B" },
    })

    fireEvent.change(screen.getByTestId("cv-build-summary"), {
      target: { value: "Backend engineer aiming for security roles." },
    })

    fireEvent.change(screen.getByTestId("cv-build-skills"), {
      target: { value: "Python, FastAPI, Docker" },
    })

    fireEvent.change(screen.getByTestId("cv-build-language"), {
      target: { value: "vi" },
    })

    fireEvent.click(screen.getByTestId("cv-build-submit"))

    expect(await screen.findByRole("img", { name: /built cv preview/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(apiMocks.buildCv).toHaveBeenCalledTimes(1)

      const payload = apiMocks.buildCv.mock.calls[0][0]

      expect(payload.cv.name).toBe("Tran Thi B")
      expect(payload.cv.summary).toBe("Backend engineer aiming for security roles.")
      expect(payload.cv.skills).toEqual(["Python", "FastAPI", "Docker"])
      expect(payload.language).toBe("vi")
      expect(payload.avatar).toBeUndefined()
    })
  })

  it("requires a name before submitting the build form", async () => {
    render(<CVReBuildScreen />)

    fireEvent.click(screen.getByRole("tab", { name: /build from form/i }))

    fireEvent.click(screen.getByTestId("cv-build-submit"))

    expect(apiMocks.buildCv).not.toHaveBeenCalled()
    expect(screen.getByTestId("cv-build-name")).toBeInTheDocument()
  })

  it("shows the build API error message on failure", async () => {
    apiMocks.buildCv.mockRejectedValue(new Error("Gemini timed out."))

    render(<CVReBuildScreen />)

    fireEvent.click(screen.getByRole("tab", { name: /build from form/i }))

    fireEvent.change(screen.getByTestId("cv-build-name"), {
      target: { value: "Tran Thi B" },
    })

    fireEvent.click(screen.getByTestId("cv-build-submit"))

    expect(await screen.findByText(/gemini timed out/i)).toBeInTheDocument()
  })

  it("does not show a warnings banner when warnings are empty", async () => {
    apiMocks.rebuildCv.mockResolvedValue({ ...RESULT, warnings: [] })

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    await screen.findByRole("img", { name: /built cv preview/i })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows a warnings banner with content when warnings are present", async () => {
    apiMocks.rebuildCv.mockResolvedValue({
      ...RESULT,
      warnings: ["The generated CV has 2 pages.", "Avatar could not be processed."],
    })

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/some content may need your review/i)
    expect(alert).toHaveTextContent("The generated CV has 2 pages.")
    expect(alert).toHaveTextContent("Avatar could not be processed.")
  })
})
