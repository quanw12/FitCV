import { useEffect, useRef, useState } from "react"

interface AnimatedNumberProps {
  value: number
  duration?: number
  suffix?: string
  delay?: number
}

export default function AnimatedNumber({
  value,
  duration = 600,
  suffix = "",
  delay = 0,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const raf = useRef<number>(0)

  useEffect(() => {
    const startDelay = setTimeout(() => {
      const from = 0
      const range = value - from

      const tick = (now: number) => {
        if (!startTime.current) startTime.current = now
        const elapsed = now - startTime.current
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplay(Math.round(from + range * eased))
        if (progress < 1) raf.current = requestAnimationFrame(tick)
      }

      raf.current = requestAnimationFrame(tick)
    }, delay)

    return () => {
      clearTimeout(startDelay)
      cancelAnimationFrame(raf.current)
      startTime.current = null
    }
  }, [value, duration, delay])

  return (
    <span className="fc-stat__value">{display}{suffix}</span>
  )
}
