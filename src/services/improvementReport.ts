import type { CvSection, SuggestionPriority } from '@/types/improvement'

export const priorityRank: Record<SuggestionPriority, number> = { High: 0, Medium: 1, Low: 2 }

export const sectionLabel: Record<CvSection, string> = {
  Summary: 'Summary',
  WorkExperience: 'Work Experience',
  Skills: 'Skills',
  Education: 'Education',
  Projects: 'Projects',
  Other: 'Other',
}

const priorityBadgeClass: Record<SuggestionPriority, string> = {
  High: 'fc-badge fc-badge--red',
  Medium: 'fc-badge fc-badge--amber',
  Low: 'fc-badge fc-badge--blue',
}

export function priorityBadge(priority: SuggestionPriority): string {
  return priorityBadgeClass[priority]
}

export function scoreLabel(score: number): string {
  return score >= 80 ? 'Strong Match' : score >= 50 ? 'Moderate Match' : 'Weak Match'
}
