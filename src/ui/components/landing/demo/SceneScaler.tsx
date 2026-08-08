import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

interface SceneScalerProps {
  children: ReactNode
  className?: string
}

/**
 * Measures its child's natural size and applies `transform: scale()` so the
 * child fits inside the parent container. Scale is clamped to ≤ 1 — the
 * child is never放大, only scaled down when it overflows.
 */
export default function SceneScaler({ children, className }: SceneScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const measure = useCallback(() => {
    const container = containerRef.current
    const scene = sceneRef.current
    if (!container || !scene) return

    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const sceneW = scene.scrollWidth
    const sceneH = scene.scrollHeight

    if (sceneW === 0 || sceneH === 0) return

    const next = Math.min(containerW / sceneW, containerH / sceneH, 1)
    setScale((prev) => (prev === next ? prev : next))
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [measure])

  return (
    <div ref={containerRef} className={className}>
      <div
        ref={sceneRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  )
}
