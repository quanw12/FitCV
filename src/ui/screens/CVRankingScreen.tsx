import { useState } from "react"

import { Briefcase, Files } from "@phosphor-icons/react"

import BulkCvRankingPanel from "./BulkCvRankingPanel"

import JobApplicantsRankingPanel from "./JobApplicantsRankingPanel"

type RankingSource = "upload" | "applications"

export default function CVRankingScreen() {
  const [source, setSource] = useState<RankingSource>("upload")

  return (
    <div className="fc-stagger cv-ranking-screen">
      <div className="fc-page-head">
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 6 }}>
            Talent Screening &amp; Ranking
          </div>
          <h1>Candidate CV Ranking</h1>
          <p>
            {source === "upload"
              ? "Screen externally sourced CVs (PDF/DOCX, up to 20) with AI evidence scoring."
              : "Rank candidates who applied directly to your published FitCV job posts."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="CV ranking source"
          style={{
            display: "inline-flex",
            gap: 6,
            padding: 5,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            borderRadius: "var(--r-md)",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={source === "upload"}
            className={
              source === "upload"
                ? "fc-btn fc-btn--primary"
                : "fc-btn fc-btn--ghost"
            }
            style={{ padding: "8px 16px", fontSize: 13 }}
            onClick={() => setSource("upload")}
          >
            <Files size={16} />
            Upload CV Batch
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "applications"}
            className={
              source === "applications"
                ? "fc-btn fc-btn--primary"
                : "fc-btn fc-btn--ghost"
            }
            style={{ padding: "8px 16px", fontSize: 13 }}
            onClick={() => setSource("applications")}
          >
            <Briefcase size={16} />
            Job Applicants
          </button>
        </div>
      </div>

      {source === "upload" ? (
        <BulkCvRankingPanel />
      ) : (
        <JobApplicantsRankingPanel />
      )}
    </div>
  )
}
