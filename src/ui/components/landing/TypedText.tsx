import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface WordCycleProps {
  words: string[]
  className?: string
  cursorClassName?: string
}

export default function TypedText({
  words,
  className = "",
  cursorClassName = "",
}: WordCycleProps) {
  const [wordIndex, setWordIndex] = useState(0)
  const [phase, setPhase] = useState<"typing" | "waiting" | "deleting">(
    "typing",
  )
  const [display, setDisplay] = useState("")

  useEffect(() => {
    const current = words[wordIndex] ?? ""

    let interval: ReturnType<typeof setInterval>

    if (phase === "typing") {
      let i = 0
      interval = setInterval(() => {
        i++
        setDisplay(current.slice(0, i))
        if (i >= current.length) {
          clearInterval(interval)
          setPhase("waiting")
        }
      }, 60)
    } else if (phase === "waiting") {
      interval = setInterval(() => {
        clearInterval(interval)
        setPhase("deleting")
      }, 2000)
    } else if (phase === "deleting") {
      let i = current.length
      interval = setInterval(() => {
        i--
        setDisplay(current.slice(0, i))
        if (i <= 0) {
          clearInterval(interval)
          setPhase("typing")
          setWordIndex((prev) => (prev + 1) % words.length)
        }
      }, 30)
    }

    return () => clearInterval(interval)
  }, [phase, wordIndex, words])

  return (
    <span className={className}>
      {display}
      <motion.span
        className={cursorClassName}
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
      >
        |
      </motion.span>
    </span>
  )
}
