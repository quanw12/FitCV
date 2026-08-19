/**
 * Minimal gate loader for the short period where HR company-profile access is
 * still unresolved. Authenticated route navigation must render the actual
 * screen immediately and must not use this as a page-level fallback.
 */
export function ContentAreaLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
        color: "var(--text-secondary)",
        fontSize: 13,
        gap: 10,
      }}
      aria-live="polite"
    >
      <span
        className="fitcv-spin"
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          borderTopColor: "var(--accent, var(--text-secondary))",
          animation: "fc-spin 0.8s linear infinite",
          display: "inline-block",
        }}
      />
      Loading…
    </div>
  )
}

export default function FullPageSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 28,
      }}
    >
      <div
        className="fc-skeleton"
        style={{ width: "40%", height: 28, borderRadius: 8 }}
      />
      <div
        className="fc-skeleton"
        style={{ width: "60%", height: 16, borderRadius: 8 }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginTop: 12,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="fc-skeleton fc-skeleton--card" />
        ))}
      </div>
    </div>
  )
}
