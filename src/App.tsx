import { useState } from 'react'
import AuthScreen from './screens/AuthScreen'
import Layout from './components/Layout'
import SeekerDashboard from './screens/SeekerDashboard'
import AnalyzerScreen from './screens/AnalyzerScreen'
import ImprovementScreen from './screens/ImprovementScreen'
import CVHistoryScreen from './screens/CVHistoryScreen'
import AppTrackerScreen from './screens/AppTrackerScreen'
import JDLibraryScreen from './screens/JDLibraryScreen'
import HRDashboard from './screens/HRDashboard'
import JobPostsScreen from './screens/JobPostsScreen'
import CVRankingScreen from './screens/CVRankingScreen'
import PipelineScreen from './screens/PipelineScreen'
import AutoEmailScreen from './screens/AutoEmailScreen'
import ReportsScreen from './screens/ReportsScreen'

type Portal = 'seeker' | 'hr'

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
  const [screen, setScreen] = useState<string>('')

  const handleAuth = (role: Portal) => {
    setPortal(role)
    setScreen(defaultScreen(role))
  }

  const handleLogout = () => {
    setPortal(null)
    setScreen('')
  }

  const handleNavigate = (s: string) => setScreen(s)

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
