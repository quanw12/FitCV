"""Personal-use LinkedIn job search for FitCV job seekers.

Searches LinkedIn's public ``jobs-guest`` endpoints (no authentication) using
the same approach as the ``linkedin-search`` skill: fetch the search HTML and
parse the job cards with regex. Results are returned to the caller and are
never stored in the database.

This is a prototype helper for individual students. LinkedIn's Terms of
Service do not permit automated access, so keep request volume low and do not
use this in production or for bulk data collection.
"""

import html as html_lib
import random
import re
import time

import requests

SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
}

DEFAULT_LOCATION = "Remote"
MAX_RESULTS = 20
_DEFAULT_JOBAGE_DAYS = 30

SUPPORTED_LEVELS = (
    "Intern",
    "Entry",
    "Fresher",
    "Junior",
    "Mid-level",
    "Senior",
    "Lead",
    "Manager",
)

# FitCV level -> LinkedIn f_E experience filter. f_E=1 (Internship) is silently
# ignored by the guest API, so Intern searches use Entry (2) and rely on the
# level word in the query plus the low-level title blocker to stay on target.
LEVEL_TO_F_E = {
    "Intern": "2",
    "Entry": "2",
    "Fresher": "2",
    "Junior": "3",
    "Mid-level": "4",
    "Senior": "4",
    "Lead": "5",
    "Manager": "5",
}

# Titles that clearly contradict a low-level search. "manager"/"lead" are left
# out on purpose: "Junior Product Manager" is a real entry-level title.
_LOW_LEVEL_BLOCKERS = re.compile(
    r"\b(senior|sr\.?|principal|staff|director|architect|expert|head of)\b",
    re.IGNORECASE,
)


def normalize_level(value) -> str | None:
    """Return the level only when it is one of the supported values."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned if cleaned in SUPPORTED_LEVELS else None


class LinkedInSearchError(RuntimeError):
    """Raised when LinkedIn is unreachable or returns an error."""


def derive_search_query(parsed_payload) -> str:
    """Build a keyword query from the parsed CV payload's skill list."""
    if not isinstance(parsed_payload, dict):
        return ""
    skills = parsed_payload.get("skills")
    if not isinstance(skills, list):
        return ""
    names = [str(skill).strip() for skill in skills if isinstance(skill, str) and skill.strip()]
    if not names:
        return ""
    return " ".join(names[:4])


def html_fetch(url: str, params: dict) -> str:
    """Fetch with exponential backoff on 429/5xx. Returns '' on 404."""
    max_retries = 6
    delay = 0.5
    for attempt in range(max_retries + 1):
        try:
            response = requests.get(url, params=params, headers=_HEADERS, timeout=15)
        except requests.RequestException as exc:
            raise LinkedInSearchError(f"LinkedIn request failed: {exc}") from exc
        if response.status_code in {429, *range(500, 600)}:
            if attempt == max_retries:
                raise LinkedInSearchError(
                    f"LinkedIn request failed: {response.status_code} {response.reason}"
                )
            jitter = random.uniform(0, 0.5)
            time.sleep(min(delay + jitter, 8.5))
            delay = min(delay * 2, 8)
            continue
        if response.status_code == 404:
            return ""
        if response.status_code != 200:
            raise LinkedInSearchError(
                f"LinkedIn request failed: {response.status_code} {response.reason}"
            )
        return response.text
    raise LinkedInSearchError("LinkedIn request failed after max retries")


def _clean(fragment: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html_lib.unescape(without_tags)).strip()


def _id_from_url(url: str) -> str | None:
    match = re.search(r"-(\d{6,})(?:\?|$)", url) or re.search(r"(\d{6,})", url)
    return match.group(1) if match else None


def parse_job_cards(html: str) -> list[dict]:
    """Parse the search response into job cards (one dict per posting)."""
    results: list[dict] = []
    chunks = html.split('data-entity-urn="urn:li:jobPosting:')[1:]
    for chunk in chunks:
        id_match = re.match(r"(\d+)", chunk)
        if not id_match:
            continue
        job_id = id_match.group(1)

        link_match = re.search(
            r'class="base-card__full-link[^"]*"[^>]*href="([^"]+)"', chunk, re.IGNORECASE
        )
        url = ""
        if link_match:
            url = html_lib.unescape(link_match.group(1)).split("?")[0]

        title: str | None = None
        h3 = re.search(
            r'class="base-search-card__title"[^>]*>([\s\S]*?)</h3>', chunk, re.IGNORECASE
        )
        if h3:
            title = _clean(h3.group(1))
        if not title:
            sr = re.search(r'class="sr-only"[^>]*>([\s\S]*?)</span>', chunk, re.IGNORECASE)
            if sr:
                title = _clean(sr.group(1))
        if not title:
            continue

        company: str | None = None
        company_url: str | None = None
        sub = re.search(
            r'class="base-search-card__subtitle"[^>]*>([\s\S]*?)</h4>', chunk, re.IGNORECASE
        )
        if sub:
            anchor = re.search(r'href="([^"]+)"', sub.group(1), re.IGNORECASE)
            if anchor:
                company_url = html_lib.unescape(anchor.group(1)).split("?")[0]
            company = _clean(sub.group(1)) or None

        loc = re.search(
            r'class="job-search-card__location"[^>]*>([\s\S]*?)</span>', chunk, re.IGNORECASE
        )
        if loc:
            location = _clean(loc.group(1)) or None
        else:
            location = None
        dt = re.search(
            r'class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"', chunk, re.IGNORECASE
        )
        date = dt.group(1) if dt else None

        results.append(
            {
                "id": job_id,
                "title": title,
                "company": company,
                "company_url": company_url,
                "location": location,
                "date": date,
                "url": url or f"https://www.linkedin.com/jobs/view/{job_id}",
            }
        )
    return results


def jobage_to_tpr(days: int | None) -> str | None:
    """Convert a job-age in days to LinkedIn's f_TPR seconds value."""
    if not days or days <= 0 or days >= 9999:
        return None
    return f"r{days * 86400}"


def work_type_flag(mode: str | None) -> str | None:
    """Workplace-type flag: on-site=1, remote=2, hybrid=3."""
    normalized = (mode or "").strip().lower()
    if normalized == "remote":
        return "2"
    if normalized == "hybrid":
        return "3"
    if normalized in {"onsite", "on-site"}:
        return "1"
    return None


def recommend_jobs(
    *,
    query: str,
    location: str = DEFAULT_LOCATION,
    remote: str | None = None,
    jobage: int = _DEFAULT_JOBAGE_DAYS,
    limit: int = 12,
    level: str | None = None,
) -> list[dict]:
    """Search LinkedIn for jobs matching the query and return the top hits.

    Jobs are sorted so the ones whose titles mention the most query keywords
    appear first; ties break on newest posting date. Nothing is persisted.

    When a level is supplied it is added to the query as a word (LinkedIn's
    f_E experience filter is fuzzy, so the word improves precision) and the
    f_E parameter is set. Intern/Entry/Fresher additionally drop titles that
    clearly contradict a low-level search.
    """
    params: dict[str, str] = {"start": "0"}
    query = (query or "").strip()
    location = (location or "").strip() or DEFAULT_LOCATION
    level = normalize_level(level)
    if level:
        f_e = LEVEL_TO_F_E.get(level)
        if f_e:
            params["f_E"] = f_e
        if query:
            query = f"{level} {query}"
        else:
            query = level
    if query:
        params["keywords"] = query
    params["location"] = location
    tpr = jobage_to_tpr(jobage)
    if tpr:
        params["f_TPR"] = tpr
    wt = work_type_flag(remote)
    if wt:
        params["f_WT"] = wt

    cards = parse_job_cards(html_fetch(SEARCH_URL, params))
    if level in {"Intern", "Entry", "Fresher"}:
        cards = [card for card in cards if not _LOW_LEVEL_BLOCKERS.search(card["title"])]
    keywords = [token for token in re.split(r"\s+", query.lower()) if token]
    for card in cards:
        title_lower = card["title"].lower()
        matched = [keyword for keyword in keywords if keyword in title_lower]
        card["matched_keywords"] = matched
    cards.sort(key=lambda card: (len(card["matched_keywords"]), card["date"] or ""), reverse=True)
    return cards[: max(1, min(limit, MAX_RESULTS))]
