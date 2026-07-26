function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`fc-skeleton ${className || ""}`} style={style} />
}

function SkeletonCard({
  style,
  children,
}: {
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <div
      className="fc-skeleton--card"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: 22,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Pulse({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  return (
    <div style={{ animation: `fc-fade-in 0.5s ease ${delay}s both` }}>
      {children}
    </div>
  )
}

export function AnalyzerSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "35%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "45%", height: 15, borderRadius: 6 }} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        <SkeletonCard style={{ minHeight: 260 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 16,
              borderRadius: 6,
              marginBottom: 16,
            }}
          />
          <Skeleton
            style={{
              width: "100%",
              height: 140,
              borderRadius: 12,
              marginBottom: 12,
            }}
          />
          <Skeleton style={{ width: "60%", height: 14, borderRadius: 6 }} />
        </SkeletonCard>
        <SkeletonCard style={{ minHeight: 260 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 16,
              borderRadius: 6,
              marginBottom: 16,
            }}
          />
          <Skeleton style={{ width: "100%", height: 180, borderRadius: 12 }} />
        </SkeletonCard>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <Skeleton style={{ width: 200, height: 44, borderRadius: 10 }} />
      </div>
    </div>
  )
}

export function CVHistorySkeleton() {
  return (
    <div>
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "25%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "40%", height: 15, borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Skeleton style={{ width: 100, height: 40, borderRadius: 10 }} />
          <Skeleton style={{ width: 160, height: 40, borderRadius: 10 }} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 160 }}>
            <Skeleton
              style={{
                width: "70%",
                height: 16,
                borderRadius: 6,
                marginBottom: 10,
              }}
            />
            <Skeleton
              style={{
                width: "50%",
                height: 13,
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <Skeleton
              style={{
                width: "40%",
                height: 24,
                borderRadius: 999,
                marginBottom: 12,
              }}
            />
            <Skeleton style={{ width: "100%", height: 7, borderRadius: 99 }} />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard style={{ minHeight: 200 }}>
        <Skeleton
          style={{
            width: "30%",
            height: 17,
            borderRadius: 6,
            marginBottom: 16,
          }}
        />
        <Skeleton style={{ width: "100%", height: 140, borderRadius: 12 }} />
      </SkeletonCard>
    </div>
  )
}

export function ImprovementSkeleton() {
  return (
    <div className="improvement-layout">
      <aside className="fc-card improvement-sidebar">
        <Skeleton
          style={{
            width: "50%",
            height: 11,
            borderRadius: 4,
            marginBottom: 14,
          }}
        />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            style={{
              width: "70%",
              height: 14,
              borderRadius: 6,
              marginBottom: 6,
            }}
          />
        ))}
        <div style={{ marginTop: 16 }}>
          <Skeleton style={{ width: "80%", height: 50, borderRadius: 11 }} />
        </div>
      </aside>
      <main>
        <div className="improvement-header">
          <div>
            <Skeleton
              style={{
                width: "40%",
                height: 12,
                borderRadius: 4,
                marginBottom: 6,
              }}
            />
            <Skeleton style={{ width: "55%", height: 24, borderRadius: 8 }} />
          </div>
        </div>
        <div className="improvement-disclaimer">
          <Skeleton
            style={{ width: 20, height: 20, borderRadius: 10, flexShrink: 0 }}
          />
          <Skeleton style={{ width: "85%", height: 14, borderRadius: 6 }} />
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={{ marginBottom: 18, minHeight: 80 }}>
            <Skeleton
              style={{
                width: "35%",
                height: 17,
                borderRadius: 6,
                marginBottom: 12,
              }}
            />
            <Skeleton
              style={{
                width: "100%",
                height: 13,
                borderRadius: 6,
                marginBottom: 6,
              }}
            />
            <Skeleton style={{ width: "80%", height: 13, borderRadius: 6 }} />
          </SkeletonCard>
        ))}
      </main>
    </div>
  )
}

export function JDLibrarySkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "25%",
              height: 11,
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <Skeleton
            style={{
              width: "40%",
              height: 28,
              borderRadius: 8,
              marginBottom: 6,
            }}
          />
          <Skeleton style={{ width: "50%", height: 15, borderRadius: 6 }} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 90 }}>
            <Skeleton
              style={{
                width: "40%",
                height: 24,
                borderRadius: 6,
                marginBottom: 6,
              }}
            />
            <Skeleton style={{ width: "60%", height: 13, borderRadius: 6 }} />
          </SkeletonCard>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Skeleton style={{ flex: 1, height: 40, borderRadius: 10 }} />
        <Skeleton style={{ width: 160, height: 40, borderRadius: 10 }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 16,
        }}
      >
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 140 }}>
            <Skeleton
              style={{
                width: "75%",
                height: 16,
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <Skeleton
              style={{
                width: "45%",
                height: 13,
                borderRadius: 6,
                marginBottom: 12,
              }}
            />
            <Skeleton style={{ width: "30%", height: 24, borderRadius: 999 }} />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

export function JobPostsSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "15%",
              height: 11,
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "35%", height: 28, borderRadius: 8 }} />
        </div>
      </div>
      <SkeletonCard style={{ marginBottom: 24 }}>
        <Skeleton
          style={{
            width: "30%",
            height: 17,
            borderRadius: 6,
            marginBottom: 16,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <Skeleton
                style={{
                  width: "50%",
                  height: 12,
                  borderRadius: 4,
                  marginBottom: 6,
                }}
              />
              <Skeleton
                style={{ width: "100%", height: 40, borderRadius: 10 }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          {[1, 2].map((i) => (
            <div key={i}>
              <Skeleton
                style={{
                  width: "40%",
                  height: 12,
                  borderRadius: 4,
                  marginBottom: 6,
                }}
              />
              <Skeleton
                style={{ width: "100%", height: 100, borderRadius: 10 }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Skeleton style={{ width: 120, height: 40, borderRadius: 10 }} />
          <Skeleton style={{ width: 120, height: 40, borderRadius: 10 }} />
        </div>
      </SkeletonCard>
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 90 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <Skeleton
                  style={{
                    width: "55%",
                    height: 16,
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                />
                <Skeleton
                  style={{ width: "35%", height: 13, borderRadius: 6 }}
                />
              </div>
              <Skeleton style={{ width: 80, height: 24, borderRadius: 999 }} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

export function BulkRankingSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "20%",
              height: 11,
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "35%", height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: "45%", height: 15, borderRadius: 6 }} />
        </div>
      </div>
      <SkeletonCard style={{ marginBottom: 20 }}>
        <Skeleton
          style={{
            width: "25%",
            height: 17,
            borderRadius: 6,
            marginBottom: 16,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))",
            gap: 18,
          }}
        >
          <div>
            <Skeleton
              style={{
                width: "40%",
                height: 12,
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <Skeleton
              style={{ width: "100%", height: 180, borderRadius: 12 }}
            />
          </div>
          <div>
            <Skeleton
              style={{
                width: "40%",
                height: 12,
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 12,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Skeleton style={{ width: 48, height: 48, borderRadius: 12 }} />
              <Skeleton style={{ width: "60%", height: 14, borderRadius: 6 }} />
              <Skeleton style={{ width: "40%", height: 13, borderRadius: 6 }} />
            </div>
          </div>
        </div>
      </SkeletonCard>
    </div>
  )
}

export function ApplicantsRankingSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "18%",
              height: 11,
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "30%", height: 28, borderRadius: 8 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Skeleton style={{ width: 160, height: 38, borderRadius: 10 }} />
          <Skeleton style={{ width: 100, height: 38, borderRadius: 10 }} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px,1fr) repeat(4,minmax(90px,.35fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Skeleton style={{ height: 42, borderRadius: 10 }} />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} style={{ height: 42, borderRadius: 10 }} />
        ))}
      </div>
      <SkeletonCard style={{ minHeight: 120 }}>
        <Skeleton
          style={{
            width: "100%",
            height: 40,
            borderRadius: 10,
            marginBottom: 12,
          }}
        />
        <Skeleton
          style={{
            width: "100%",
            height: 40,
            borderRadius: 10,
            marginBottom: 12,
          }}
        />
        <Skeleton style={{ width: "70%", height: 40, borderRadius: 10 }} />
      </SkeletonCard>
    </div>
  )
}

export function AppTrackerSkeleton() {
  return (
    <div>
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "30%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "45%", height: 15, borderRadius: 6 }} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(110px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 70, padding: 16 }}>
            <Skeleton
              style={{
                width: "50%",
                height: 22,
                borderRadius: 6,
                marginBottom: 4,
              }}
            />
            <Skeleton style={{ width: "70%", height: 12, borderRadius: 4 }} />
          </SkeletonCard>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Skeleton style={{ flex: 1, height: 40, borderRadius: 10 }} />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 90 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <Skeleton
                  style={{
                    width: "50%",
                    height: 16,
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                />
                <Skeleton
                  style={{ width: "35%", height: 13, borderRadius: 6 }}
                />
              </div>
              <Skeleton style={{ width: 90, height: 26, borderRadius: 999 }} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "35%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "45%", height: 15, borderRadius: 6 }} />
        </div>
        <Skeleton style={{ width: 140, height: 40, borderRadius: 10 }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 130, padding: 20 }}>
            <Skeleton
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                marginBottom: 14,
              }}
            />
            <Skeleton
              style={{
                width: "40%",
                height: 28,
                borderRadius: 8,
                marginBottom: 4,
              }}
            />
            <Skeleton style={{ width: "60%", height: 13, borderRadius: 6 }} />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard style={{ minHeight: 200 }}>
        <Skeleton
          style={{
            width: "25%",
            height: 17,
            borderRadius: 6,
            marginBottom: 16,
          }}
        />
        <Skeleton
          style={{
            width: "100%",
            height: 30,
            borderRadius: 10,
            marginBottom: 8,
          }}
        />
        <Skeleton
          style={{
            width: "100%",
            height: 30,
            borderRadius: 10,
            marginBottom: 8,
          }}
        />
        <Skeleton style={{ width: "100%", height: 30, borderRadius: 10 }} />
      </SkeletonCard>
    </div>
  )
}

export function PipelineSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "25%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "40%", height: 15, borderRadius: 6 }} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          minHeight: 400,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 300, padding: 16 }}>
            <Skeleton
              style={{
                width: "60%",
                height: 16,
                borderRadius: 6,
                marginBottom: 12,
              }}
            />
            <Skeleton
              style={{
                width: "100%",
                height: 80,
                borderRadius: 12,
                marginBottom: 8,
              }}
            />
            <Skeleton
              style={{
                width: "100%",
                height: 80,
                borderRadius: 12,
                marginBottom: 8,
              }}
            />
            <Skeleton style={{ width: "60%", height: 80, borderRadius: 12 }} />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

export function AutoEmailSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "25%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "40%", height: 15, borderRadius: 6 }} />
        </div>
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}
      >
        <SkeletonCard style={{ minHeight: 300, padding: 16 }}>
          <Skeleton
            style={{
              width: "50%",
              height: 14,
              borderRadius: 6,
              marginBottom: 12,
            }}
          />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              style={{
                width: "85%",
                height: 36,
                borderRadius: 9,
                marginBottom: 4,
              }}
            />
          ))}
        </SkeletonCard>
        <SkeletonCard style={{ minHeight: 400 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 20,
              borderRadius: 8,
              marginBottom: 12,
            }}
          />
          <Skeleton
            style={{
              width: "100%",
              height: 200,
              borderRadius: 12,
              marginBottom: 12,
            }}
          />
          <Skeleton
            style={{
              width: "80%",
              height: 14,
              borderRadius: 6,
              marginBottom: 6,
            }}
          />
          <Skeleton style={{ width: "60%", height: 14, borderRadius: 6 }} />
        </SkeletonCard>
      </div>
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div className="fc-stagger">
      <div className="fc-page-head">
        <div>
          <Skeleton
            style={{
              width: "25%",
              height: 28,
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <Skeleton style={{ width: "40%", height: 15, borderRadius: 6 }} />
        </div>
        <Skeleton style={{ width: 120, height: 40, borderRadius: 10 }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} style={{ minHeight: 100, padding: 20 }}>
            <Skeleton
              style={{
                width: "40%",
                height: 24,
                borderRadius: 8,
                marginBottom: 4,
              }}
            />
            <Skeleton style={{ width: "55%", height: 13, borderRadius: 6 }} />
          </SkeletonCard>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SkeletonCard style={{ minHeight: 260 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 17,
              borderRadius: 6,
              marginBottom: 16,
            }}
          />
          <Skeleton style={{ width: "100%", height: 200, borderRadius: 12 }} />
        </SkeletonCard>
        <SkeletonCard style={{ minHeight: 260 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 17,
              borderRadius: 6,
              marginBottom: 16,
            }}
          />
          <Skeleton style={{ width: "100%", height: 200, borderRadius: 12 }} />
        </SkeletonCard>
        <SkeletonCard style={{ minHeight: 260 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 17,
              borderRadius: 6,
              marginBottom: 16,
            }}
          />
          <Skeleton style={{ width: "100%", height: 200, borderRadius: 12 }} />
        </SkeletonCard>
        <SkeletonCard style={{ minHeight: 260 }}>
          <Skeleton
            style={{
              width: "40%",
              height: 17,
              borderRadius: 6,
              marginBottom: 16,
            }}
          />
          <Skeleton style={{ width: "100%", height: 200, borderRadius: 12 }} />
        </SkeletonCard>
      </div>
    </div>
  )
}
