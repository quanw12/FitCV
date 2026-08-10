import { useCallback, useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

import type { DemoScene } from "./scenes"

export interface UseDemoAutoplayOptions {
  /** Stable scene list; each entry supplies its own play duration. */
  scenes: readonly DemoScene[]
  rootRef: React.RefObject<HTMLElement | null>
}

export interface DemoAutoplay {
  index: number

  /** Bumped on every scene start so CSS choreography can be remounted. */
  runId: number

  /** True whenever the reel is held — by the user, or by scrolling away. */
  isPaused: boolean
  isUserPaused: boolean
  isAutoplayEnabled: boolean
  select: (index: number) => void
  toggleUserPaused: () => void
}

const VISIBILITY_THRESHOLD = 0.4

/* Autoplay is a timer plus a remaining-time budget: pausing banks the unspent
   time so resuming picks up mid-scene instead of restarting it. The CSS
   progress bar pauses on the same render, so the two never drift. */

export default function useDemoAutoplay({
  scenes,
  rootRef,
}: UseDemoAutoplayOptions): DemoAutoplay {
  const [index, setIndex] = useState(0)
  const [runId, setRunId] = useState(0)
  const [isUserPaused, setIsUserPaused] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  /* Guards the write-back in cleanup: a scene that already advanced must not
     have its successor's budget overwritten by the outgoing effect. */
  const tokenRef = useRef(0)
  const remainingRef = useRef(scenes[0]?.duration ?? 0)
  const isAutoplayEnabled = !prefersReducedMotion
  const isPaused = isUserPaused || !isVisible

  useEffect(() => {
    const node = rootRef.current
    if (!node) return

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true)

      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setIsVisible(entry.isIntersecting)
      },
      { threshold: VISIBILITY_THRESHOLD },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [rootRef])

  const goTo = useCallback(
    (next: number) => {
      tokenRef.current += 1
      remainingRef.current = scenes[next]?.duration ?? 0
      setIndex(next)
      setRunId((current) => current + 1)
    },
    [scenes],
  )

  useEffect(() => {
    if (!isAutoplayEnabled || isPaused) return
    const token = tokenRef.current
    const startedAt = performance.now()

    const timer = window.setTimeout(() => {
      goTo((index + 1) % scenes.length)
    }, remainingRef.current)

    return () => {
      window.clearTimeout(timer)
      if (tokenRef.current !== token) return

      remainingRef.current = Math.max(
        0,
        remainingRef.current - (performance.now() - startedAt),
      )
    }
  }, [goTo, index, isAutoplayEnabled, isPaused, runId, scenes])

  const select = useCallback(
    (next: number) => {
      setIsUserPaused(false)
      goTo(next)
    },
    [goTo],
  )

  const toggleUserPaused = useCallback(() => {
    setIsUserPaused((current) => !current)
  }, [])

  return {
    index,
    runId,
    isPaused,
    isUserPaused,
    isAutoplayEnabled,
    select,
    toggleUserPaused,
  }
}
