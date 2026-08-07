import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useRef, type ReactNode } from "react"

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface ScrollMotionProps {
  children: ReactNode
}

const sectionSelector = [
  ".fc-stagger > *",
  ".cv-workspace__routes",
  ".cv-workspace__build",
  ".improvement-sidebar",
  ".improvement-content > *",
  ".cv-history-header",
  ".cv-history-workspace > .fitcv-card",
  ".cv-history-workspace > .fc-bezel",
  ".app-tracker-screen > .tracker-view-tabs",
  ".app-tracker-screen > .tracker-workspace",
  ".fitcv-profile-heading",
  ".fitcv-profile-sidebar",
  ".fitcv-profile-main > *",
].join(", ")

export default function ScrollMotion({ children }: ScrollMotionProps) {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const root = scope.current

    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const scroller = root.closest<HTMLElement>(".fc-app-content") ?? window
    const sections = Array.from(root.querySelectorAll<HTMLElement>(sectionSelector))
    const screenHost = root.firstElementChild
    const screenRoot = screenHost?.firstElementChild ?? screenHost
    const fallbackSections = screenRoot
      ? Array.from(screenRoot.children).filter(
          (element): element is HTMLElement => element instanceof HTMLElement,
        )
      : []
    const uniqueSections = Array.from(new Set([...sections, ...fallbackSections]))
    const headings = Array.from(root.querySelectorAll<HTMLElement>("h1, h2"))

    gsap.set(uniqueSections, { autoAlpha: 0, y: 26 })
    gsap.set(headings, { autoAlpha: 0, y: 14 })

    uniqueSections.forEach((section, index) => {
      gsap.to(section, {
        autoAlpha: 1,
        y: 0,
        duration: 0.68,
        delay: Math.min(index * 0.035, 0.18),
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 88%",
          once: true,
          scroller,
          invalidateOnRefresh: true,
        },
      })
    })

    headings.forEach((heading) => {
      gsap.to(heading, {
        autoAlpha: 1,
        y: 0,
        duration: 0.52,
        ease: "power4.out",
        scrollTrigger: {
          trigger: heading,
          start: "top 91%",
          once: true,
          scroller,
          invalidateOnRefresh: true,
        },
      })
    })

    ScrollTrigger.refresh()
  }, { scope })

  return <div ref={scope} className="fc-motion-scope">{children}</div>
}
