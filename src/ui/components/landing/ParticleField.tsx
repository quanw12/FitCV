import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  baseAlpha: number
}

export default function ParticleField({
  accent = "124, 58, 237",
  count = 80,
}: {
  accent?: string
  count?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let mouseX = -9999
    let mouseY = -9999
    let particles: Particle[] = []

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function initParticles() {
      if (!canvas) return
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        baseAlpha: Math.random() * 0.5 + 0.2,
      }))
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const repelRadius = 120

        if (dist < repelRadius && dist > 0) {
          const force = (repelRadius - dist) / repelRadius
          p.vx -= (dx / dist) * force * 0.02
          p.vy -= (dy / dist) * force * 0.02
          p.vx *= 0.98
          p.vy *= 0.98
        }

        const maxSpeed = 0.6
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > maxSpeed) {
          p.vx = (p.vx / spd) * maxSpeed
          p.vy = (p.vy / spd) * maxSpeed
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${accent}, ${p.alpha})`
        ctx.fill()
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = dx * dx + dy * dy
          const maxDist = 150

          if (dist < maxDist * maxDist) {
            const alpha = (1 - Math.sqrt(dist) / maxDist) * 0.15
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(${accent}, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    function onMouse(e: MouseEvent) {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    function onLeave() {
      mouseX = -9999
      mouseY = -9999
    }

    resize()
    initParticles()
    draw()

    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMouse)
    document.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouse)
      document.removeEventListener("mouseleave", onLeave)
    }
  }, [accent, count])

  return (
    <canvas
      ref={canvasRef}
      className="particle-field"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  )
}
