export interface ReportWindow {
  from: string
  to: string
  label: string
}

export interface ReportPrev {
  active_job_posts: number | null
  total_cvs_reviewed: number | null
  avg_candidate_score: number | null
  review_progress: number | null
  time_to_shortlist_days: number | null
  time_to_hire_days: number | null
  offer_acceptance_rate: number | null
}

export interface ReportKpis {
  active_job_posts: number
  total_cvs_reviewed: number
  avg_candidate_score: number | null
  review_progress: number | null
  time_to_shortlist_days: number | null
  time_to_hire_days: number | null
  offer_acceptance_rate: number | null
  prev: ReportPrev | null
}

export interface ReportBucket {
  period: string
  label: string
  count: number
}

export interface ReportPassRate {
  passed_count: number
  not_passed_count: number
}

export interface ReportScoreBucket {
  range: string
  count: number
}

export interface ReportCharts {
  applications_over_time: ReportBucket[]
  screening_pass_rate: ReportPassRate
  score_distribution: ReportScoreBucket[]
}

export interface ReportJobRow {
  job_id: number
  title: string
  department: string | null
  cv_count: number
  avg_score: number | null
  review_progress: number | null
  status: string
}

export interface ReportSummary {
  window: ReportWindow
  kpis: ReportKpis
  charts: ReportCharts
  jobs: ReportJobRow[]
}
