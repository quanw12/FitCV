import { useState } from 'react'
import { BriefcaseBusiness, Files } from 'lucide-react'

import BulkCvRankingPanel from './BulkCvRankingPanel'
import JobApplicantsRankingPanel from './JobApplicantsRankingPanel'

type RankingSource = 'upload' | 'applications'

export default function CVRankingScreen() {
  const [source, setSource] = useState<RankingSource>('upload')

  return (
    <div>
      <div
        role="tablist"
        aria-label="CV ranking source"
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          marginBottom: 18,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          borderRadius: 8,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={source === 'upload'}
          className={
            source === 'upload'
              ? 'fc-btn fc-btn--primary'
              : 'fc-btn fc-btn--secondary'
          }
          onClick={() => setSource('upload')}
        >
          <Files size={16} />
          Upload CV Batch
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === 'applications'}
          className={
            source === 'applications'
              ? 'fc-btn fc-btn--primary'
              : 'fc-btn fc-btn--secondary'
          }
          onClick={() => setSource('applications')}
        >
          <BriefcaseBusiness size={16} />
          Job Applicants
        </button>
      </div>

      {source === 'upload' ? (
        <BulkCvRankingPanel />
      ) : (
        <JobApplicantsRankingPanel />
      )}
    </div>
  )
}
