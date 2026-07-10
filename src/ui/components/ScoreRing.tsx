import { getScoreTone } from '@/services/matchScore'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  showLabel?: boolean
}

export default function ScoreRing({ score, size = 100, strokeWidth = 10, label, showLabel = true }: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference
  const { color, trackColor } = getScoreTone(score)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      {showLabel && (
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: size * 0.2, color: 'var(--text-primary)', lineHeight: 1 }}>
            {score}%
          </div>
          {label && <div style={{ fontSize: size * 0.11, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 2 }}>{label}</div>}
        </div>
      )}
    </div>
  )
}
