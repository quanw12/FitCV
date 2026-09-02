import { lazy, Suspense, useEffect, useState } from "react"

import { AnimatePresence } from "framer-motion"

import { toast } from "sonner"

import { authApi } from "@/api"

import { profileApi } from "@/api/profileApi"

import {
  clearStoredImprovementMatchResultId,
  getStoredImprovementMatchResultId,
  storeImprovementMatchResultId,
} from "@/services/improvementSelection"

import { isCompanyProfileComplete, requiresCompanyProfile } from "@/services"

import { clearResourceCache } from "@/services/resourceCache"

import { prefetchAuthenticatedResources } from "@/services/authenticatedPrefetch"

import type { AnalyzerDraftState } from "@/types/analyzer"

import type { CvRebuildResponse } from "@/types/cvRebuild"

import type { Portal, ScreenId } from "@/types/app"

import { portalFromAccountRole, type AuthSession } from "@/types/auth"

import FullPageSkeleton, {
  ContentAreaLoader,
} from "@/ui/components/FullPageSkeleton"

import Layout from "@/ui/components/Layout"

import ToastProvider from "@/ui/components/ToastProvider"

import AuthScreen from "@/ui/screens/AuthScreen"

import AnalyzerScreen from "@/ui/screens/AnalyzerScreen"

import AppTrackerScreen from "@/ui/screens/AppTrackerScreen"

import AutoEmailScreen from "@/ui/screens/AutoEmailScreen"

import CVHistoryScreen from "@/ui/screens/CVHistoryScreen"

import CVRankingScreen from "@/ui/screens/CVRankingScreen"

import CVReBuildScreen from "@/ui/screens/CVReBuildScreen"

import HRDashboard from "@/ui/screens/HRDashboard"

import ImprovementScreen from "@/ui/screens/ImprovementScreen"

import JDLibraryScreen from "@/ui/screens/JDLibraryScreen"

import JobPostsScreen from "@/ui/screens/JobPostsScreen"

import JobSearchScreen from "@/ui/screens/JobSearchScreen"

import PipelineScreen from "@/ui/screens/PipelineScreen"

import ProfileScreen from "@/ui/screens/ProfileScreen"

import ReportsScreen from "@/ui/screens/ReportsScreen"

const LandingScreen = lazy(() => import("@/ui/screens/LandingScreen"))

const PublicJobScreen = lazy(() => import("@/ui/screens/PublicJobScreen"))

type CompanyProfileGate = "checking" | "required" | "complete"
type AuthEntryMode = "login" | "register"

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

  const [authReady, setAuthReady] = useState(true)

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
  const [authEntryMode, setAuthEntryMode] = useState<AuthEntryMode>("login")

  const [companyProfileGate, setCompanyProfileGate] =
    useState<CompanyProfileGate>("checking")

  const portal = session?.user.role
    ? portalFromAccountRole(session.user.role)
    : null

  useEffect(() => {
    return authApi.onSessionExpired(() => {
      if (session) clearStoredImprovementMatchResultId(session.user.accountId)
      clearResourceCache()
      profileApi.clearCache()
      setSession(null)
      setShowLanding(true)

      setCompanyProfileGate("complete")

      setScreen("")

      setAnalyzerDraft(emptyAnalyzerDraft())

      setRebuiltFromImprovement(null)

      setImprovementMatchResultId(null)

      setTrackerFocusApplicationId(null)

      toast.error("Phiên làm việc đã hết hạn.")
    })
  }, [session])

  useEffect(() => {
    if (!session) return

    return authApi.startActivityMonitoring()
  }, [session?.user.accountId])

  useEffect(() => {
    if (!session) return

    if (
      requiresCompanyProfile(session.user.role) &&
      companyProfileGate !== "complete"
    ) {
      return
    }

    void prefetchAuthenticatedResources(session)
  }, [
    companyProfileGate,
    session?.accessToken,
    session?.user.accountId,
    session?.user.role,
  ])

  useEffect(() => {
    if (session || publicJobId) {
      setAuthReady(true)
      return
    }

    let active = true

    void authApi
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
      .finally(() => {
        if (active) setAuthReady(true)
      })

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
        if (active && authApi.getSession()) setCompanyProfileGate("required")
      })

    return () => {
      active = false
    }
  }, [session?.accessToken, session?.user.role])

  const handleAuth = (nextSession: AuthSession) => {
    if (session) clearStoredImprovementMatchResultId(session.user.accountId)

    clearStoredImprovementMatchResultId(nextSession.user.accountId)
    clearResourceCache()
    profileApi.clearCache()

    setShowLanding(false)

    setSession(nextSession)

    authApi.initializeActivity()

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
    clearResourceCache()
    profileApi.clearCache()

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
    return (
      <Suspense fallback={<FullPageSkeleton />}>
        <LandingScreen
          onSignIn={() => {
            setAuthEntryMode("login")
            setShowLanding(false)
          }}
          onGetStarted={() => {
            setAuthEntryMode("register")
            setShowLanding(false)
          }}
        />
      </Suspense>
    )
  }

  if (!session || session.requiresRoleSelection || !portal) {
    return (
      <Suspense fallback={<FullPageSkeleton />}>
        <AuthScreen
          onAuth={handleAuth}
          initialMode={authEntryMode}
          startInRoleSelection={Boolean(session?.requiresRoleSelection)}
          onBackToLanding={() => setShowLanding(true)}
        />
      </Suspense>
    )
  }

  if (requiresCompanyProfile(session.user.role)) {
    if (companyProfileGate === "checking") {
      return (
        <Layout
          portal={portal}
          currentScreen={screen}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          userName={session.user.fullName}
          userAvatarUrl={session.user.avatarUrl}
        >
          <ContentAreaLoader />
        </Layout>
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
        return (
          <ProfileScreen
            session={session}
            onSessionChange={setSession}
            onProfileSaved={(profile) => {
              if (isCompanyProfileComplete(profile)) {
                setCompanyProfileGate("complete")
              }
            }}
          />
        )

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
        return (
          <ProfileScreen
            session={session}
            onSessionChange={setSession}
            onProfileSaved={(profile) => {
              if (isCompanyProfileComplete(profile)) {
                setCompanyProfileGate("complete")
              }
            }}
          />
        )

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
          <div key={screen}>{renderScreen()}</div>
        </AnimatePresence>
      </Layout>
    </>
  )
}
