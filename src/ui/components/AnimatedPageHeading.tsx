import { motion } from "framer-motion"

interface AnimatedPageHeadingProps {
  title: string
  subtitle?: string
}

export default function AnimatedPageHeading({
  title,
  subtitle,
}: AnimatedPageHeadingProps) {
  const words = title.split(" ")

  return (
    <div style={{ marginBottom: 26 }}>
      <h1
        style={{
          fontSize: 27,
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.1,
          marginBottom: subtitle ? 5 : 0,
          overflow: "hidden",
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
            }}
          >
            <motion.span
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{
                duration: 0.5,
                delay: i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ display: "inline-block" }}
            >
              {word}
              {i < words.length - 1 ? "\u00A0" : ""}
            </motion.span>
          </span>
        ))}
      </h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ color: "var(--text-secondary)", fontSize: 14.5, margin: 0 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}
