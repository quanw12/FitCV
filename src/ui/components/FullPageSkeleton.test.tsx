import { render, screen } from "@testing-library/react"

import { describe, expect, it } from "vitest"

import FullPageSkeleton, {
  ContentAreaLoader,
} from "./FullPageSkeleton"

describe("ContentAreaLoader", () => {
  it("renders a minimal authorization-gate loader without fake page content", () => {
    const { container } = render(<ContentAreaLoader />)

    // Must have an aria-live region for accessibility.
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy()

    // Must NOT render skeleton blocks that mimic a page hero (title/description/cards).
    const skeletons = container.querySelectorAll(".fc-skeleton")
    expect(skeletons.length).toBe(0)
  })

  it("renders Loading text for screen readers", () => {
    render(<ContentAreaLoader />)

    expect(screen.getByText(/Loading/)).toBeInTheDocument()
  })
})

describe("FullPageSkeleton", () => {
  it("renders a fake hero with skeleton blocks (for pre-auth only)", () => {
    const { container } = render(<FullPageSkeleton />)

    // FullPageSkeleton intentionally renders skeleton blocks that look like a
    // full page — this is acceptable only before auth/session is known.
    const skeletons = container.querySelectorAll(".fc-skeleton")
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
