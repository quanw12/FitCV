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
