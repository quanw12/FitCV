import { useEffect, useState } from "react"

import { authApi, profileApi } from "@/api"

import AuthScreen from "@/ui/screens/AuthScreen"

import Layout from "@/ui/components/Layout"

import SeekerDashboard from "@/ui/screens/SeekerDashboard"

import AnalyzerScreen from "@/ui/screens/AnalyzerScreen"

import ImprovementScreen from "@/ui/screens/ImprovementScreen"

import CVHistoryScreen from "@/ui/screens/CVHistoryScreen"

import AppTrackerScreen from "@/ui/screens/AppTrackerScreen"

import JDLibraryScreen from "@/ui/screens/JDLibraryScreen"

import HRDashboard from "@/ui/screens/HRDashboard"

import JobPostsScreen from "@/ui/screens/JobPostsScreen"

import CVRankingScreen from "@/ui/screens/CVRankingScreen"

import PipelineScreen from "@/ui/screens/PipelineScreen"

import AutoEmailScreen from "@/ui/screens/AutoEmailScreen"

import ReportsScreen from "@/ui/screens/ReportsScreen"
import ProfileScreen from "@/ui/screens/ProfileScreen"

import type { Portal, ScreenId } from "@/types/app"
import type { AnalyzerDraftState } from "@/types/analyzer"

import { portalFromAccountRole, type AuthSession } from "@/types/auth"
import {
  isCompanyProfileComplete,
  requiresCompanyProfile,
} from "@/services"

type CompanyProfileGate = "checking" | "required" | "complete"

function defaultScreen(portal: Portal) {
  return portal === "seeker" ? "seeker-dashboard" : "hr-dashboard"
}

function emptyAnalyzerDraft(): AnalyzerDraftState {
  return { cvFile: null, uploadedCvId: null, jdText: "", result: null }
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    authApi.getSession(),
  )

  const [screen, setScreen] = useState<ScreenId | "">(() => {
    const currentSession = authApi.getSession()

    return currentSession?.user.role
      ? defaultScreen(portalFromAccountRole(currentSession.user.role))
      : ""
  })
  const [improvementMatchResultId, setImprovementMatchResultId] =
    useState<string | null>(null)
  const [analyzerDraft, setAnalyzerDraft] =
    useState<AnalyzerDraftState>(emptyAnalyzerDraft)
  const [trackerFocusApplicationId, setTrackerFocusApplicationId] =
    useState<number | null>(null)
  const [companyProfileGate, setCompanyProfileGate] =
    useState<CompanyProfileGate>("checking")
  const portal = session?.user.role
    ? portalFromAccountRole(session.user.role)
    : null

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
        if (active)
          setCompanyProfileGate(
            isCompanyProfileComplete(profile) ? "complete" : "required",
          )
      })
      .catch(() => {
        if (active) setCompanyProfileGate("required")
      })

    return () => {
      active = false
    }
  }, [session?.accessToken, session?.user.role])

  const handleAuth = (nextSession: AuthSession) => {
    setSession(nextSession)
    setCompanyProfileGate("checking")
    setAnalyzerDraft(emptyAnalyzerDraft())
    setImprovementMatchResultId(null)
    setTrackerFocusApplicationId(null)

    if (nextSession.user.role) {
      const nextPortal = portalFromAccountRole(nextSession.user.role)

      setScreen(defaultScreen(nextPortal))
    }
  }

  const handleLogout = () => {
    authApi.logout()

    setSession(null)
    setCompanyProfileGate("complete")

    setScreen("")
    setAnalyzerDraft(emptyAnalyzerDraft())
    setImprovementMatchResultId(null)
    setTrackerFocusApplicationId(null)
  }

  const handleNavigate = (s: ScreenId) => {
    if (s !== "app-tracker") setTrackerFocusApplicationId(null)
    setScreen(s)
  }

  const handleViewTracking = (applicationId: number) => {
    setTrackerFocusApplicationId(applicationId)
    setScreen("app-tracker")
  }

  if (!session || session.requiresRoleSelection || !portal) {
    return (
      <AuthScreen
        onAuth={handleAuth}
        startInRoleSelection={Boolean(session?.requiresRoleSelection)}
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
            <ProfileScreen
              session={session}
              onSessionChange={setSession}
              companyOnboarding
              onProfileSaved={(profile) => {
                if (isCompanyProfileComplete(profile))
                  setCompanyProfileGate("complete")
              }}
            />
          </main>
        </div>
      )
    }
  }

  const renderScreen = () => {
    switch (screen) {
      // Seeker
      case "seeker-dashboard":
        return <SeekerDashboard onNavigate={handleNavigate} />

      case "analyzer":
        return (
          <AnalyzerScreen
            draft={analyzerDraft}
            setDraft={setAnalyzerDraft}
            onAnalysisComplete={setImprovementMatchResultId}
            onUploadCleared={() => setImprovementMatchResultId(null)}
            onViewSuggestions={() => setScreen("improvement")}
          />
        )

      case "improvement":
        return <ImprovementScreen matchResultId={improvementMatchResultId} />
      case "cv-history":
        return <CVHistoryScreen />

      case "app-tracker":
        return (
          <AppTrackerScreen
            focusApplicationId={trackerFocusApplicationId}
          />
        )

      case "jd-library":
        return <JDLibraryScreen onViewTracking={handleViewTracking} />

      case "profile":
        return <ProfileScreen session={session} onSessionChange={setSession} />
      // HR

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
          <SeekerDashboard onNavigate={handleNavigate} />
        ) : (
          <HRDashboard onNavigate={handleNavigate} />
        )
    }
  }

  return (
    <Layout
      portal={portal}
      currentScreen={screen}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userName={session.user.fullName}
      userAvatarUrl={session.user.avatarUrl}
    >
      {renderScreen()}
    </Layout>
  )
}
