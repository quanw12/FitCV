import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ScreenId } from "@/types/app"
import type { AuthSession } from "@/types/auth"
import { improvementMatchStorageKey } from "@/services/improvementSelection"

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  logout: vi.fn(),
}))

vi.mock("@/api", () => ({ authApi: authMocks }))

interface LayoutProps {
  children: ReactNode
  onNavigate: (screenId: ScreenId) => void
  onLogout: () => void
}

vi.mock("@/ui/components/Layout", () => ({
  default: ({ children, onNavigate, onLogout }: LayoutProps) => (
    <div>
      <button onClick={() => onNavigate("analyzer")}>Open Analyzer</button>
      <button onClick={() => onNavigate("improvement")}>Open Improvement</button>
      <button onClick={onLogout}>Log out</button>
      {children}
    </div>
  ),
}))

interface AnalyzerProps {
  onAnalysisComplete?: (matchResultId: string) => void
  onAnalysisInvalidated?: () => void
}

vi.mock("@/ui/screens/AnalyzerScreen", () => ({
  default: ({ onAnalysisComplete, onAnalysisInvalidated }: AnalyzerProps) => (
    <div>
      <span>Analyzer mock</span>
      <button onClick={() => onAnalysisComplete?.("42")}>Complete analysis</button>
      <button onClick={() => onAnalysisInvalidated?.()}>Invalidate analysis</button>
    </div>
  ),
}))

vi.mock("@/ui/screens/ImprovementScreen", () => ({
  default: ({ matchResultId }: { matchResultId?: string | null }) => (
    <div>Selected match: {matchResultId ?? "none"}</div>
  ),
}))

vi.mock("@/ui/screens/SeekerDashboard", () => ({
  default: () => <div>Seeker dashboard</div>,
}))

const primarySession: AuthSession = {
  accessToken: "primary-token",
  tokenType: "bearer",
  user: {
    accountId: "account-1",
    email: "student-one@example.com",
    fullName: "Student One",
    role: "Student",
    authProvider: "Password",
  },
  requiresRoleSelection: false,
}

const secondarySession: AuthSession = {
  accessToken: "secondary-token",
  tokenType: "bearer",
  user: {
    accountId: "account-2",
    email: "student-two@example.com",
    fullName: "Student Two",
    role: "Student",
    authProvider: "Password",
  },
  requiresRoleSelection: false,
}

vi.mock("@/ui/screens/AuthScreen", () => ({
  default: ({ onAuth }: { onAuth: (session: AuthSession) => void }) => (
    <button onClick={() => onAuth(secondarySession)}>Sign in second account</button>
  ),
}))

import App from "./App"

describe("Analyzer to Improvement selection", () => {
  beforeEach(() => {
    authMocks.getSession.mockReturnValue(primarySession)
  })

  it("hydrates the selected match for the current account after a same-tab reload", () => {
    window.sessionStorage.setItem(
      improvementMatchStorageKey(primarySession.user.accountId),
      "37",
    )

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))

    expect(screen.getByText("Selected match: 37")).toBeInTheDocument()
  })

  it("passes a completed analysis ID to Improvement and clears it when inputs change", () => {
    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Open Analyzer" }))
    fireEvent.click(screen.getByRole("button", { name: "Complete analysis" }))

    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(primarySession.user.accountId),
      ),
    ).toBe("42")

    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))
    expect(screen.getByText("Selected match: 42")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Open Analyzer" }))
    fireEvent.click(screen.getByRole("button", { name: "Invalidate analysis" }))
    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))

    expect(screen.getByText("Selected match: none")).toBeInTheDocument()
    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(primarySession.user.accountId),
      ),
    ).toBeNull()
  })

  it("clears selections on logout and account switch", () => {
    window.sessionStorage.setItem(
      improvementMatchStorageKey(primarySession.user.accountId),
      "42",
    )
    window.sessionStorage.setItem(
      improvementMatchStorageKey(secondarySession.user.accountId),
      "84",
    )

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Log out" }))
    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(primarySession.user.accountId),
      ),
    ).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: "Sign in second account" }),
    )
    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(secondarySession.user.accountId),
      ),
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))
    expect(screen.getByText("Selected match: none")).toBeInTheDocument()
  })
})
