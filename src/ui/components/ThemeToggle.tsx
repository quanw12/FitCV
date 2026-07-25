import { useEffect, useState } from "react"
import { Sun, Moon } from "@phosphor-icons/react"
import { toggleTheme, resolveTheme, type Theme } from "@/services/theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (!localStorage.getItem("fitcv-theme")) {
        const sys = mq.matches ? "dark" : "light"
        setTheme(sys)
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const handle = () => {
    const next = toggleTheme()
    setTheme(next)
  }

  return (
    <button
      type="button"
      className="fc-icon-btn"
      onClick={handle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun size={18} weight="light" /> : <Moon size={18} weight="light" />}
    </button>
  )
}
