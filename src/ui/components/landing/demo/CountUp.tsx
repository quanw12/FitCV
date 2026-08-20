import { useEffect, useRef } from "react"

import usePrefersReducedMotion from "./usePrefersReducedMotion"

export interface CountUpProps {
  to: number
  from?: number

  /** Milliseconds of scene time to wait before the count starts. */
  delay?: number
  duration?: number
  suffix?: string

  /** Freezes the count where it is; released when the scene resumes. */
  paused?: boolean
}

const EASE_EXPONENT = 3

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, EASE_EXPONENT)
}

/* Counts by writing textContent inside rAF rather than through state, so a
   running number never re-renders the scene around it. */

export default function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 900,
  suffix = "",
  paused = false,
}: CountUpProps) {
  const nodeRef = useRef<HTMLSpanElement>(null)
  const elapsedRef = useRef(0)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    if (prefersReducedMotion) {
      node.textContent = `${to}${suffix}`

      return
    }

    if (paused) return
    let frame = 0
    let last = performance.now()

    const render = (value: number) => {
      node.textContent = `${Math.round(value)}${suffix}`
    }

    const tick = (now: number) => {
      elapsedRef.current += now - last
      last = now

      const progress = Math.min(
        1,
        Math.max(0, (elapsedRef.current - delay) / duration),
      )

      render(from + (to - from) * easeOut(progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    render(from)
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [delay, duration, from, paused, prefersReducedMotion, suffix, to])

  return (
    <span ref={nodeRef} className="lpd-count">
      {from}
      {suffix}
    </span>
  )
}
