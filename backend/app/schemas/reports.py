from pydantic import BaseModel, ConfigDict, Field


class ReportWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    label: str


class ReportPrev(BaseModel):
    active_job_posts: int | None = None
    total_cvs_reviewed: int | None = None
    avg_candidate_score: float | None = None
    review_progress: float | None = None
    time_to_shortlist_days: float | None = None
    time_to_hire_days: float | None = None
    offer_acceptance_rate: float | None = None


class ReportKpis(BaseModel):
    active_job_posts: int
    total_cvs_reviewed: int
    avg_candidate_score: float | None = None
    review_progress: float | None = None
    time_to_shortlist_days: float | None = None
    time_to_hire_days: float | None = None
    offer_acceptance_rate: float | None = None
    prev: ReportPrev | None = None


class ReportBucket(BaseModel):
    period: str
    label: str
    count: int


class ReportPassRate(BaseModel):
    passed_count: int
    not_passed_count: int


class ReportScoreBucket(BaseModel):
    range: str
    count: int


class ReportCharts(BaseModel):
    applications_over_time: list[ReportBucket]
    screening_pass_rate: ReportPassRate
    score_distribution: list[ReportScoreBucket]


class ReportJobRow(BaseModel):
    job_id: int
    title: str
    department: str | None = None
    cv_count: int
    avg_score: float | None = None
    review_progress: float | None = None
    status: str


class ReportSummaryResponse(BaseModel):
    window: ReportWindow
    kpis: ReportKpis
    charts: ReportCharts
    jobs: list[ReportJobRow]
