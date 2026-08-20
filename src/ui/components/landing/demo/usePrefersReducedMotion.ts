import { useEffect, useState } from "react"

/* Landing-local reduced-motion reader, so the landing chunk does not pull
   framer-motion in for this single hook. Mirrors HammerMascot's check. */

const QUERY = "(prefers-reduced-motion: reduce)"

export default function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)

    query.addEventListener("change", onChange)

    return () => query.removeEventListener("change", onChange)
  }, [])

  return reduced
}
