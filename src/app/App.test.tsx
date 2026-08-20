import type { ReactNode } from "react"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ScreenId } from "@/types/app"

import type { AuthSession } from "@/types/auth"

import type { UserProfile } from "@/types/profile"

import { improvementMatchStorageKey } from "@/services/improvementSelection"

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),

  logout: vi.fn(),

  refresh: vi.fn(),

  initializeActivity: vi.fn(),

  startActivityMonitoring: vi.fn(() => vi.fn()),

  onSessionExpired: vi.fn(),
}))

const profileMocks = vi.hoisted(() => ({
  get: vi.fn(),
  clearCache: vi.fn(),
}))

const prefetchMocks = vi.hoisted(() => ({
  prefetchAuthenticatedResources: vi.fn(),
}))

vi.mock("@/api", () => ({ authApi: authMocks }))

vi.mock("@/api/profileApi", () => ({ profileApi: profileMocks }))

vi.mock("@/services/authenticatedPrefetch", () => prefetchMocks)

interface LayoutProps {
  children: ReactNode

  onNavigate: (screenId: ScreenId) => void

  onLogout: () => void
}

vi.mock("@/ui/components/Layout", () => ({
  default: ({ children, onNavigate, onLogout }: LayoutProps) => (
    <div>
      <button onClick={() => onNavigate("analyzer")}>Open Analyzer</button>
      <button onClick={() => onNavigate("improvement")}>
        Open Improvement
      </button>
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
      <button onClick={() => onAnalysisComplete?.("42")}>
        Complete analysis
      </button>
      <button onClick={() => onAnalysisInvalidated?.()}>
        Invalidate analysis
      </button>
    </div>
  ),
}))

vi.mock("@/ui/screens/ImprovementScreen", () => ({
  default: ({ matchResultId }: { matchResultId?: string | null }) => (
    <div>Selected match: {matchResultId ?? "none"}</div>
  ),
}))

vi.mock("@/ui/screens/CVReBuildScreen", () => ({
  default: () => <div>CV rebuild screen</div>,
}))

vi.mock("@/ui/screens/ProfileScreen", () => ({
  default: () => <div>Company profile onboarding</div>,
}))

vi.mock("@/ui/screens/PublicJobScreen", () => ({
  default: ({ jobId }: { jobId: number }) => <div>Public job {jobId}</div>,
}))

interface LandingMockProps {
  onGetStarted: () => void
  onSignIn?: () => void
}

vi.mock("@/ui/screens/LandingScreen", () => ({
  default: ({ onGetStarted, onSignIn = onGetStarted }: LandingMockProps) => (
    <div>
      <button onClick={onGetStarted}>Get started</button>
      <button onClick={onSignIn}>Sign in</button>
    </div>
  ),
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

const hrSession: AuthSession = {
  accessToken: "hr-token",

  tokenType: "bearer",

  user: {
    accountId: "hr-account",

    email: "hr@example.com",

    fullName: "HR User",

    role: "HR",

    authProvider: "Google",
  },

  requiresRoleSelection: false,
}

const incompleteHrProfile: UserProfile = {
  accountId: "hr-account",
  email: "hr@example.com",
  fullName: "HR User",
  role: "HR",
  avatarUrl: null,
  authProvider: "Google",
  createdAt: "2026-08-19T00:00:00Z",
  updatedAt: null,
  phone: null,
  company: null,
}

const completeHrProfile: UserProfile = {
  ...incompleteHrProfile,
  company: {
    companyId: "12",
    companyName: "Northwind Labs",
    industryId: "3",
    industryName: "Technology",
    websiteUrl: null,
    logoUrl: null,
  },
}

interface AuthMockProps {
  onAuth: (session: AuthSession) => void
  initialMode?: "login" | "register"
}

vi.mock("@/ui/screens/AuthScreen", () => ({
  default: ({ onAuth, initialMode = "login" }: AuthMockProps) => (
    <div>
      <span>Auth mode: {initialMode}</span>
      <button onClick={() => onAuth(secondarySession)}>
        Sign in second account
      </button>
    </div>
  ),
}))

import App from "./App"

describe("Analyzer to Improvement selection", () => {
  let expireSession: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()

    expireSession = undefined

    window.history.replaceState({}, "", "/")

    authMocks.getSession.mockReturnValue(primarySession)

    authMocks.refresh.mockResolvedValue(primarySession)

    profileMocks.get.mockResolvedValue(incompleteHrProfile)

    prefetchMocks.prefetchAuthenticatedResources.mockResolvedValue(undefined)

    authMocks.onSessionExpired.mockImplementation((listener: () => void) => {
      expireSession = listener

      return vi.fn()
    })
  })

  it("opens a shared public job before the authentication gate", async () => {
    window.history.replaceState({}, "", "/?job=91")

    authMocks.getSession.mockReturnValue(null)

    render(<App />)

    expect(await screen.findByText("Public job 91")).toBeInTheDocument()

    expect(
      screen.queryByRole("button", { name: "Sign in second account" }),
    ).not.toBeInTheDocument()
  })

  it("renders the authenticated screen immediately without a route loader", () => {
    render(<App />)

    expect(screen.getByText("CV rebuild screen")).toBeInTheDocument()
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
  })

  it("hydrates the selected match for the current account after a same-tab reload", async () => {
    window.sessionStorage.setItem(
      improvementMatchStorageKey(primarySession.user.accountId),

      "37",
    )

    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))

    expect(await screen.findByText("Selected match: 37")).toBeInTheDocument()
  })

  it("restores the session from the refresh cookie when tab storage is empty", async () => {
    authMocks.getSession.mockReturnValue(null)

    render(<App />)

    expect(await screen.findByText("CV rebuild screen")).toBeInTheDocument()

    expect(authMocks.refresh).toHaveBeenCalledOnce()
  })

  it("does not prefetch company-scoped HR data before onboarding is complete", async () => {
    authMocks.getSession.mockReturnValue(hrSession)
    authMocks.refresh.mockResolvedValue(hrSession)
    profileMocks.get.mockResolvedValue(incompleteHrProfile)

    render(<App />)

    expect(
      await screen.findByText("Company profile onboarding"),
    ).toBeInTheDocument()
    expect(profileMocks.get).toHaveBeenCalledOnce()
    expect(
      prefetchMocks.prefetchAuthenticatedResources,
    ).not.toHaveBeenCalled()
  })

  it("prefetches HR data after the linked company profile is complete", async () => {
    authMocks.getSession.mockReturnValue(hrSession)
    authMocks.refresh.mockResolvedValue(hrSession)
    profileMocks.get.mockResolvedValue(completeHrProfile)

    render(<App />)

    await waitFor(() =>
      expect(prefetchMocks.prefetchAuthenticatedResources).toHaveBeenCalledWith(
        hrSession,
      ),
    )
  })

  it("opens create account mode from Landing Get started", async () => {
    authMocks.getSession.mockReturnValue(null)
    authMocks.refresh.mockRejectedValueOnce(new Error("No session"))

    render(<App />)

    fireEvent.click(await screen.findByRole("button", { name: "Get started" }))

    expect(await screen.findByText("Auth mode: register")).toBeInTheDocument()
  })

  it("opens sign in mode from Landing Sign in", async () => {
    authMocks.getSession.mockReturnValue(null)
    authMocks.refresh.mockRejectedValueOnce(new Error("No session"))

    render(<App />)

    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("Auth mode: login")).toBeInTheDocument()
  })

  it("passes a completed analysis ID to Improvement and clears it when inputs change", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Open Analyzer" }))

    fireEvent.click(
      await screen.findByRole("button", { name: "Complete analysis" }),
    )

    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(primarySession.user.accountId),
      ),
    ).toBe("42")

    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))

    expect(await screen.findByText("Selected match: 42")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Open Analyzer" }))

    fireEvent.click(
      await screen.findByRole("button", { name: "Invalidate analysis" }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))

    expect(await screen.findByText("Selected match: none")).toBeInTheDocument()

    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(primarySession.user.accountId),
      ),
    ).toBeNull()
  })

  it("clears selections on logout and account switch", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "Get started" }))

    fireEvent.click(
      await screen.findByRole("button", { name: "Sign in second account" }),
    )

    expect(
      window.sessionStorage.getItem(
        improvementMatchStorageKey(secondarySession.user.accountId),
      ),
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Open Improvement" }))

    expect(await screen.findByText("Selected match: none")).toBeInTheDocument()
  })

  it("returns an automatically expired session to Landing without logout", async () => {
    render(<App />)

    expect(await screen.findByText("CV rebuild screen")).toBeInTheDocument()

    act(() => expireSession?.())

    expect(
      await screen.findByRole("button", { name: "Get started" }),
    ).toBeInTheDocument()

    expect(authMocks.logout).not.toHaveBeenCalled()
  })
})
