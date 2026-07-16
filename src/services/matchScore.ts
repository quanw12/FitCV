import type { MatchLabel } from '@/types/app'

export function getMatchLabel(score: number): MatchLabel {
  if (score >= 80) return 'Strong Match'
  if (score >= 50) return 'Moderate Match'
  return 'Weak Match'
}

export function getScoreTone(score: number) {
  if (score >= 80) {
    return { color: '#16A34A', trackColor: '#DCFCE7', label: getMatchLabel(score) }
  }

  if (score >= 50) {
    return { color: '#2563EB', trackColor: '#DBEAFE', label: getMatchLabel(score) }
  }

  return { color: '#D97706', trackColor: '#FDE68A', label: getMatchLabel(score) }
}
