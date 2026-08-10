import { lazy, Suspense, useEffect, useState } from "react"

import { AnimatePresence } from "framer-motion"

import { toast } from "sonner"

import { authApi, profileApi } from "@/api"

import {
  clearStoredImprovementMatchResultId,
  getStoredImprovementMatchResultId,
  storeImprovementMatchResultId,
} from "@/services/improvementSelection"

import { isCompanyProfileComplete, requiresCompanyProfile } from "@/services"

import type { AnalyzerDraftState } from "@/types/analyzer"

import type { CvRebuildResponse } from "@/types/cvRebuild"

import type { Portal, ScreenId } from "@/types/app"

import { portalFromAccountRole, type AuthSession } from "@/types/auth"

import FullPageSkeleton from "@/ui/components/FullPageSkeleton"

import Layout from "@/ui/components/Layout"

import ToastProvider from "@/ui/components/ToastProvider"

import AuthScreen from "@/ui/screens/AuthScreen"

import LandingScreen from "@/ui/screens/LandingScreen"

const CVReBuildScreen = lazy(() => import("@/ui/screens/CVReBuildScreen"))

const AnalyzerScreen = lazy(() => import("@/ui/screens/AnalyzerScreen"))

const ImprovementScreen = lazy(() => import("@/ui/screens/ImprovementScreen"))

const CVHistoryScreen = lazy(() => import("@/ui/screens/CVHistoryScreen"))

const AppTrackerScreen = lazy(() => import("@/ui/screens/AppTrackerScreen"))

const JDLibraryScreen = lazy(() => import("@/ui/screens/JDLibraryScreen"))

const JobSearchScreen = lazy(() => import("@/ui/screens/JobSearchScreen"))

const HRDashboard = lazy(() => import("@/ui/screens/HRDashboard"))

const JobPostsScreen = lazy(() => import("@/ui/screens/JobPostsScreen"))

const CVRankingScreen = lazy(() => import("@/ui/screens/CVRankingScreen"))

const PipelineScreen = lazy(() => import("@/ui/screens/PipelineScreen"))

const AutoEmailScreen = lazy(() => import("@/ui/screens/AutoEmailScreen"))

const ReportsScreen = lazy(() => import("@/ui/screens/ReportsScreen"))

const ProfileScreen = lazy(() => import("@/ui/screens/ProfileScreen"))

const PublicJobScreen = lazy(() => import("@/ui/screens/PublicJobScreen"))

type CompanyProfileGate = "checking" | "required" | "complete"

function defaultScreen(portal: Portal) {
  return portal === "seeker" ? "cv-rebuild" : "hr-dashboard"
}

function emptyAnalyzerDraft(): AnalyzerDraftState {
  return { cvFile: null, uploadedCvId: null, jdText: "", result: null }
}

export default function App() {
  const [publicJobId, setPublicJobId] = useState<number | null>(() => {
    const rawJobId = new URLSearchParams(window.location.search).get("job")

    if (!rawJobId) return null

    const parsed = Number(rawJobId)

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  })

  const [session, setSession] = useState<AuthSession | null>(() =>
    authApi.getSession(),
  )

  const [authReady, setAuthReady] = useState(() => Boolean(authApi.getSession()))

  const [screen, setScreen] = useState<ScreenId | "">(() => {
    const currentSession = authApi.getSession()

    return currentSession?.user.role
      ? defaultScreen(portalFromAccountRole(currentSession.user.role))
      : ""
  })

  const [improvementMatchResultId, setImprovementMatchResultId] =
    useState<string | null>(() => {
      const currentSession = authApi.getSession()

      return currentSession
        ? getStoredImprovementMatchResultId(currentSession.user.accountId)
        : null
    })

  const [analyzerDraft, setAnalyzerDraft] =
    useState<AnalyzerDraftState>(emptyAnalyzerDraft)

  const [rebuiltFromImprovement, setRebuiltFromImprovement] =
    useState<CvRebuildResponse | null>(null)

  const [trackerFocusApplicationId, setTrackerFocusApplicationId] =
    useState<number | null>(null)

  const [showLanding, setShowLanding] = useState(() => !authApi.getSession())

  const [companyProfileGate, setCompanyProfileGate] =
    useState<CompanyProfileGate>("checking")

  const portal = session?.user.role
    ? portalFromAccountRole(session.user.role)
    : null

  useEffect(() => {
    if (session || publicJobId) {
      setAuthReady(true)
      return
    }

    setAuthReady(true)

    let active = true
    authApi
      .refresh()
      .then((restored) => {
        if (!active) return
        setSession(restored)
        setShowLanding(false)
        if (restored.user.role) {
          setScreen(defaultScreen(portalFromAccountRole(restored.user.role)))
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [publicJobId])

  useEffect(() => {
    let active = true

    const role = session?.user.role ?? null

    if (!session || !requiresCompanyProfile(role)) {
      setCompanyProfileGate("complete")

      return () => {
        active = false
      }
    }

    setCompanyProfileGate("checking")

    profileApi

      .get()

      .then((profile) => {
        if (active) {
          setCompanyProfileGate(
            isCompanyProfileComplete(profile) ? "complete" : "required",
          )
        }
      })

      .catch(() => {
        if (active) setCompanyProfileGate("required")
      })

    return () => {
      active = false
    }
  }, [session?.accessToken, session?.user.role])

  const handleAuth = (nextSession: AuthSession) => {
    if (session) clearStoredImprovementMatchResultId(session.user.accountId)

    clearStoredImprovementMatchResultId(nextSession.user.accountId)

    setShowLanding(false)

    setSession(nextSession)

    setCompanyProfileGate("checking")

    setAnalyzerDraft(emptyAnalyzerDraft())

    setRebuiltFromImprovement(null)

    setImprovementMatchResultId(null)

    setTrackerFocusApplicationId(null)

    toast.success(`Welcome, ${nextSession.user.fullName}`)

    if (nextSession.user.role) {
      setScreen(defaultScreen(portalFromAccountRole(nextSession.user.role)))
    }
  }

  const handleLogout = async () => {
    if (session) clearStoredImprovementMatchResultId(session.user.accountId)

    try {
      await authApi.logout()
    } catch {
      // Local sign-out still completes when the backend is unavailable.
    }

    toast("Signed out successfully")

    setSession(null)

    setShowLanding(true)

    setCompanyProfileGate("complete")

    setScreen("")

    setAnalyzerDraft(emptyAnalyzerDraft())

    setRebuiltFromImprovement(null)

    setImprovementMatchResultId(null)

    setTrackerFocusApplicationId(null)
  }

  const handleNavigate = (nextScreen: ScreenId) => {
    if (nextScreen !== "app-tracker") setTrackerFocusApplicationId(null)

    setScreen(nextScreen)
  }

  const handleViewTracking = (applicationId: number) => {
    setTrackerFocusApplicationId(applicationId)

    setScreen("app-tracker")
  }

  const handleUseJd = (title: string, text: string) => {
    setAnalyzerDraft((current) => ({ ...current, jdText: text, result: null }))

    setScreen("analyzer")

    toast.success(`Loaded “${title}” into Match Analyzer`)
  }

  const handleAnalyzeBuiltCv = (file: File, jdText?: string) => {
    setAnalyzerDraft({
      cvFile: file,
      uploadedCvId: null,
      jdText: jdText ?? "",
      result: null,
    })

    clearImprovementSelection()

    setScreen("analyzer")
  }

  const clearImprovementSelection = () => {
    if (session) clearStoredImprovementMatchResultId(session.user.accountId)

    setImprovementMatchResultId(null)
  }

  const selectImprovementMatch = (matchResultId: string) => {
    if (!session) return

    storeImprovementMatchResultId(session.user.accountId, matchResultId)

    setImprovementMatchResultId(matchResultId)
  }

  if (publicJobId) {
    return (
      <>
        <ToastProvider />
        <Suspense fallback={<FullPageSkeleton />}>
          <PublicJobScreen
            jobId={publicJobId}
            onBack={() => {
              const nextUrl = new URL(window.location.href)

              nextUrl.searchParams.delete("job")

              window.history.replaceState({}, "", nextUrl)

              setPublicJobId(null)
            }}
          />
        </Suspense>
      </>
    )
  }

  if (!authReady) return <FullPageSkeleton />

  if (showLanding && !session) {
    return <LandingScreen onGetStarted={() => setShowLanding(false)} />
  }

  if (!session || session.requiresRoleSelection || !portal) {
    return (
      <AuthScreen
        onAuth={handleAuth}
        startInRoleSelection={Boolean(session?.requiresRoleSelection)}
        onBackToLanding={() => setShowLanding(true)}
      />
    )
  }

  if (requiresCompanyProfile(session.user.role)) {
    if (companyProfileGate === "checking") {
      return (
        <div
          style={{
            minHeight: "100vh",

            display: "grid",

            placeItems: "center",

            background: "var(--bg)",

            color: "var(--text-secondary)",
          }}
        >
          Checking company profile...
        </div>
      )
    }

    if (companyProfileGate === "required") {
      return (
        <div
          data-portal="hr"
          style={{ minHeight: "100vh", background: "var(--bg)" }}
        >
          <header
            style={{
              minHeight: 64,

              padding: "0 24px",

              display: "flex",

              alignItems: "center",

              justifyContent: "space-between",

              borderBottom: "1px solid var(--border)",

              background: "white",
            }}
          >
            <strong style={{ color: "var(--text-primary)", fontSize: 20 }}>
              FitCV
            </strong>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                border: "1px solid var(--border)",

                background: "white",

                borderRadius: 8,

                padding: "8px 12px",

                color: "var(--text-secondary)",

                cursor: "pointer",

                fontWeight: 600,
              }}
            >
              Sign out
            </button>
          </header>
          <main style={{ padding: "28px 20px 48px" }}>
            <Suspense fallback={<FullPageSkeleton />}>
              <ProfileScreen
                session={session}
                onSessionChange={setSession}
                companyOnboarding
                onProfileSaved={(profile) => {
                  if (isCompanyProfileComplete(profile)) {
                    setCompanyProfileGate("complete")
                  }
                }}
              />
            </Suspense>
          </main>
        </div>
      )
    }
  }

  const renderScreen = () => {
    switch (screen) {
      case "cv-rebuild":
        return (
          <CVReBuildScreen
            onNavigate={handleNavigate}
            onAnalyzeCv={handleAnalyzeBuiltCv}
            incomingResult={rebuiltFromImprovement}
            onIncomingResultConsumed={() => setRebuiltFromImprovement(null)}
          />
        )

      case "analyzer":
        return (
          <AnalyzerScreen
            draft={analyzerDraft}
            setDraft={setAnalyzerDraft}
            onAnalysisComplete={selectImprovementMatch}
            onAnalysisInvalidated={clearImprovementSelection}
            onViewSuggestions={() => setScreen("improvement")}
          />
        )

      case "improvement":
        return (
          <ImprovementScreen
            matchResultId={improvementMatchResultId}
            onRebuilt={(result) => {
              setRebuiltFromImprovement(result)
              setScreen("cv-rebuild")
            }}
          />
        )

      case "cv-history":
        return <CVHistoryScreen />

      case "app-tracker":
        return (
          <AppTrackerScreen focusApplicationId={trackerFocusApplicationId} />
        )

      case "jd-library":
        return (
          <JDLibraryScreen
            onViewTracking={handleViewTracking}
            onUseJd={handleUseJd}
          />
        )

      case "job-search":
        return <JobSearchScreen />

      case "profile":
        return <ProfileScreen session={session} onSessionChange={setSession} />

      case "hr-dashboard":
        return <HRDashboard onNavigate={handleNavigate} />

      case "job-posts":
        return <JobPostsScreen />

      case "cv-ranking":
        return <CVRankingScreen />

      case "pipeline":
        return <PipelineScreen />

      case "auto-email":
        return <AutoEmailScreen />

      case "reports":
        return <ReportsScreen />

      case "hr-settings":
        return <ProfileScreen session={session} onSessionChange={setSession} />

      default:
        return portal === "seeker" ? (
          <CVReBuildScreen
            onNavigate={handleNavigate}
            onAnalyzeCv={handleAnalyzeBuiltCv}
            incomingResult={rebuiltFromImprovement}
            onIncomingResultConsumed={() => setRebuiltFromImprovement(null)}
          />
        ) : (
          <HRDashboard onNavigate={handleNavigate} />
        )
    }
  }

  return (
    <>
      <ToastProvider />
      <Layout
        portal={portal}
        currentScreen={screen}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        userName={session.user.fullName}
        userAvatarUrl={session.user.avatarUrl}
      >
        <AnimatePresence mode="wait">
          <Suspense fallback={<FullPageSkeleton />}>
            <div key={screen}>{renderScreen()}</div>
          </Suspense>
        </AnimatePresence>
      </Layout>
    </>
  )
}
