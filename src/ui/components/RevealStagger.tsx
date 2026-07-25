import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}

export default function RevealStagger({
  children,
  className = "",
  delay = 0,
  y = 40,
}: Props) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
