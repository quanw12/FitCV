from datetime import datetime, timezone


def utc_now_naive() -> datetime:
    """Return the current UTC time for storage in MySQL ``DATETIME`` columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
