import { useEffect, useRef, useState } from "react"

export interface ScoreBar {
  label: string
  score: number
}

export interface ScoreChartProps {
  bars: ScoreBar[]
  caption: string
}

const VIEW_WIDTH = 560
const VIEW_HEIGHT = 260
const PLOT_LEFT = 116
const PLOT_TOP = 16
const PLOT_RIGHT = 24
const BAR_GAP = 14
const GRID_LINES = [0, 25, 50, 75, 100]

export default function ScoreChart({ bars, caption }: ScoreChartProps) {
  const rootRef = useRef<SVGSVGElement>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const node = rootRef.current
    if (!node) return

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsActive(true)

      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setIsActive(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.35 },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  const plotWidth = VIEW_WIDTH - PLOT_LEFT - PLOT_RIGHT
  const plotHeight = VIEW_HEIGHT - PLOT_TOP * 2
  const barHeight = plotHeight / bars.length - BAR_GAP

  return (
    <figure className="lp-chart">
      <svg
        ref={rootRef}
        className={isActive ? "lp-chart-svg is-active" : "lp-chart-svg"}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={caption}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lp-bar-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--lp-accent-deep)" />
            <stop offset="100%" stopColor="var(--lp-accent)" />
          </linearGradient>
        </defs>

        {GRID_LINES.map((value) => {
          const x = PLOT_LEFT + (value / 100) * plotWidth

          return (
            <g key={value}>
              <line
                x1={x}
                y1={PLOT_TOP}
                x2={x}
                y2={VIEW_HEIGHT - PLOT_TOP}
                className="lp-chart-grid"
              />
              <text
                x={x}
                y={VIEW_HEIGHT - 2}
                className="lp-chart-tick"
                textAnchor="middle"
              >
                {value}
              </text>
            </g>
          )
        })}

        {bars.map((bar, index) => {
          const y = PLOT_TOP + index * (barHeight + BAR_GAP)
          const width = (bar.score / 100) * plotWidth
          const delay = `${index * 110}ms`

          return (
            <g key={bar.label}>
              <text
                x={PLOT_LEFT - 16}
                y={y + barHeight / 2}
                className="lp-chart-label"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {bar.label}
              </text>

              <rect
                x={PLOT_LEFT}
                y={y}
                width={plotWidth}
                height={barHeight}
                rx={3}
                className="lp-chart-rail"
              />

              <rect
                x={PLOT_LEFT}
                y={y}
                width={width}
                height={barHeight}
                rx={3}
                className="lp-chart-bar"
                fill="url(#lp-bar-fill)"
                style={{ transitionDelay: delay, animationDelay: delay }}
              />

              <text
                x={PLOT_LEFT + width - 10}
                y={y + barHeight / 2}
                className="lp-chart-value"
                textAnchor="end"
                dominantBaseline="middle"
                style={{ transitionDelay: `calc(${delay} + 260ms)` }}
              >
                {bar.score}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="lp-chart-caption">{caption}</figcaption>
    </figure>
  )
}
