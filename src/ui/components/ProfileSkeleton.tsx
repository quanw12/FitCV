export default function ProfileSkeleton() {
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div className="fc-skeleton" style={{ width: "45%", height: 30, borderRadius: 8, marginBottom: 10 }} />
        <div className="fc-skeleton" style={{ width: "55%", height: 16, borderRadius: 6 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 20 }}>
        <aside style={{ display: "grid", alignContent: "start", gap: 16 }}>
          <div className="fc-skeleton--card" style={{ padding: 20, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="fc-skeleton" style={{ width: 88, height: 88, borderRadius: 20, margin: "0 auto 14px" }} />
            <div className="fc-skeleton" style={{ width: "60%", height: 16, borderRadius: 6, margin: "0 auto 6px" }} />
            <div className="fc-skeleton" style={{ width: "40%", height: 13, borderRadius: 6, margin: "0 auto" }} />
          </div>
          <div className="fc-skeleton--card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ marginTop: i === 1 ? 0 : 11 }}>
                <div className="fc-skeleton" style={{ width: "35%", height: 11, borderRadius: 4, marginBottom: 5 }} />
                <div className="fc-skeleton" style={{ width: "70%", height: 13, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </aside>

        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ padding: "4px 2px" }}>
            <div className="fc-skeleton" style={{ width: "30%", height: 17, borderRadius: 6, marginBottom: 18 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="fc-skeleton" style={{ width: "40%", height: 12, borderRadius: 4, marginBottom: 7 }} />
                <div className="fc-skeleton" style={{ width: "100%", height: 40, borderRadius: 10 }} />
              </div>
              <div>
                <div className="fc-skeleton" style={{ width: "40%", height: 12, borderRadius: 4, marginBottom: 7 }} />
                <div className="fc-skeleton" style={{ width: "100%", height: 40, borderRadius: 10 }} />
              </div>
            </div>
          </div>
          <div className="fc-skeleton--card" style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="fc-skeleton" style={{ width: "25%", height: 17, borderRadius: 6, marginBottom: 18 }} />
            <div className="fc-skeleton" style={{ width: "100%", height: 56, borderRadius: 12 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div className="fc-skeleton" style={{ width: 140, height: 40, borderRadius: 10 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
