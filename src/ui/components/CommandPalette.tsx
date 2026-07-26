import { useEffect, useState, useCallback, useRef } from "react"
import { MagnifyingGlass, X } from "@phosphor-icons/react"
import type { Portal, ScreenId } from "@/types/app"

interface Item {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
}

interface Props {
  portal: Portal | null
  isOpen: boolean
  onClose: () => void
  onNavigate: (screen: ScreenId) => void
}

function screenItems(
  portal: Portal | null,
  onNavigate: (screen: ScreenId) => void,
): Item[] {
  if (portal === "seeker") {
    return [
      {
        id: "seeker-dashboard",
        label: "Dashboard",
        icon: null,
        action: () => onNavigate("seeker-dashboard"),
      },
      {
        id: "analyzer",
        label: "Match Analyzer",
        icon: null,
        action: () => onNavigate("analyzer"),
      },
      {
        id: "improvement",
        label: "Improvement Tips",
        icon: null,
        action: () => onNavigate("improvement"),
      },
      {
        id: "cv-history",
        label: "CV History",
        icon: null,
        action: () => onNavigate("cv-history"),
      },
      {
        id: "app-tracker",
        label: "Application Tracker",
        icon: null,
        action: () => onNavigate("app-tracker"),
      },
      {
        id: "jd-library",
        label: "JD Library",
        icon: null,
        action: () => onNavigate("jd-library"),
      },
      {
        id: "profile",
        label: "Profile",
        icon: null,
        action: () => onNavigate("profile"),
      },
    ]
  }
  if (portal === "hr") {
    return [
      {
        id: "hr-dashboard",
        label: "Dashboard",
        icon: null,
        action: () => onNavigate("hr-dashboard"),
      },
      {
        id: "job-posts",
        label: "Job Posts",
        icon: null,
        action: () => onNavigate("job-posts"),
      },
      {
        id: "cv-ranking",
        label: "CV Ranking",
        icon: null,
        action: () => onNavigate("cv-ranking"),
      },
      {
        id: "pipeline",
        label: "Pipeline",
        icon: null,
        action: () => onNavigate("pipeline"),
      },
      {
        id: "auto-email",
        label: "Auto Email",
        icon: null,
        action: () => onNavigate("auto-email"),
      },
      {
        id: "reports",
        label: "Reports",
        icon: null,
        action: () => onNavigate("reports"),
      },
      {
        id: "hr-settings",
        label: "Settings",
        icon: null,
        action: () => onNavigate("hr-settings"),
      },
    ]
  }
  return []
}

export default function CommandPalette({
  portal,
  isOpen,
  onClose,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = screenItems(portal, onNavigate).filter(
    (item) => !query || item.label.toLowerCase().includes(query.toLowerCase()),
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === "Enter" && items[selectedIndex]) {
        items[selectedIndex].action()
        onClose()
      }
    },
    [items, selectedIndex, onClose],
  )

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Palette card */}
      <div
        className="fc-glass"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <MagnifyingGlass size={18} weight="light" color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: 15,
              width: "100%",
            }}
          />
          <button
            type="button"
            className="fc-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} weight="light" />
          </button>
        </div>

        <div style={{ maxHeight: 300, overflowY: "auto", padding: 6 }}>
          {items.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              No results for &quot;{query}&quot;
            </div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.action()
                onClose()
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background:
                  idx === selectedIndex ? "var(--accent-soft)" : "transparent",
                color:
                  idx === selectedIndex
                    ? "var(--accent-ink)"
                    : "var(--text-primary)",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <span>&uarr;&darr; Navigate</span>
          <span>&crarr; Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
