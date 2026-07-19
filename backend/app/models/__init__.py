from app.models.account import Account
from app.models.analyzer import Cv, CvParseResult, JdParseResult, Job, JobDescription, MatchResult
from app.models.improvement import AiTask, CvImprovementSuggestion

__all__ = [
    "Account", "AiTask", "Cv", "CvImprovementSuggestion", "CvParseResult",
    "JdParseResult", "Job", "JobDescription", "MatchResult",
]
