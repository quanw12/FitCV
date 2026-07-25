import { motion, type HTMLMotionProps } from "framer-motion"
import { useRef, useState, type ReactNode } from "react"

interface SpotlightCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode
}

export default function SpotlightCard({ children, ...props }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: "50%", y: "50%" })
  const [hovered, setHovered] = useState(false)

  const handleMouse = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      x: `${((e.clientX - rect.left) / rect.width) * 100}%`,
      y: `${((e.clientY - rect.top) / rect.height) * 100}%`,
    })
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        overflow: "hidden",
        ...(props.style || {}),
      }}
      {...props}
    >
      {hovered && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(280px circle at ${pos.x} ${pos.y}, rgba(255,255,255,0.10), transparent)`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </motion.div>
  )
}
