import { useState } from 'react'
import AuthScreen from '@/ui/screens/AuthScreen'
import Layout from '@/ui/components/Layout'
import SeekerDashboard from '@/ui/screens/SeekerDashboard'
import AnalyzerScreen from '@/ui/screens/AnalyzerScreen'
import ImprovementScreen from '@/ui/screens/ImprovementScreen'
import CVHistoryScreen from '@/ui/screens/CVHistoryScreen'
import AppTrackerScreen from '@/ui/screens/AppTrackerScreen'
import JDLibraryScreen from '@/ui/screens/JDLibraryScreen'
import HRDashboard from '@/ui/screens/HRDashboard'
import JobPostsScreen from '@/ui/screens/JobPostsScreen'
import CVRankingScreen from '@/ui/screens/CVRankingScreen'
import PipelineScreen from '@/ui/screens/PipelineScreen'
import AutoEmailScreen from '@/ui/screens/AutoEmailScreen'
import ReportsScreen from '@/ui/screens/ReportsScreen'
import type { Portal, ScreenId } from '@/types/app'

function ProfilePlaceholder() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 16 }}>
      Profile settings coming soon...
    </div>
  )
}

function defaultScreen(portal: Portal) {
  return portal === 'seeker' ? 'seeker-dashboard' : 'hr-dashboard'
}

export default function App() {
  const [portal, setPortal] = useState<Portal | null>(null)
  const [screen, setScreen] = useState<ScreenId | ''>('')

  const handleAuth = (role: Portal) => {
    setPortal(role)
    setScreen(defaultScreen(role))
  }

  const handleLogout = () => {
    setPortal(null)
    setScreen('')
  }

  const handleNavigate = (s: ScreenId) => setScreen(s)

  if (!portal) {
    return <AuthScreen onAuth={handleAuth} />
  }

  const renderScreen = () => {
    switch (screen) {
      // Seeker
      case 'seeker-dashboard': return <SeekerDashboard onNavigate={handleNavigate} />
      case 'analyzer': return <AnalyzerScreen />
      case 'improvement': return <ImprovementScreen />
      case 'cv-history': return <CVHistoryScreen />
      case 'app-tracker': return <AppTrackerScreen />
      case 'jd-library': return <JDLibraryScreen />
      case 'profile': return <ProfilePlaceholder />
      // HR
      case 'hr-dashboard': return <HRDashboard onNavigate={handleNavigate} />
      case 'job-posts': return <JobPostsScreen />
      case 'cv-ranking': return <CVRankingScreen />
      case 'pipeline': return <PipelineScreen />
      case 'auto-email': return <AutoEmailScreen />
      case 'reports': return <ReportsScreen />
      case 'hr-settings': return <ProfilePlaceholder />
      default: return portal === 'seeker' ? <SeekerDashboard onNavigate={handleNavigate} /> : <HRDashboard onNavigate={handleNavigate} />
    }
  }

  return (
    <Layout
      portal={portal}
      currentScreen={screen}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userName={portal === 'seeker' ? 'Nguyen Minh' : 'Tran Huong'}
    >
      {renderScreen()}
    </Layout>
  )
}
