import type { MatchLabel } from '@/types/app'

export function getMatchLabel(score: number): MatchLabel {
  if (score >= 80) return 'Strong Match'
  if (score >= 50) return 'Moderate Match'
  return 'Weak Match'
}

export function getScoreTone(score: number) {
  if (score >= 80) {
    return { color: '#10B981', trackColor: '#D1FAE5', label: getMatchLabel(score) }
  }

  if (score >= 50) {
    return { color: '#4F46E5', trackColor: '#EEF2FF', label: getMatchLabel(score) }
  }

  return { color: '#F59E0B', trackColor: '#FEF3C7', label: getMatchLabel(score) }
}
