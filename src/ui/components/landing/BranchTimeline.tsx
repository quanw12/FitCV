import { useEffect, useRef, useState, type CSSProperties } from "react"

import "./branch-timeline.css"

/* Canvas is wider than the old diagram so a four-stage trunk, a decision gate
   and a looping lane all fit without overlapping. Heights differ because the
   seeker loop needs room for the arc running back under the rail. */

const VIEW_W = 1440
const RAIL_Y = 226
const UP_Y = 96
const DOWN_Y = 344
const LOOP_Y = 448
const RAIL_X1 = 300
const RAIL_X2 = 1426
const FORK_X = 600
const BRANCH_X = 760
const BRANCH_W = 250
const BRANCH_END = BRANCH_X + BRANCH_W
const REJOIN_X = 1360
const LOOP_BACK_X = RAIL_X1 - 8
const STATUS_R = 15
const GATE_R = 22

export type TimelineGlyph =
  | "check"
  | "up"
  | "cross"
  | "bang"
  | "mail"
  | "spark"
  | "plus"
  | "loop"
  | "dot"

/* Glyph paths are centred on the node origin. `dot` is the only filled mark;
   every other glyph is stroked. */

const GLYPHS: Record<TimelineGlyph, { d: string; fill?: boolean }> = {
  check: { d: "M-5,0 L-1.6,3.6 L5.2,-3.6" },
  up: { d: "M0,4.6 V-4.6 M-3.8,-1 L0,-4.8 L3.8,-1" },
  cross: { d: "M-4.2,-4.2 L4.2,4.2 M4.2,-4.2 L-4.2,4.2" },
  bang: { d: "M0,-5.4 V0.8 M0,4.2 h0.01" },
  mail: { d: "M-6,-3.5 H6 V3.5 H-6 Z M-6,-3.5 L0,1 L6,-3.5" },
  spark: { d: "M0,-6 L1.4,-1.4 L6,0 L1.4,1.4 L0,6 L-1.4,1.4 L-6,0 L-1.4,-1.4 Z" },
  plus: { d: "M0,-5 V5 M-5,0 H5" },
  loop: { d: "M2.5,-4.33 A5,5 0 1 1 -2.5,-4.33 M-2.5,-4.33 L-0.4,-4.1 M-2.5,-4.33 L-1.6,-2.2" },
  dot: { d: "M0,-2.2 A2.2,2.2 0 1 0 0.01,0 Z", fill: true },
}

export interface TimelineNode {
  label: string
  glyph: TimelineGlyph
}

export type TimelineEnding =
  | { kind: "rejoin"; label: string }
  | { kind: "loop"; label: string }
  | { kind: "stop"; label: string }

export interface TimelineLane {
  badge: string
  title: string
  note: string
  tone: "pass" | "fail" | "loop"
  nodes: TimelineNode[]
  ending: TimelineEnding
}

export interface TimelineSpec {
  badge: string
  marker: string
  stages: string[]
  gate: string
  up: TimelineLane
  down: TimelineLane
}

export interface BranchTimelineProps {
  spec: TimelineSpec
  caption: string
}

function after(ms: number): CSSProperties {
  return { transitionDelay: `${ms}ms` }
}

/* Trunk stages fan out left of the fork so the last one lands exactly on the
   gate. Derived from the stage count, so 3–5 stages all space themselves. */

function stageX(i: number, n: number): number {
  if (n <= 1) return FORK_X
  const step = (FORK_X - (RAIL_X1 + 40)) / (n - 1)

  return FORK_X - (n - 1 - i) * step
}

/* Lane nodes spread evenly between the branch pill and the rejoin point so a
   varying node count never collides with the rail or the fork. */

function laneNodeX(j: number, m: number): number {
  const start = BRANCH_END + 70
  const end = REJOIN_X - 60

  if (m <= 1) return (start + end) / 2

  return start + (j * (end - start)) / (m - 1)
}

/* An S-curve from the fork on the rail out to a branch pill, mirrored by the
   sign of the vertical run. */

function connector(y: number): string {
  const bend = (BRANCH_X - FORK_X) * 0.45

  return `M${FORK_X + GATE_R},${RAIL_Y} C${FORK_X + bend},${RAIL_Y} ${BRANCH_X - bend},${y} ${BRANCH_X},${y}`
}

/* Prefer splitting on the middot so "Scored · 4 categories" keeps the marker on
   the first line; otherwise break at the last space before the limit. */

function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]

  const dot = text.indexOf("·")

  if (dot > 0 && dot <= maxChars) {
    return [text.slice(0, dot + 1).trim(), text.slice(dot + 1).trim()]
  }

  const cut = text.lastIndexOf(" ", maxChars)

  if (cut <= 0) return [text.slice(0, maxChars), text.slice(maxChars)]

  return [text.slice(0, cut), text.slice(cut + 1)]
}

interface WrappedTextProps {
  x: number
  y: number
  text: string
  maxChars: number
  className?: string
  textAnchor?: "start" | "middle" | "end"
  style?: CSSProperties
}

function WrappedText({
  x,
  y,
  text,
  maxChars,
  className,
  textAnchor = "middle",
  style,
}: WrappedTextProps) {
  const lines = wrapLabel(text, maxChars)

  return (
    <text x={x} y={y} textAnchor={textAnchor} className={className} style={style}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function railDots(nodeXs: number[]): number[] {
  const dots: number[] = []

  for (let x = RAIL_X1 + 30; x <= RAIL_X2 - 20; x += 40) {
    if (nodeXs.some((node) => Math.abs(node - x) < 24)) continue
    dots.push(x)
  }

  return dots
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

interface GateProps {
  x: number
  y: number
  ms: number
  label: string
  stamp: string
  stampMs: number
}

/* The fork is a diamond on the rail, not a plain node, so the read is
   "decide here" rather than "another step on the line". */

function Gate({ x, y, ms, label, stamp, stampMs }: GateProps) {
  const r = GATE_R

  return (
    <g>
      <path
        d={`M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y} Z`}
        className="bt-gate"
        style={after(ms)}
      />
      <path
        d={`M${x - r + 7},${y} L${x - 2},${y + r - 10} L${x + r - 6},${y - 7}`}
        className="bt-gate-tick"
        style={after(ms + 80)}
      />
      <text x={x} y={y - r - 12} textAnchor="middle" className="bt-gate-text" style={after(ms + 120)}>
        {label}
      </text>
      <WrappedText
        x={x}
        y={y + 34}
        text={stamp}
        maxChars={12}
        className="bt-stamp bt-fade"
        style={after(stampMs)}
      />
    </g>
  )
}

interface BranchPillProps {
  y: number
  badge: string
  title: string
  note: string
  ms: number
}

/* The lane header is a single card: a tone badge, the lane title, and the note
   describing why the candidate lands on this branch. Keeping it one block stops
   the note from floating over the connector. */

function BranchPill({ y, badge, title, note, ms }: BranchPillProps) {
  const badgeW = Math.max(64, Math.round(badge.length * 6.5) + 16)
  const top = y - 26

  return (
    <g className="bt-fade" style={after(ms)}>
      <rect x={BRANCH_X} y={top} width={BRANCH_W} height={56} rx={6} className="bt-pill" />
      <rect x={BRANCH_X + 13} y={top + 12} width={badgeW} height={18} rx={3} className="bt-badge" />
      <text x={BRANCH_X + 13 + badgeW / 2} y={top + 25} textAnchor="middle" className="bt-badge-text">
        {badge}
      </text>
      <text x={BRANCH_X + badgeW + 30} y={top + 25} className="bt-pill-text">
        {title}
      </text>
      <text x={BRANCH_X + 13} y={top + 45} className="bt-pill-note">
        {note}
      </text>
    </g>
  )
}

interface StatusNodeProps {
  x: number
  y: number
  tone: "pass" | "fail" | "loop"
  glyph: TimelineGlyph
  label: string
  ms: number
}

function StatusNode({ x, y, tone, glyph, label, ms }: StatusNodeProps) {
  const g = GLYPHS[glyph]

  return (
    <g transform={`translate(${x},${y})`}>
      <g className={`bt-pop is-${tone}`} style={after(ms)}>
        <circle r={STATUS_R} className="bt-status-ring" />
        <path d={g.d} className={`bt-status-glyph${g.fill ? " is-filled" : ""}`} />
      </g>
      <WrappedText
        x={0}
        y={38}
        text={label}
        maxChars={15}
        className="bt-caption bt-fade"
        style={after(ms + 130)}
      />
    </g>
  )
}

interface LaneProps {
  lane: TimelineLane
  side: "up" | "down"
}

/* A branch renders the connector, the lane header, an evenly spaced run of
   nodes, then whichever ending the spec calls for. Delays are derived from the
   node index so any length animates in order. */

function Lane({ lane, side }: LaneProps) {
  const y = side === "up" ? UP_Y : DOWN_Y
  const connDelay = side === "up" ? 900 : 960
  const pillDelay = side === "up" ? 1180 : 1240
  const segBase = side === "up" ? 1320 : 1380
  const tone = lane.tone
  const m = lane.nodes.length
  const nodeMs = (j: number) => segBase + j * 200 + 140
  const segMs = (j: number) => segBase + j * 200
  const lastX = laneNodeX(m - 1, m)

  return (
    <g>
      <path d={connector(y)} pathLength={1} className="bt-draw bt-connector" style={after(connDelay)} />

      <BranchPill y={y} badge={lane.badge} title={lane.title} note={lane.note} ms={pillDelay} />

      {lane.nodes.map((node, j) => {
        const nx = laneNodeX(j, m)
        const prevX = j === 0 ? BRANCH_END : laneNodeX(j - 1, m) + STATUS_R
        const lead = `M${prevX},${y} H${nx - STATUS_R}`

        return (
          <g key={node.label}>
            <path d={lead} pathLength={1} className={`bt-draw bt-${tone}`} style={after(segMs(j))} />
            <StatusNode x={nx} y={y} tone={tone} glyph={node.glyph} label={node.label} ms={nodeMs(j)} />
          </g>
        )
      })}

      {lane.ending.kind === "rejoin" && (
        <RejoinEnding y={y} lastX={lastX} label={lane.ending.label} endMs={segMs(m - 1) + 300} />
      )}

      {lane.ending.kind === "loop" && (
        <LoopEnding lastX={lastX} label={lane.ending.label} endMs={segMs(m - 1) + 300} />
      )}

      {lane.ending.kind === "stop" && (
        <StopEnding y={y} lastX={lastX} label={lane.ending.label} endMs={segMs(m - 1) + 300} />
      )}
    </g>
  )
}

interface EndingProps {
  y: number
  lastX: number
  label: string
  endMs: number
}

function RejoinEnding({ y, lastX, label, endMs }: EndingProps) {
  const rejoin = `M${lastX + STATUS_R},${y} H${REJOIN_X - 26} Q${REJOIN_X},${y} ${REJOIN_X},${y + 26} V${RAIL_Y}`

  return (
    <g>
      <path d={rejoin} pathLength={1} className="bt-draw bt-pass" style={after(endMs)} />
      <RailNode x={REJOIN_X} ms={endMs + 120} />
      <text
        x={REJOIN_X}
        y={RAIL_Y + 34}
        textAnchor="middle"
        className="bt-stamp is-pass bt-fade"
        style={after(endMs + 240)}
      >
        {label}
      </text>
    </g>
  )
}

/* The seeker loop leaves the last node to the right, drops to a rail beneath the
   diagram, runs back to the head and points into it — so the same CV is sent
   through the flow again rather than ending the story. */

function LoopEnding({ lastX, label, endMs }: { lastX: number; label: string; endMs: number }) {
  const d = `M${lastX + STATUS_R},${DOWN_Y} H${lastX + 40} Q${lastX + 40},${LOOP_Y} ${lastX + 10},${LOOP_Y} H${LOOP_BACK_X} Q${LOOP_BACK_X},${RAIL_Y} ${RAIL_X1 - 30},${RAIL_Y} H${RAIL_X1}`

  return (
    <g>
      <path
        d={d}
        pathLength={1}
        className="bt-draw bt-loop"
        markerEnd="url(#bt-arrow-loop)"
        style={after(endMs)}
      />
      <g className="bt-fade" style={after(endMs + 200)}>
        <rect
          x={(lastX + 10 + LOOP_BACK_X) / 2 - 180}
          y={LOOP_Y - 13}
          width={360}
          height={26}
          rx={13}
          className="bt-loop-pill"
        />
        <text x={(lastX + 10 + LOOP_BACK_X) / 2} y={LOOP_Y + 4} textAnchor="middle" className="bt-loop-text">
          {label}
        </text>
      </g>
    </g>
  )
}

/* A terminal lane simply stops: a short lead past the last node, a 2px cap bar
   and a mono label saying the record is kept. Nothing rejoins the rail. */

function StopEnding({ y, lastX, label, endMs }: EndingProps) {
  const capX = lastX + 46

  return (
    <g>
      <path
        d={`M${lastX + STATUS_R},${y} H${capX}`}
        pathLength={1}
        className="bt-draw bt-fail"
        style={after(endMs - 160)}
      />
      <path d={`M${capX},${y - 24} V${y + 24}`} className="bt-stop-cap" style={after(endMs)} />
      <text
        x={capX}
        y={y + 64}
        textAnchor="middle"
        className="bt-stamp is-fail bt-fade"
        style={after(endMs + 80)}
      >
        {label}
      </text>
    </g>
  )
}

export default function BranchTimeline({ spec, caption }: BranchTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isActive, setIsActive] = useState(false)
  const hasLoop = spec.down.ending.kind === "loop"
  const viewH = hasLoop ? 500 : 460

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

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

  const n = spec.stages.length
  const stageXs = spec.stages.map((_, i) => stageX(i, n))
  const nodeXs = [...stageXs, REJOIN_X]
  const badgeW = Math.max(54, Math.round(spec.badge.length * 7) + 22)

  const srItems: string[] = [`${spec.badge} ${spec.marker}`]
  for (const stage of spec.stages) srItems.push(`Stage: ${stage}`)
  srItems.push(`Gate: ${spec.gate}`)
  for (const lane of [spec.up, spec.down]) {
    srItems.push(`${lane.badge} ${lane.title} — ${lane.note}`)
    for (const node of lane.nodes) srItems.push(node.label)
    srItems.push(`${lane.ending.kind}: ${lane.ending.label}`)
  }

  return (
    <figure className="bt">
      <div className="bt-grid" aria-hidden="true" />

      <svg
        ref={svgRef}
        className={isActive ? "bt-svg is-active" : "bt-svg"}
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="bt-arrow-loop"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 L2.5,5 Z" className="bt-arrow-loop" />
          </marker>
        </defs>

        <g className="bt-fade" style={after(120)}>
          <rect x={8} y={RAIL_Y - 14} width={badgeW} height={28} rx={4} className="bt-live" />
          <text x={8 + badgeW / 2} y={RAIL_Y + 4} textAnchor="middle" className="bt-live-text">
            {spec.badge}
          </text>

          <rect x={badgeW + 20} y={RAIL_Y - 21} width={166} height={42} rx={5} className="bt-pill" />
          <text x={badgeW + 36} y={RAIL_Y + 5} className="bt-pill-text">
            {spec.marker}
          </text>
        </g>

        <path d={`M${RAIL_X1},${RAIL_Y} H${RAIL_X2}`} pathLength={1} className="bt-draw bt-rail" style={after(0)} />

        <g className="bt-fade" style={after(420)}>
          {railDots(nodeXs).map((x) => (
            <circle key={x} cx={x} cy={RAIL_Y} r={1.6} className="bt-rail-dot" />
          ))}
        </g>

        {spec.stages.map((stage, index) => {
          const x = stageXs[index]

          if (index === n - 1) {
            return (
              <Gate
                key={stage}
                x={FORK_X}
                y={RAIL_Y}
                ms={480 + index * 110}
                label={spec.gate}
                stamp={stage}
                stampMs={560 + index * 110}
              />
            )
          }

          return (
            <g key={stage}>
              <RailNode x={x} ms={480 + index * 110} />
              <WrappedText
                x={x}
                y={RAIL_Y + 34}
                text={stage}
                maxChars={12}
                className="bt-stamp bt-fade"
                style={after(560 + index * 110)}
              />
            </g>
          )
        })}

        <Lane lane={spec.up} side="up" />
        <Lane lane={spec.down} side="down" />
      </svg>

      <ol className="bt-sr">
        {srItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>

      <figcaption className="bt-figcaption">{caption}</figcaption>
    </figure>
  )
}
