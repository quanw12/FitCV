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
  pdfBase64ToBlob: vi.fn(),
  thumbnailDataUrl: vi.fn(),
}))

vi.mock("@/api/cvRebuildApi", () => apiMocks)

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
    skills: ["Python"],
    projects: [],
    certifications: [],
    education: [],
    languages: [],
    publications: [],
    awards: [],
  },
  pdf_base64: "cGRm",
  thumbnail_base64: "aW1n",
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
      name: /rebuilt cv preview/i,
    })

    expect(apiMocks.thumbnailDataUrl).toHaveBeenCalledWith("aW1n")

    fireEvent.click(thumbnail)

    expect(await screen.findByTitle("Rebuilt CV")).toBeInTheDocument()
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
      await screen.findByRole("img", { name: /rebuilt cv preview/i }),
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
      JSON.stringify({ fileName: "cv.pdf", style: "classic", result: RESULT }),
    )

    render(<CVReBuildScreen />)

    expect(
      await screen.findByRole("img", { name: /rebuilt cv preview/i }),
    ).toBeInTheDocument()
    expect(apiMocks.rebuildCv).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /rebuild another cv/i }))

    expect(screen.getByTestId("cv-rebuild-input")).toBeInTheDocument()
    expect(sessionStorage.getItem("fitcv:rebuild:last-result")).toBeNull()
  })

  it("restores the selected template style from session storage", async () => {
    sessionStorage.setItem(
      "fitcv:rebuild:last-result",
      JSON.stringify({ fileName: "cv.pdf", style: "classic", result: RESULT }),
    )

    render(<CVReBuildScreen />)

    fireEvent.click(screen.getByRole("button", { name: /rebuild another cv/i }))

    expect(
      screen.getByTestId("style-classic").getAttribute("aria-pressed"),
    ).toBe("true")
    expect(
      screen.getByTestId("style-modern").getAttribute("aria-pressed"),
    ).toBe("false")
  })

  it("passes the selected template style to the API", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.click(screen.getByTestId("style-classic"))

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    await screen.findByRole("img", { name: /rebuilt cv preview/i })

    expect(apiMocks.rebuildCv).toHaveBeenCalledWith(expect.any(File), "classic")
  })

  it("saves a successful result to session storage", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile("my_cv.pdf")] },
    })

    await screen.findByRole("img", { name: /rebuilt cv preview/i })

    const saved = sessionStorage.getItem("fitcv:rebuild:last-result")

    expect(saved).not.toBeNull()

    const cached = JSON.parse(saved as string) as {
      fileName: string
      style: string
      result: { pdf_base64: string }
    }

    expect(cached.fileName).toBe("my_cv.pdf")
    expect(cached.style).toBe("modern")
    expect(cached.result.pdf_base64).toBe("cGRm")
  })
})
