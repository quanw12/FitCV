import { useEffect, useRef, useState, type CSSProperties } from "react"

import "./branch-timeline.css"

const VIEW_W = 1240
const VIEW_H = 410
const RAIL_Y = 220
const RAIL_X1 = 250
const RAIL_X2 = 1225
const UP_Y = 108
const DOWN_Y = 336

/* The three shared stages run along the rail; both outcomes fork off the last
   one, so the diagram reads as one workflow with two possible endings. */

const FORK_X = 540
const STAGE_X = [300, 420, FORK_X]
const BRANCH_X = 680
const BRANCH_W = 250
const BRANCH_END = BRANCH_X + BRANCH_W
const STATUS_R = 15
const STATUS_1_X = BRANCH_END + 58
const STATUS_2_X = STATUS_1_X + 92
const REJOIN_X = 1150
const NODE_X = [...STAGE_X, REJOIN_X]
const GLYPH_CHECK = "M-5,0 L-1.6,3.6 L5.2,-3.6"
const GLYPH_UP = "M0,4.6 V-4.6 M-3.8,-1 L0,-4.8 L3.8,-1"
const GLYPH_BANG = "M0,-5.4 V0.8 M0,4.2 h0.01"
const GLYPH_CROSS = "M-4.2,-4.2 L4.2,4.2 M4.2,-4.2 L-4.2,4.2"

function after(ms: number): CSSProperties {
  return { transitionDelay: `${ms}ms` }
}

function railDots(): number[] {
  const dots: number[] = []

  for (let x = RAIL_X1 + 30; x <= RAIL_X2 - 20; x += 40) {
    if (NODE_X.some((node) => Math.abs(node - x) < 24)) continue
    dots.push(x)
  }

  return dots
}

/* An S-curve from the fork on the rail out to a branch pill, mirrored by the
   sign of the vertical run. */

function connector(y: number): string {
  const bend = (BRANCH_X - FORK_X) * 0.45

  return `M${FORK_X},${RAIL_Y} C${FORK_X + bend},${RAIL_Y} ${BRANCH_X - bend},${y} ${BRANCH_X},${y}`
}

interface RailNodeProps {
  x: number
  ms: number
}

function RailNode({ x, ms }: RailNodeProps) {
  return (
    <g transform={`translate(${x},${RAIL_Y})`}>
      <g className="bt-pop" style={after(ms)}>
        <circle r={9} className="bt-rail-ring" />
        <circle r={3.4} className="bt-rail-core" />
      </g>
    </g>
  )
}

interface ChangedPillProps {
  cy: number
  label: string
  tone: "up" | "down"
  ms: number
}

/* Mono at 11px advances ~6.6px per character, so the pill can size itself to
   whatever the spec puts in it rather than clipping a longer label. */

function ChangedPill({ cy, label, tone, ms }: ChangedPillProps) {
  const width = Math.max(132, Math.round(label.length * 6.6) + 48)
  const left = Math.round((FORK_X + BRANCH_X) / 2 - width / 2)

  return (
    <g className="bt-fade" style={after(ms)}>
      <rect
        x={left}
        y={cy - 13}
        width={width}
        height={26}
        rx={13}
        className="bt-changed"
      />
      <circle
        cx={left + 18}
        cy={cy}
        r={4}
        className={`bt-changed-dot is-${tone}`}
      />
      <text x={left + 30} y={cy + 4} className="bt-changed-text">
        {label}
      </text>
    </g>
  )
}

interface BranchPillProps {
  y: number
  badge: string
  label: string
  ms: number
}

function BranchPill({ y, badge, label, ms }: BranchPillProps) {
  const badgeW = Math.max(64, Math.round(badge.length * 6.5) + 16)

  return (
    <g className="bt-fade" style={after(ms)}>
      <rect
        x={BRANCH_X}
        y={y - 22}
        width={BRANCH_W}
        height={44}
        rx={5}
        className="bt-pill"
      />
      <rect
        x={BRANCH_X + 13}
        y={y - 10}
        width={badgeW}
        height={20}
        rx={3}
        className="bt-badge"
      />
      <text
        x={BRANCH_X + 13 + badgeW / 2}
        y={y + 4}
        textAnchor="middle"
        className="bt-badge-text"
      >
        {badge}
      </text>
      <text x={BRANCH_X + badgeW + 37} y={y + 5} className="bt-pill-text">
        {label}
      </text>
    </g>
  )
}

interface StatusNodeProps {
  x: number
  y: number
  tone: "pass" | "fail"
  glyph: string
  label: string
  ms: number
}

function StatusNode({ x, y, tone, glyph, label, ms }: StatusNodeProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <g className={`bt-pop is-${tone}`} style={after(ms)}>
        <circle r={STATUS_R} className="bt-status-ring" />
        <path d={glyph} className="bt-status-glyph" />
      </g>
      <text
        y={38}
        textAnchor="middle"
        className="bt-caption bt-fade"
        style={after(ms + 130)}
      >
        {label}
      </text>
    </g>
  )
}

export interface TimelineBranch {
  changed: string
  pill: string
  first: string
  second: string
}

export interface TimelineSpec {
  badge: string
  marker: string
  branchBadge: string
  stages: string[]
  pass: TimelineBranch
  fail: TimelineBranch
  outcome: string
}

export interface BranchTimelineProps {
  spec: TimelineSpec
  caption: string
}

export default function BranchTimeline({ spec, caption }: BranchTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    if (reduced || typeof IntersectionObserver === "undefined") {
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
      { threshold: 0.25 },
    )

    observer.observe(svg)

    return () => observer.disconnect()
  }, [])

  const badgeW = Math.max(54, Math.round(spec.badge.length * 7) + 22)

  return (
    <figure className="bt">
      <div className="bt-grid" aria-hidden="true" />

      <svg
        ref={svgRef}
        className={isActive ? "bt-svg is-active" : "bt-svg"}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={caption}
      >
        <g className="bt-fade" style={after(120)}>
          <rect
            x={8}
            y={RAIL_Y - 14}
            width={badgeW}
            height={28}
            rx={4}
            className="bt-live"
          />
          <text
            x={8 + badgeW / 2}
            y={RAIL_Y + 4}
            textAnchor="middle"
            className="bt-live-text"
          >
            {spec.badge}
          </text>

          <rect
            x={badgeW + 20}
            y={RAIL_Y - 21}
            width={166}
            height={42}
            rx={5}
            className="bt-pill"
          />
          <text x={badgeW + 36} y={RAIL_Y + 5} className="bt-pill-text">
            {spec.marker}
          </text>
        </g>

        <path
          d={`M${RAIL_X1},${RAIL_Y} H${RAIL_X2}`}
          pathLength={1}
          className="bt-draw bt-rail"
          style={after(0)}
        />

        <g className="bt-fade" style={after(420)}>
          {railDots().map((x) => (
            <circle
              key={x}
              cx={x}
              cy={RAIL_Y}
              r={1.6}
              className="bt-rail-dot"
            />
          ))}
        </g>

        {spec.stages.map((stage, index) => (
          <g key={stage}>
            <RailNode x={STAGE_X[index]} ms={480 + index * 120} />
            <text
              x={STAGE_X[index]}
              y={RAIL_Y + 34}
              textAnchor="middle"
              className="bt-stamp bt-fade"
              style={after(560 + index * 120)}
            >
              {stage}
            </text>
          </g>
        ))}

        <PassBranch spec={spec} />
        <FailBranch spec={spec} />
      </svg>

      <figcaption className="bt-figcaption">{caption}</figcaption>
    </figure>
  )
}

interface BranchProps {
  spec: TimelineSpec
}

/* The kept path: fork up, run the two checks, then corner back down into the
   rail so the outcome lands on the main line. */

function PassBranch({ spec }: BranchProps) {
  const lead = `M${BRANCH_END},${UP_Y} H${STATUS_1_X - STATUS_R}`
  const link = `M${STATUS_1_X + STATUS_R},${UP_Y} H${STATUS_2_X - STATUS_R}`
  const rejoin = `M${STATUS_2_X + STATUS_R},${UP_Y} H${REJOIN_X - 26} Q${REJOIN_X},${UP_Y} ${REJOIN_X},${UP_Y + 26} V${RAIL_Y}`

  return (
    <g>
      <path
        d={connector(UP_Y)}
        pathLength={1}
        className="bt-draw bt-connector"
        style={after(900)}
      />

      <ChangedPill cy={164} label={spec.pass.changed} tone="up" ms={1080} />

      <BranchPill
        y={UP_Y}
        badge={spec.branchBadge}
        label={spec.pass.pill}
        ms={1180}
      />

      <path
        d={lead}
        pathLength={1}
        className="bt-draw bt-pass"
        style={after(1320)}
      />

      <StatusNode
        x={STATUS_1_X}
        y={UP_Y}
        tone="pass"
        glyph={GLYPH_CHECK}
        label={spec.pass.first}
        ms={1460}
      />

      <path
        d={link}
        pathLength={1}
        className="bt-draw bt-pass"
        style={after(1560)}
      />

      <StatusNode
        x={STATUS_2_X}
        y={UP_Y}
        tone="pass"
        glyph={GLYPH_UP}
        label={spec.pass.second}
        ms={1660}
      />

      <path
        d={rejoin}
        pathLength={1}
        className="bt-draw bt-pass"
        style={after(1800)}
      />

      <RailNode x={REJOIN_X} ms={2080} />

      <text
        x={REJOIN_X}
        y={RAIL_Y + 34}
        textAnchor="middle"
        className="bt-stamp is-pass bt-fade"
        style={after(2180)}
      >
        {spec.outcome}
      </text>
    </g>
  )
}

/* The dropped path: forks down from the same point and simply ends, so nothing
   it produced ever reaches the main line. */

function FailBranch({ spec }: BranchProps) {
  const lead = `M${BRANCH_END},${DOWN_Y} H${STATUS_1_X - STATUS_R}`
  const link = `M${STATUS_1_X + STATUS_R},${DOWN_Y} H${STATUS_2_X - STATUS_R}`

  return (
    <g>
      <path
        d={connector(DOWN_Y)}
        pathLength={1}
        className="bt-draw bt-connector"
        style={after(960)}
      />

      <ChangedPill cy={278} label={spec.fail.changed} tone="down" ms={1140} />

      <BranchPill
        y={DOWN_Y}
        badge={spec.branchBadge}
        label={spec.fail.pill}
        ms={1240}
      />

      <path
        d={lead}
        pathLength={1}
        className="bt-draw bt-fail"
        style={after(1380)}
      />

      <StatusNode
        x={STATUS_1_X}
        y={DOWN_Y}
        tone="fail"
        glyph={GLYPH_BANG}
        label={spec.fail.first}
        ms={1520}
      />

      <path
        d={link}
        pathLength={1}
        className="bt-draw bt-fail"
        style={after(1620)}
      />

      <StatusNode
        x={STATUS_2_X}
        y={DOWN_Y}
        tone="fail"
        glyph={GLYPH_CROSS}
        label={spec.fail.second}
        ms={1720}
      />
    </g>
  )
}
