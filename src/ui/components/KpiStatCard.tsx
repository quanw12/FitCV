import type { ReactNode } from "react"

import { Minus, TrendingDown, TrendingUp } from "lucide-react"

import BezelCard from "@/ui/components/BezelCard"

import type { DeltaSummary } from "@/services/reportMetrics"

interface KpiStatCardProps {
  label: string
  value: string
  icon: ReactNode
  iconColor: string
  delta?: DeltaSummary
  loading?: boolean
}

const deltaIcon = (direction: DeltaSummary["direction"]) => {
  if (direction === "up") return TrendingUp
  if (direction === "down") return TrendingDown
  if (direction === "flat") return Minus
  return null
}

export default function KpiStatCard({
  label,
  value,
  icon,
  iconColor,
  delta,
  loading = false,
}: KpiStatCardProps) {
  const DeltaGlyph = delta ? deltaIcon(delta.direction) : null

  return (
    <BezelCard className="kpi-stat-card">
      <div className="kpi-stat-card__body">
        <div className="kpi-stat-card__icon" style={{ color: iconColor }}>
          {icon}
        </div>
        <div className="kpi-stat-card__metrics">
          {loading ? (
            <>
              <div className="fc-skeleton kpi-stat-card__value-skeleton" />
              <div className="fc-skeleton kpi-stat-card__label-skeleton" />
              <div className="fc-skeleton kpi-stat-card__delta-skeleton" />
            </>
          ) : (
            <>
              <div className="kpi-stat-card__value">{value}</div>
              <div className="kpi-stat-card__label">{label}</div>
              {delta ? (
                <div
                  className="kpi-stat-card__delta"
                  style={{ color: delta.color }}
                >
                  {DeltaGlyph ? (
                    <DeltaGlyph size={13} aria-hidden="true" />
                  ) : null}
                  {delta.text}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </BezelCard>
  )
}
