import { useCallback, useEffect, useRef, useState } from "react"

import {
  WarningCircle,
  ChartBar,
  ArrowsClockwise,
  UploadSimple,
  Eye,
} from "@phosphor-icons/react"

import { Check, Trash2 } from "lucide-react"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { toast } from "sonner"

import { analyzerApi } from "@/api/analyzerApi"

import { getScoreTone } from "@/services/matchScore"

import {
  clearResourceCache,
  getCachedResource,
  getOrFetchResource,
} from "@/services/resourceCache"

import type {
  CvComparisonSeries,
  CvSemanticComparison,
  CvScorePoint,
  CvVersion,
} from "@/types/analyzer"

import BezelCard from "@/ui/components/BezelCard"

const MAX_CV_BYTES = 10 * 1024 * 1024

const LEGACY_CV_HISTORY_CACHE_KEY = "cv-history:summary"

const CV_HISTORY_VERSIONS_CACHE_KEY = "cv-history:versions"

const CV_HISTORY_COMPARISONS_CACHE_KEY = "cv-history:comparisons"

interface CvHistorySnapshot {
  cvs: CvVersion[]

  comparisons: CvComparisonSeries[]
}

export default function CVHistoryScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const legacyCachedHistory = getCachedResource<CvHistorySnapshot>(
    LEGACY_CV_HISTORY_CACHE_KEY,
  )

  const cachedCvs =
    getCachedResource<CvVersion[]>(CV_HISTORY_VERSIONS_CACHE_KEY) ??
    legacyCachedHistory?.cvs

  const cachedComparisons =
    getCachedResource<CvComparisonSeries[]>(
      CV_HISTORY_COMPARISONS_CACHE_KEY,
    ) ?? legacyCachedHistory?.comparisons

  const [cvs, setCvs] = useState<CvVersion[]>(cachedCvs ?? [])

  const [comparisons, setComparisons] = useState<CvComparisonSeries[]>(
    cachedComparisons ?? [],
  )

  const [selectedJdId, setSelectedJdId] = useState<number | null>(
    cachedComparisons?.[0]?.jobDescriptionId ?? null,
  )

  const [selected, setSelected] = useState<number[]>([])

  const [semanticComparison, setSemanticComparison] =
    useState<CvSemanticComparison | null>(null)

  const [comparisonLoading, setComparisonLoading] = useState(false)

  const [versionsLoading, setVersionsLoading] = useState(() => !cachedCvs)

  const [comparisonsLoading, setComparisonsLoading] = useState(
    () => !cachedComparisons,
  )

  const [uploading, setUploading] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [error, setError] = useState<string | null>(null)

  const loadVersions = useCallback(async (force = false) => {
    const cached = getCachedResource<CvVersion[]>(
      CV_HISTORY_VERSIONS_CACHE_KEY,
    )

    if (cached && !force) {
      setCvs(cached)

      setVersionsLoading(false)

      return
    }

    setVersionsLoading(!cached)

    setError(null)

    try {
      const versions = await getOrFetchResource(
        CV_HISTORY_VERSIONS_CACHE_KEY,
        () => analyzerApi.listCvs(),
        { force },
      )

      setCvs(versions)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load CV history.",
      )
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  const loadComparisons = useCallback(async (force = false) => {
    const cached = getCachedResource<CvComparisonSeries[]>(
      CV_HISTORY_COMPARISONS_CACHE_KEY,
    )

    if (cached && !force) {
      setComparisons(cached)

      setSelectedJdId((current) =>
        current != null &&
        cached.some((item) => item.jobDescriptionId === current)
          ? current
          : (cached[0]?.jobDescriptionId ?? null),
      )

      setComparisonsLoading(false)

      return
    }

    setComparisonsLoading(!cached)

    setError(null)

    try {
      const scoreComparisons = await getOrFetchResource(
        CV_HISTORY_COMPARISONS_CACHE_KEY,
        () => analyzerApi.listCvComparisons(),
        { force },
      )

      setComparisons(scoreComparisons)

      setSelectedJdId((current) =>
        current != null &&
        scoreComparisons.some((item) => item.jobDescriptionId === current)
          ? current
          : (scoreComparisons[0]?.jobDescriptionId ?? null),
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load score improvement history.",
      )
    } finally {
      setComparisonsLoading(false)
    }
  }, [])

  const refreshHistory = useCallback(
    async (force = false) => {
      await Promise.all([loadVersions(force), loadComparisons(force)])
    },
    [loadComparisons, loadVersions],
  )

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    if (selected.length !== 2) {
      setSemanticComparison(null)

      return
    }

    const orderedIds = [...selected].sort((left, right) => {
      const leftVersion = cvs.find((cv) => cv.cvId === left)?.versionNumber ?? 0

      const rightVersion =
        cvs.find((cv) => cv.cvId === right)?.versionNumber ?? 0

      return leftVersion - rightVersion
    })

    let cancelled = false

    setComparisonLoading(true)

    void analyzerApi

      .compareCvVersions(orderedIds[0], orderedIds[1])

      .then((comparison) => {
        if (!cancelled) setSemanticComparison(comparison)
      })

      .catch((caught) => {
        if (!cancelled) {
          setSemanticComparison(null)

          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to compare these CV versions.",
          )
        }
      })

      .finally(() => {
        if (!cancelled) setComparisonLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cvs, selected])

  const uploadVersion = async (file?: File) => {
    if (!file) return

    const validationError = validateCv(file)

    if (validationError) {
      setError(validationError)

      return
    }

    setUploading(true)

    setError(null)

    try {
      await analyzerApi.uploadCv(file)

      toast.success("CV uploaded successfully")

      clearResourceCache("cv-history:")

      await refreshHistory(true)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to upload this CV.",
      )
    } finally {
      setUploading(false)
    }
  }

  const deleteVersion = async (cv: CvVersion) => {
    if (!window.confirm(`Delete ${cv.fileName} and its saved match results?`))
      return

    setDeletingId(cv.cvId)

    setError(null)

    try {
      await analyzerApi.deleteCv(cv.cvId)

      setSelected((current) => current.filter((id) => id !== cv.cvId))

      clearResourceCache("cv-history:")

      await refreshHistory(true)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete this CV.",
      )
    } finally {
      setDeletingId(null)
    }
  }

  const [viewerLoadingId, setViewerLoadingId] = useState<number | null>(null)
  const [viewerPages, setViewerPages] = useState<string[]>([])
  const [viewerName, setViewerName] = useState<string | null>(null)

  const openViewer = useCallback(async (cv: CvVersion) => {
    setError(null)

    setViewerLoadingId(cv.cvId)

    try {
      const previewPages = await analyzerApi.getCvPreviewPages(cv.cvId)
      setViewerPages(previewPages)
      setViewerName(cv.fileName)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to open this CV file.",
      )
    } finally {
      setViewerLoadingId(null)
    }
  }, [])

  const closeViewer = () => {
    setViewerPages([])
    setViewerName(null)
  }

  const toggleSelect = (cvId: number) => {
    setSelected((current) => {
      if (current.includes(cvId)) return current.filter((id) => id !== cvId)

      return current.length < 2 ? [...current, cvId] : current
    })
  }

  const compareItems = cvs.filter((cv) => selected.includes(cv.cvId))

  const activeComparison =
    comparisons.find((item) => item.jobDescriptionId === selectedJdId) ?? null

  const scoreByCv = new Map(
    activeComparison?.versions.map((point) => [point.cvId, point]) ?? [],
  )

  return (
    <div className="cv-history-workspace">
      <div
        className="cv-history-header"
        style={{
          display: "flex",

          alignItems: "flex-start",

          justifyContent: "space-between",

          gap: 16,

          marginBottom: 24,

          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,

              fontWeight: 800,

              color: "var(--text-primary)",

              marginBottom: 4,
            }}
          >
            CV History
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Review every uploaded CV version and compare evidence-based scores
            for the same JD.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="fitcv-btn-secondary"
            onClick={() => void refreshHistory(true)}
            disabled={versionsLoading || comparisonsLoading}
          >
            <ArrowsClockwise size={15} weight="light" /> Refresh
          </button>
          <button
            type="button"
            className="fitcv-btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <UploadSimple size={15} weight="light" />
            {uploading ? "Uploading…" : "Upload new version"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onClick={(event) => {
              event.currentTarget.value = ""
            }}
            onChange={(event) => void uploadVersion(event.target.files?.[0])}
          />
        </div>
      </div>

      {error && (
        <div role="alert" style={alertStyle}>
          <WarningCircle size={18} weight="light" /> {error}
        </div>
      )}

      {selected.length === 1 && (
        <div className="mb-4 text-sm text-zinc-500">
          Select one more CV to compare metadata.
        </div>
      )}

      {(comparisonsLoading || comparisons.length > 0) && (
        <div
          className="fitcv-card"
          style={{ padding: 24, marginBottom: 20 }}
          aria-busy={comparisonsLoading && !activeComparison}
        >
          <div
            style={{
              display: "flex",

              justifyContent: "space-between",

              gap: 16,

              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="fc-eyebrow">Score improvement</div>
              <h2 style={{ fontSize: 17, marginTop: 4 }}>
                Progress across CV versions
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",

                  fontSize: 13,

                  marginTop: 4,
                }}
              >
                Scores are grouped by one immutable job description, so the
                comparison stays fair.
              </p>
            </div>
            <label style={{ minWidth: 240 }}>
              <span className="fc-field-label">Comparison target</span>
              {comparisonsLoading && comparisons.length === 0 ? (
                <div
                  className="fc-skeleton"
                  aria-label="Loading comparison targets"
                  style={{ width: "100%", height: 42, borderRadius: 10 }}
                />
              ) : (
                <select
                  className="fc-input"
                  value={selectedJdId ?? ""}
                  onChange={(event) =>
                    setSelectedJdId(Number(event.target.value))
                  }
                >
                  {comparisons.map((item) => (
                    <option
                      key={item.jobDescriptionId}
                      value={item.jobDescriptionId}
                    >
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
          {comparisonsLoading && !activeComparison && (
            <ScoreImprovementSkeleton />
          )}
          {activeComparison && (
            <>
              <div
                style={{
                  display: "flex",

                  gap: 8,

                  flexWrap: "wrap",

                  marginTop: 16,
                }}
              >
                <span className="fc-badge fc-badge--blue">
                  Latest {activeComparison.latestScore.toFixed(1)}%
                </span>
                <span className="fc-badge fc-badge--green">
                  Best {activeComparison.bestScore.toFixed(1)}%
                </span>
                <span className="fc-badge">
                  {activeComparison.latestDelta == null
                    ? "First scored version"
                    : `${
                        activeComparison.latestDelta >= 0 ? "+" : ""
                      }${activeComparison.latestDelta.toFixed(1)} points from previous`}
                </span>
              </div>
              {activeComparison.versions.length > 1 ? (
                <div
                  style={{ width: "100%", height: 250, marginTop: 18 }}
                  aria-label="CV score improvement chart"
                >
                  <ResponsiveContainer>
                    <AreaChart
                      data={activeComparison.versions}
                      margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="cv-score-progress-fill"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#2563EB"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#2563EB"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="2 6"
                      />
                      <XAxis
                        dataKey="versionNumber"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                        tickFormatter={(value) => `Version ${value}`}
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                        width={42}
                      />
                      <Tooltip
                        cursor={{
                          stroke: "var(--border-strong)",
                          strokeWidth: 1,
                        }}
                        contentStyle={{
                          background: "var(--surface)",

                          border: "1px solid var(--border-strong)",

                          borderRadius: 10,

                          boxShadow: "var(--shadow-md)",
                        }}
                        itemStyle={{
                          color: "var(--text-primary)",
                          fontWeight: 700,
                        }}
                        labelStyle={{
                          color: "var(--text-secondary)",
                          marginBottom: 4,
                        }}
                        formatter={(value) => [
                          `${Number(value ?? 0).toFixed(1)}%`,

                          "Match score",
                        ]}
                        labelFormatter={(value) => `CV version ${value}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="overallScore"
                        stroke="#2563EB"
                        strokeWidth={3}
                        fill="url(#cv-score-progress-fill)"
                        dot={{
                          r: 5,
                          fill: "#2563EB",
                          strokeWidth: 2,
                          stroke: "var(--surface)",
                        }}
                        activeDot={{
                          r: 7,
                          fill: "#2563EB",
                          strokeWidth: 3,
                          stroke: "var(--surface)",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ScoreBaseline point={activeComparison.versions[0]} />
              )}
            </>
          )}
        </div>
      )}

      {!comparisonsLoading && cvs.length > 0 && comparisons.length === 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
          <ChartBar size={16} weight="light" /> Analyze at least one CV against
          a JD to start the score history. Analyze two versions against the same
          JD to see improvement.
        </div>
      )}

      {versionsLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
          aria-live="polite"
        >
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="fitcv-card"
              style={{ padding: 18 }}
            >
              <div className="fc-skeleton" style={{ width: "70%", height: 16, borderRadius: 6, marginBottom: 10 }} />
              <div className="fc-skeleton" style={{ width: "50%", height: 13, borderRadius: 4, marginBottom: 8 }} />
              <div className="fc-skeleton" style={{ width: "40%", height: 24, borderRadius: 999, marginBottom: 12 }} />
              <div className="fc-skeleton" style={{ width: "100%", height: 7, borderRadius: 99 }} />
            </div>
          ))}
        </div>
      ) : cvs.length === 0 ? (
        <BezelCard>
          <div
            style={{
              display: "flex",

              flexDirection: "column",

              alignItems: "center",

              gap: 12,

              padding: "48px 24px",

              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,

                height: 56,

                borderRadius: 16,

                background: "var(--accent-soft)",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",
              }}
            >
              <UploadSimple size={24} weight="light" color="var(--accent)" />
            </div>
            <strong style={{ fontSize: 16, color: "var(--text-primary)" }}>
              No CVs uploaded yet
            </strong>
            <span
              style={{
                fontSize: 13,

                color: "var(--text-secondary)",

                maxWidth: 280,
              }}
            >
              Upload your first CV to get AI-powered match analysis and
              improvement suggestions.
            </span>
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimple size={16} weight="light" />
              Upload CV
            </button>
          </div>
        </BezelCard>
      ) : (
        <div
          style={{
            display: "grid",

            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",

            gap: 14,

            marginBottom: 24,
          }}
        >
          {cvs.map((cv) => {
            const isSelected = selected.includes(cv.cvId)

            return (
              <CvVersionCard
                key={cv.cvId}
                cv={cv}
                isSelected={isSelected}
                isDeleting={deletingId === cv.cvId}
                isViewing={viewerLoadingId === cv.cvId}
                scorePoint={scoreByCv.get(cv.cvId)}
                onToggleSelect={() => toggleSelect(cv.cvId)}
                onView={() => void openViewer(cv)}
                onDelete={() => void deleteVersion(cv)}
              />
            )
          })}
        </div>
      )}

      {compareItems.length === 2 && (
        <div className="fitcv-card" style={{ padding: 24 }}>
          <h3
            style={{
              fontSize: 16,

              fontWeight: 700,

              color: "var(--text-primary)",

              marginBottom: 16,
            }}
          >
            Version comparison
          </h3>
          <div
            style={{
              display: "grid",

              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",

              gap: 24,
            }}
          >
            {compareItems.map((cv) => (
              <div key={cv.cvId}>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {cv.fileName}
                </strong>
                <ComparisonRow label="Version" value={`v${cv.versionNumber}`} />
                <ComparisonRow
                  label="Uploaded"
                  value={formatDate(cv.uploadedAt)}
                />
                <ComparisonRow label="Type" value={cv.fileType} />
                <ComparisonRow
                  label="Size"
                  value={formatFileSize(cv.fileSizeKb)}
                />
                <ComparisonRow
                  label="Parser"
                  value={cv.parserVersion ?? "Pending"}
                />
                <ComparisonRow
                  label="Match score"
                  value={
                    scoreByCv.get(cv.cvId)
                      ? `${scoreByCv.get(cv.cvId)!.overallScore.toFixed(1)}%`
                      : activeComparison
                        ? "Not analyzed for this JD"
                        : "Choose a comparison target"
                  }
                />
                {scoreByCv.get(cv.cvId)?.matchLabel && (
                  <ComparisonRow
                    label="Meaning"
                    value={scoreByCv.get(cv.cvId)!.matchLabel!}
                  />
                )}
                {scoreByCv.get(cv.cvId)?.deltaFromPrevious != null && (
                  <ComparisonRow
                    label="Change"
                    value={`${
                      scoreByCv.get(cv.cvId)!.deltaFromPrevious! >= 0 ? "+" : ""
                    }${scoreByCv.get(cv.cvId)!.deltaFromPrevious!.toFixed(1)} points`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {compareItems.length === 2 && (
        <div className="fitcv-card" style={{ padding: 24, marginTop: 16 }}>
          <div
            style={{
              display: "flex",

              justifyContent: "space-between",

              alignItems: "baseline",

              gap: 12,

              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="fc-eyebrow">Semantic comparison</div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                What changed between these CV versions?
              </h3>
              {semanticComparison && (
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  v{semanticComparison.base.versionNumber}{" "}
                  {semanticComparison.base.fileName} → v
                  {semanticComparison.target.versionNumber}{" "}
                  {semanticComparison.target.fileName}
                </p>
              )}
            </div>
            {comparisonLoading && (
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                Comparing parsed evidence…
              </span>
            )}
          </div>
          {semanticComparison && (
            <>
              <div
                style={{
                  display: "grid",

                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",

                  gap: 12,

                  marginTop: 16,
                }}
              >
                {semanticComparison.changes.map((change) => (
                  <div
                    key={change.category}
                    style={{
                      border: "1px solid var(--border)",

                      borderRadius: 10,

                      padding: 14,
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{change.category}</strong>
                    <p
                      style={{
                        color: "var(--text-secondary)",

                        fontSize: 12,

                        margin: "6px 0 10px",
                      }}
                    >
                      {change.summary}
                    </p>
                    <ChangeLine
                      label="Added"
                      values={change.added}
                      color="var(--success)"
                    />
                    <ChangeLine
                      label="Removed"
                      values={change.removed}
                      color="var(--danger)"
                    />
                    <ChangeLine
                      label="Retained"
                      values={change.retained}
                      color="var(--text-secondary)"
                    />
                  </div>
                ))}
              </div>
              {semanticComparison.scoreDeltas.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <strong style={{ fontSize: 13 }}>
                    Score impact by job description
                  </strong>
                  {semanticComparison.scoreDeltas.map((item) => (
                    <div
                      key={item.jobDescriptionId}
                      style={{
                        display: "flex",

                        justifyContent: "space-between",

                        gap: 12,

                        padding: "10px 0",

                        borderBottom: "1px solid var(--border)",

                        fontSize: 13,
                      }}
                    >
                      <span>{item.title}</span>
                      <span
                        style={{
                          color:
                            item.delta >= 0
                              ? "var(--success)"
                              : "var(--danger)",

                          fontWeight: 700,
                        }}
                      >
                        {item.baseScore.toFixed(1)} →{" "}
                        {item.targetScore.toFixed(1)} (
                        {item.delta >= 0 ? "+" : ""}
                        {item.delta.toFixed(1)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewerPages.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`CV preview: ${viewerName ?? "CV"}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeViewer()
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "96px 24px 32px",
            background: "rgba(15, 23, 42, 0.68)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "min(100%, 700px)",
              height: "min(78vh, 820px)",
              overflow: "hidden",
              borderRadius: 14,
              background: "var(--surface)",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong style={{ overflowWrap: "anywhere" }}>
                {viewerName ?? "CV preview"}
              </strong>
              <button
                type="button"
                className="fc-btn fc-btn--secondary"
                onClick={closeViewer}
                aria-label="Close CV preview"
              >
                Close
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                background: "#475569",
              }}
            >
              {viewerPages.map((page, index) => (
                <img
                  key={index}
                  src={page}
                  alt={`${viewerName ?? "CV"} — page ${index + 1}`}
                  style={{
                    display: "block",
                    width: "min(100%, 570px)",
                    margin:
                      index === viewerPages.length - 1
                        ? "0 auto"
                        : "0 auto 20px",
                    background: "white",
                    boxShadow: "0 4px 18px rgba(15, 23, 42, 0.35)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function ChangeLine({
  label,

  values,

  color,
}: {
  label: string

  values: string[]

  color: string
}) {
  if (values.length === 0) return null

  return (
    <div style={{ color, fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>
      <strong>{label}:</strong> {values.join(", ")}
    </div>
  )
}

function ScoreImprovementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading score improvement data"
      style={{ marginTop: 16 }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div
          className="fc-skeleton"
          style={{ width: 92, height: 24, borderRadius: 999 }}
        />
        <div
          className="fc-skeleton"
          style={{ width: 86, height: 24, borderRadius: 999 }}
        />
        <div
          className="fc-skeleton"
          style={{ width: 170, height: 24, borderRadius: 999 }}
        />
      </div>
      <div
        className="fc-skeleton"
        style={{ width: "100%", height: 250, borderRadius: 12, marginTop: 18 }}
      />
    </div>
  )
}

function ScoreBaseline({ point }: { point: CvScorePoint }) {
  return (
    <div
      aria-label={`CV version ${point.versionNumber} baseline score chart`}
      role="img"
      style={{
        marginTop: 18,

        padding: "20px 22px",

        border: "1px solid var(--border)",

        borderRadius: 14,

        background:
          "linear-gradient(135deg, var(--accent-soft), var(--surface))",
      }}
    >
      <div
        style={{
          display: "flex",

          alignItems: "baseline",

          justifyContent: "space-between",

          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            FIRST BENCHMARK · VERSION {point.versionNumber}
          </div>
          <strong
            style={{
              color: "var(--text-primary)",
              fontSize: 28,
              lineHeight: 1.2,
            }}
          >
            {point.overallScore.toFixed(1)}%
          </strong>
        </div>
        <span className="fc-badge fc-badge--blue">
          {point.matchLabel ?? "Match score"}
        </span>
      </div>
      <div
        style={{
          height: 12,

          overflow: "hidden",

          borderRadius: 999,

          background: "var(--surface-2)",

          border: "1px solid var(--border)",

          marginTop: 18,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(point.overallScore, 100))}%`,

            height: "100%",

            borderRadius: "inherit",

            background: "linear-gradient(90deg, #2563EB, #60A5FA)",
          }}
        />
      </div>
      <div
        aria-hidden="true"
        style={{
          display: "flex",

          justifyContent: "space-between",

          color: "var(--text-muted)",

          fontSize: 11,

          marginTop: 7,
        }}
      >
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: 12.5,
          marginTop: 14,
        }}
      >
        Analyze a second CV version against this same target to see your score
        trend.
      </p>
    </div>
  )
}

interface CvVersionCardProps {
  cv: CvVersion

  isSelected: boolean

  isDeleting: boolean

  isViewing: boolean

  scorePoint?: CvScorePoint

  onToggleSelect: () => void

  onView: () => void

  onDelete: () => void
}

function parseStatusBadge(status: CvVersion["parseStatus"]) {
  if (status === "Success") return "fc-badge fc-badge--green"

  if (status === "Failed") return "fc-badge fc-badge--red"

  return "fc-badge fc-badge--amber"
}

function parseStatusLabel(status: CvVersion["parseStatus"]) {
  if (status === "Success") return "Parsed"

  if (status === "Failed") return "Failed"

  return "Processing"
}

function CvVersionCard({
  cv,

  isSelected,

  isDeleting,

  isViewing,

  scorePoint,

  onToggleSelect,

  onView,

  onDelete,
}: CvVersionCardProps) {
  const typeLabel = (cv.fileType ?? "PDF").toUpperCase()

  const tone = scorePoint ? getScoreTone(scorePoint.overallScore) : null

  return (
    <article
      className="cv-version-card"
      data-selected={isSelected}
      data-deleting={isDeleting}
      aria-pressed={isSelected}
    >
      <div className="cv-version-card__top">
        <div className="cv-version-card__thumb" aria-hidden="true">
          <span className="cv-version-card__thumb-type">{typeLabel}</span>

          <span className="cv-version-card__thumb-version">
            v{cv.versionNumber}
          </span>

          {isSelected && (
            <span className="cv-version-card__selected-mark">
              <Check size={11} strokeWidth={3.5} />
            </span>
          )}
        </div>

        <div className="cv-version-card__body">
          <div className="cv-version-card__head">
            <p className="cv-version-card__name" title={cv.fileName}>
              {cv.fileName}
            </p>

            {cv.isLatest && (
              <span className="fc-badge fc-badge--blue">Latest</span>
            )}

            <span className={parseStatusBadge(cv.parseStatus)}>
              {parseStatusLabel(cv.parseStatus)}
            </span>
          </div>

          <div className="cv-version-card__meta">
            Version {cv.versionNumber} · {cv.fileType} ·{" "}
            {formatFileSize(cv.fileSizeKb)} · {formatDate(cv.uploadedAt)}
          </div>

          {scorePoint && tone && (
            <div
              className="cv-version-card__score"
              style={{
                borderColor: tone.trackColor,

                background: tone.trackColor,
              }}
            >
              <span
                className="cv-version-card__score-value"
                style={{ color: tone.color }}
              >
                {scorePoint.overallScore.toFixed(1)}%
              </span>

              <span className="cv-version-card__score-label">
                {scorePoint.matchLabel ?? tone.label}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="cv-version-card__actions">
        <button
          type="button"
          className="cv-version-card__view"
          onClick={onView}
          disabled={isViewing}
          title="Open this CV in a new tab"
        >
          {isViewing ? (
            <ArrowsClockwise className="state-spinner" size={13} weight="light" />
          ) : (
            <Eye size={14} weight="light" />
          )}
          {isViewing ? "Opening…" : "View"}
        </button>

        <button
          type="button"
          className="cv-version-card__compare"
          data-active={isSelected}
          onClick={onToggleSelect}
        >
          {isSelected ? (
            <>
              <Check size={13} strokeWidth={2.75} /> Selected
            </>
          ) : (
            "Compare"
          )}
        </button>

        <button
          type="button"
          className="cv-version-card__delete"
          aria-label={`Delete ${cv.fileName}`}
          title="Delete CV"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>
    </article>
  )
}

interface ComparisonRowProps {
  label: string

  value: string
}

function ComparisonRow({ label, value }: ComparisonRowProps) {
  return (
    <div
      style={{
        display: "flex",

        justifyContent: "space-between",

        gap: 12,

        padding: "10px 0",

        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        {label}
      </span>
      <span
        style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  )
}

function validateCv(file: File): string | null {
  const lowerName = file.name.toLowerCase()

  if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx"))
    return "Only PDF and DOCX CV files are supported."

  if (file.size === 0) return "The selected CV is empty."

  if (file.size > MAX_CV_BYTES) return "CV files must be 10 MB or smaller."

  return null
}

function formatFileSize(kilobytes: number | null) {
  if (kilobytes == null) return "Unknown size"

  return kilobytes >= 1024
    ? `${(kilobytes / 1024).toFixed(1)} MB`
    : `${kilobytes} KB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(new Date(value))
}

const alertStyle: React.CSSProperties = {
  display: "flex",

  alignItems: "center",

  gap: 8,

  color: "#B91C1C",

  background: "#FEF2F2",

  border: "1px solid #FECACA",

  borderRadius: 10,

  padding: "11px 14px",

  marginBottom: 16,

  fontSize: 13,
}
