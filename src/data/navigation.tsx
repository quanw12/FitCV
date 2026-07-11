import {
  LayoutDashboard,
  Zap,
  Lightbulb,
  Clock,
  CheckSquare,
  BookOpen,
  User,
  Briefcase,
  BarChart3,
  Users,
  Mail,
  FileText,
  Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Portal, ScreenId } from '@/types/app'

export interface NavItem {
  icon: ReactNode
  label: string
  screen: ScreenId
}

export const seekerNavItems: NavItem[] = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', screen: 'seeker-dashboard' },
  { icon: <Zap size={18} />, label: 'Match Analyzer', screen: 'analyzer' },
  { icon: <Lightbulb size={18} />, label: 'Improvement Tips', screen: 'improvement' },
  { icon: <Clock size={18} />, label: 'CV History', screen: 'cv-history' },
  { icon: <CheckSquare size={18} />, label: 'Application Tracker', screen: 'app-tracker' },
  { icon: <BookOpen size={18} />, label: 'JD Library', screen: 'jd-library' },
  { icon: <User size={18} />, label: 'Profile', screen: 'profile' },
]

export const hrNavItems: NavItem[] = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', screen: 'hr-dashboard' },
  { icon: <Briefcase size={18} />, label: 'Job Posts', screen: 'job-posts' },
  { icon: <FileText size={18} />, label: 'CV Ranking', screen: 'cv-ranking' },
  { icon: <Users size={18} />, label: 'Pipeline', screen: 'pipeline' },
  { icon: <Mail size={18} />, label: 'Auto Email', screen: 'auto-email' },
  { icon: <BarChart3 size={18} />, label: 'Reports', screen: 'reports' },
  { icon: <Settings size={18} />, label: 'Settings', screen: 'hr-settings' },
]

export function getPortalNavigation(portal: Portal) {
  return portal === 'seeker' ? seekerNavItems : hrNavItems
}
