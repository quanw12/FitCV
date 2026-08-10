import { useRef, useState, type CSSProperties, type RefObject } from "react"
import { ArrowRight, ChartBar } from "@phosphor-icons/react"

import HammerMascot from "./HammerMascot"

import "./hero-stage.css"

interface HeroTag {
  label: string
  color: string

  /* Rotation from the sprite's own green (#6ee7b7, hue 160) onto the tag colour. */
  hue: number
}

const TAGS: HeroTag[] = [
  { label: "Skills", color: "#6ee7b7", hue: 0 },
  { label: "Experience", color: "#ff8a3d", hue: 226 },
  { label: "Education", color: "#22d3ee", hue: 32 },
  { label: "Soft skills", color: "#f472b6", hue: 173 },
  { label: "Summary", color: "#a78bfa", hue: 101 },
  { label: "Certifications", color: "#facc15", hue: 250 },
  { label: "Job description", color: "#818cf8", hue: 75 },
  { label: "PDF", color: "#ff6b6b", hue: 203 },
  { label: "DOCX", color: "#60a5fa", hue: 56 },
]

interface HeroStageProps {
  onGetStarted: () => void
}

export default function HeroStage({ onGetStarted }: HeroStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const secondaryRef = useRef<HTMLAnchorElement>(null)

  /* The picked colour sticks until another tag is picked, so the mascot keeps
     the last tag's hue after the pointer leaves the strip. */

  const [activeTag, setActiveTag] = useState<string | null>(null)

  const hammerTargets: Array<RefObject<HTMLElement | null>> = [
    primaryRef,
    secondaryRef,
  ]

  const hue = TAGS.find((tag) => tag.label === activeTag)?.hue ?? 0

  /* The strip renders twice so the marquee can loop seamlessly. The second copy
     is hidden from assistive tech and taken out of the tab order. */

  const renderTag = (tag: HeroTag, isClone: boolean) => {
    const isActive = tag.label === activeTag

    return (
      <li key={`${isClone ? "clone" : "tag"}-${tag.label}`}>
        <button
          type="button"
          className={isActive ? "lp-tag is-active" : "lp-tag"}
          style={{ "--lp-tag": tag.color } as CSSProperties}
          tabIndex={isClone ? -1 : undefined}
          aria-pressed={isClone ? undefined : isActive}
          onPointerEnter={() => setActiveTag(tag.label)}
          onFocus={() => setActiveTag(tag.label)}
          onClick={() => setActiveTag(tag.label)}
        >
          <span className="lp-tag-dot" aria-hidden="true" />
          {tag.label}
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="lp-hs" ref={stageRef}>
        <div className="lp-hs-stage">
          <div className="lp-hs-mount">
            <HammerMascot
              height={100}
              stageRef={stageRef}
              hammerTargets={hammerTargets}
              hue={hue}
            />
          </div>

          <div className="lp-hs-buttons">
            <button
              type="button"
              ref={primaryRef}
              className="lp-btn lp-btn-primary"
              onClick={onGetStarted}
            >
              Analyze my CV
              <ArrowRight size={16} weight="bold" />
            </button>

            <a
              ref={secondaryRef}
              href="#seekers"
              className="lp-btn lp-btn-outline"
            >
              See how it works
            </a>
          </div>
        </div>

        <a className="lp-hs-note" href="#seekers">
          <ChartBar size={14} weight="bold" />
          See how the four category scores are built
        </a>
      </div>

      <div className="lp-hero-foot">
        <span className="lp-tagline-label">Reads and scores</span>

        <span className="lp-tagline-rule" aria-hidden="true" />

        <div className="lp-tagline">
          <div className="lp-tagline-track">
            <ul className="lp-tagline-set">
              {TAGS.map((tag) => renderTag(tag, false))}
            </ul>

            <ul className="lp-tagline-set" aria-hidden="true">
              {TAGS.map((tag) => renderTag(tag, true))}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
