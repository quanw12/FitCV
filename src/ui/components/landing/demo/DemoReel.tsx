import { useId, useRef, type KeyboardEvent, type ReactNode } from "react"
import { Pause, Play } from "@phosphor-icons/react"

import useDemoAutoplay from "./useDemoAutoplay"
import SceneScaler from "./SceneScaler"
import type { DemoScene, SceneProps } from "./scenes"
import { cssVars } from "./vars"

/** Scene component per `DemoScene.key`. */
export type SceneViews = Record<string, (props: SceneProps) => ReactNode>

export interface DemoReelProps {
  /** Stable play order; each entry supplies its own duration and copy. */
  scenes: readonly DemoScene[]
  views: SceneViews

  /** Accessible name for the rail, e.g. "Product preview". */
  label: string
}

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"])
const PREV_KEYS = new Set(["ArrowUp", "ArrowLeft"])

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}

/* A reel rather than a tab strip: each scene plays its own choreography, the
   rail fills a progress line while it runs, and the next one takes over. It
   keeps playing under the cursor — only the pause button or scrolling away
   holds it. The shell is content-free so a second reel can script a different
   surface without duplicating the window, rail or autoplay wiring. */

export default function DemoReel({ scenes, views, label }: DemoReelProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()

  const {
    index,
    runId,
    isPaused,
    isUserPaused,
    isAutoplayEnabled,
    select,
    toggleUserPaused,
  } = useDemoAutoplay({ scenes, rootRef })

  const scene = scenes[index]
  const Scene = views[scene.key]

  const handleRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = scenes.length - 1
    let next = -1
    if (NEXT_KEYS.has(event.key)) next = index === last ? 0 : index + 1
    else if (PREV_KEYS.has(event.key)) next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next < 0) return
    event.preventDefault()
    select(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div ref={rootRef} className={isPaused ? "lpd is-paused" : "lpd"}>
      <div
        className="lpd-rail"
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={handleRailKeyDown}
      >
        {scenes.map((item, itemIndex) => {
          const isActive = itemIndex === index

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.key}`}
              ref={(node) => {
                tabRefs.current[itemIndex] = node
              }}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel`}
              tabIndex={isActive ? 0 : -1}
              className={isActive ? "lpd-rail-item is-active" : "lpd-rail-item"}
              onClick={() => select(itemIndex)}
            >
              <span className="lpd-rail-head">
                <span className="lpd-rail-index" aria-hidden="true">
                  {pad(itemIndex + 1)}
                </span>
                {item.label}
              </span>

              <span className="lpd-rail-body">
                <span className="lpd-rail-copy">{item.copy}</span>
              </span>

              <span className="lpd-rail-track" aria-hidden="true">
                {isActive ? (
                  <i
                    key={runId}
                    className="lpd-rail-fill"
                    style={cssVars({ "--lpd-dur": `${item.duration}ms` })}
                  />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      <div
        className="lpd-window"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${scene.key}`}
        tabIndex={0}
      >
        <div className="lpd-chrome">
          <span className="lpd-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>

          <span className="lpd-path" aria-hidden="true">
            fitcv <span className="lpd-path-sep">/</span> {scene.path}
          </span>

          <span className="lpd-live" aria-hidden="true">
            <i className="lpd-live-dot" />
            {isPaused ? "paused" : "live"}
          </span>
        </div>

        <div className="lpd-stage">
          <span className="lpd-stage-grid" aria-hidden="true" />
          <span className="lpd-stage-glow" aria-hidden="true" />

          <SceneScaler className="lpd-scene-scaler">
            <Scene key={`${scene.key}-${runId}`} paused={isPaused} />
          </SceneScaler>
        </div>

        <div className="lpd-foot">
          {isAutoplayEnabled ? (
            <button
              type="button"
              className="lpd-toggle"
              onClick={toggleUserPaused}
              aria-pressed={isUserPaused}
            >
              {isUserPaused ? (
                <Play size={12} weight="fill" />
              ) : (
                <Pause size={12} weight="fill" />
              )}

              {isUserPaused ? "Play" : "Pause"}
            </button>
          ) : null}

          <span className="lpd-foot-status">{scene.status}</span>

          <span className="lpd-foot-count" aria-hidden="true">
            {pad(index + 1)} / {pad(scenes.length)}
          </span>
        </div>
      </div>
    </div>
  )
}
