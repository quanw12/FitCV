import { MagnifyingGlass, Bell } from "@phosphor-icons/react"

interface Props {
  userName: string
  userAvatarUrl?: string | null
  onSearchFocus?: () => void
  onUserMenuClick?: () => void
}

export default function FloatingTopbar({
  userName,
  userAvatarUrl,
  onSearchFocus,
  onUserMenuClick,
}: Props) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header
      className="fc-glass"
      style={{
        margin: "8px 16px 0",
        borderRadius: "var(--r-lg)",
        height: "var(--topbar-h)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 18px",
        flexShrink: 0,
        position: "relative",
        zIndex: 20,
      }}
    >
      <div
        className="fc-search"
        style={{ flex: 1, maxWidth: 360 }}
        onClick={onSearchFocus}
      >
        <MagnifyingGlass size={16} weight="light" color="var(--text-muted)" />
        <input
          type="search"
          placeholder="Search candidates, jobs, insights…"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontFamily: "inherit",
            fontSize: 14,
            width: "100%",
          }}
          onFocus={onSearchFocus}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginLeft: "auto",
        }}
      >
        <button
          type="button"
          className="fc-icon-btn"
          aria-label="Notifications"
        >
          <Bell size={18} weight="light" />
        </button>

        <button
          type="button"
          className="fc-icon-btn"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
          aria-label="User menu"
          onClick={onUserMenuClick}
        >
          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
              alt={userName}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              className="fc-avatar"
              style={{ width: 30, height: 30, fontSize: 11 }}
            >
              {initials}
            </span>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {userName}
          </span>
        </button>
      </div>
    </header>
  )
}
