import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import HiringFlow from "./HiringFlow"
import SeekerFlow from "./SeekerFlow"
import { isOnboardingCompleted, setOnboardingCompleted } from "@/services/onboarding"

describe("onboarding service", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("stores and reads onboarding completion per portal and account ID", () => {
    expect(isOnboardingCompleted("hr", "user123")).toBe(false)
    setOnboardingCompleted("hr", "user123", true)
    expect(isOnboardingCompleted("hr", "user123")).toBe(true)

    // Different account should still be false
    expect(isOnboardingCompleted("hr", "user456")).toBe(false)

    // Different portal should still be false
    expect(isOnboardingCompleted("seeker", "user123")).toBe(false)
  })
})

describe("HiringFlow component", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("renders HR stepper nodes and dismiss button for new accounts", () => {
    const onNavigate = vi.fn()
    render(<HiringFlow currentScreen="hr-dashboard" onNavigate={onNavigate} accountId="test-hr" />)

    expect(screen.getByText("Job Posts")).toBeInTheDocument()
    expect(screen.getByText("CV Ranking")).toBeInTheDocument()
    expect(screen.getByText("Pipeline")).toBeInTheDocument()
    expect(screen.getByText("Auto Email")).toBeInTheDocument()
    expect(screen.getByText("Reports")).toBeInTheDocument()
  })

  it("hides when dismissed and persists completion state", () => {
    const onNavigate = vi.fn()
    const { container } = render(
      <HiringFlow currentScreen="hr-dashboard" onNavigate={onNavigate} accountId="test-hr" />,
    )

    const dismissBtn = screen.getByTitle("Hide onboarding guide")
    fireEvent.click(dismissBtn)

    expect(container.firstChild).toBeNull()
    expect(isOnboardingCompleted("hr", "test-hr")).toBe(true)
  })
})

describe("SeekerFlow component", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("renders Seeker stepper nodes for new accounts", () => {
    const onNavigate = vi.fn()
    render(<SeekerFlow currentScreen="cv-rebuild" onNavigate={onNavigate} accountId="test-seeker" />)

    expect(screen.getByText("CV Build")).toBeInTheDocument()
    expect(screen.getByText("Match Analyzer")).toBeInTheDocument()
    expect(screen.getByText("Improvement Tips")).toBeInTheDocument()
    expect(screen.getByText("App Tracker")).toBeInTheDocument()
    expect(screen.getByText("Job Search")).toBeInTheDocument()

    const stages = within(
      screen.getByRole("navigation", { name: "Job seeker workflow progress" }),
    ).getAllByRole("button")

    expect(stages[3]).toHaveTextContent("Job Search")
    expect(stages[4]).toHaveTextContent("App Tracker")
  })

  it("hides when dismissed and persists completion state for seeker", () => {
    const onNavigate = vi.fn()
    const { container } = render(
      <SeekerFlow currentScreen="cv-rebuild" onNavigate={onNavigate} accountId="test-seeker" />,
    )

    const dismissBtn = screen.getByTitle("Hide onboarding guide")
    fireEvent.click(dismissBtn)

    expect(container.firstChild).toBeNull()
    expect(isOnboardingCompleted("seeker", "test-seeker")).toBe(true)
  })
})
