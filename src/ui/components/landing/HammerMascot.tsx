import { useEffect, useRef } from "react"

import type { RefObject } from "react"

import MascotArt from "./MascotArt"

const VIEW_W = 264
const VIEW_H = 200
const SPRITE_RATIO = VIEW_W / VIEW_H

/* These mirror the keyframes in landing.css and have to move together.

   The character is front-facing, boots side by side, so there is no stride to
   derive a ground speed from — a side-view walker plants a boot and pushes off
   it, this one waddles. So the speed is stated outright, in sprite heights per
   second, which keeps it tied to the rendered size rather than to one of them. */

const WALK_HEIGHTS_PER_SEC = 2.2
const SWING_MS = 1000

/* 40% of the swing, the frame the white face bites the ground. */
const SWING_IMPACT_MS = 400

/* Where the head lands at the bottom of the swing, across the sprite box. The
   arc runs clockwise from overhead down across the front of the body, so the
   blow lands on the character's own right rather than behind it. */

const HAMMER_X_RATIO = 0.545

/* The pointer leads the torso, not the sprite box, because the hammer hangs
   well off to one side and centring on it makes the character trail behind. */

const BODY_X_RATIO = 0.568
const ARRIVE_EPSILON = 1.5
const STRIKE_HOLD_MS = 110

export interface HammerMascotProps {
  height?: number
  stageRef: RefObject<HTMLElement | null>
  hammerTargets?: Array<RefObject<HTMLElement | null>>
  hue?: number
}

export default function HammerMascot({
  height = 100,
  stageRef,
  hammerTargets = [],
  hue = 0,
}: HammerMascotProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<SVGSVGElement>(null)
  const targetsRef = useRef(hammerTargets)
  targetsRef.current = hammerTargets

  useEffect(() => {
    const sprite = spriteRef.current
    if (!sprite) return
    sprite.style.filter = hue === 0 ? "none" : `hue-rotate(${hue}deg)`
  }, [hue])

  useEffect(() => {
    const track = trackRef.current
    const body = bodyRef.current
    const sprite = spriteRef.current
    if (!track || !body || !sprite) return
    const spriteWidth = height * SPRITE_RATIO
    const travel = () => Math.max(track.clientWidth - spriteWidth, 0)
    let offset = travel() / 2
    let target = offset
    body.style.transform = `translate3d(${offset.toFixed(2)}px,0,0)`
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const walkPxPerSec = height * WALK_HEIGHTS_PER_SEC
    const stage = stageRef.current
    let facing: "right" | "left" = "right"

    /* Starts true so the first tick reads as a drop into idle and starts the
       swing clock, rather than standing frozen until the pointer moves. */

    let walking = true
    let swingClock = 0
    let hasStruck = false
    let previous = performance.now()
    let rafId = 0

    const onPointerMove = (event: PointerEvent) => {
      const box = track.getBoundingClientRect()
      const wanted = event.clientX - box.left - BODY_X_RATIO * spriteWidth
      target = Math.min(Math.max(wanted, 0), travel())
    }

    const strike = () => {
      const ratio = facing === "right" ? HAMMER_X_RATIO : 1 - HAMMER_X_RATIO
      const hammerX =
        track.getBoundingClientRect().left + offset + ratio * spriteWidth

      for (const entry of targetsRef.current) {
        const element = entry.current
        if (!element) continue
        const box = element.getBoundingClientRect()
        if (hammerX < box.left || hammerX > box.right) continue
        element.classList.add("is-hammered")

        window.setTimeout(
          () => element.classList.remove("is-hammered"),
          STRIKE_HOLD_MS,
        )
      }
    }

    const step = (now: number) => {
      const delta = Math.min(now - previous, 64)
      previous = now
      const distance = target - offset
      const isWalking = Math.abs(distance) > ARRIVE_EPSILON

      if (isWalking) {
        const stride = walkPxPerSec * (delta / 1000)
        offset += Math.sign(distance) * Math.min(stride, Math.abs(distance))
        facing = distance > 0 ? "right" : "left"
        sprite.classList.toggle("is-left", facing === "left")
        body.style.transform = `translate3d(${offset.toFixed(2)}px,0,0)`
      }

      /* Crossing between walking and standing hands the sprite over to the
         other set of keyframes, so it never lands mid-stride or mid-swing. */

      if (isWalking !== walking) {
        walking = isWalking
        body.classList.toggle("is-idle", !isWalking)
        swingClock = 0
        hasStruck = false
      }

      if (!isWalking) {
        /* The keyframes drive the hammer; the loop only has to land the blow
           on the beat the head reaches the ground. */

        swingClock += delta

        if (!hasStruck && swingClock >= SWING_IMPACT_MS) {
          hasStruck = true
          strike()
        }

        if (swingClock >= SWING_MS) {
          swingClock -= SWING_MS
          hasStruck = false
        }
      }

      rafId = window.requestAnimationFrame(step)
    }

    rafId = window.requestAnimationFrame(step)
    stage?.addEventListener("pointermove", onPointerMove)

    return () => {
      window.cancelAnimationFrame(rafId)
      stage?.removeEventListener("pointermove", onPointerMove)
    }
  }, [height, stageRef])

  return (
    <div
      ref={trackRef}
      className="lp-mascot-track"
      style={{ height }}
      aria-hidden="true"
    >
      {/* Mounts already idle so the swing runs from the first paint instead of
          waiting for the loop to notice the pointer has not moved. */}

      <div ref={bodyRef} className="lp-mascot-body is-idle">
        <svg
          ref={spriteRef}
          className="lp-mascot-sprite"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width={Math.round(height * SPRITE_RATIO)}
          height={height}
          focusable="false"
        >
          <MascotArt />
        </svg>
      </div>
    </div>
  )
}
