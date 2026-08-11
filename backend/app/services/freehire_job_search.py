"""Tech job search for FitCV job seekers via the freehire.me public API.

freehire.me aggregates postings from ~50 ATS platforms into one schema and
exposes a public JSON API (no API key, no authentication). Unlike LinkedIn's
guest HTML endpoint, results are structured: seniority, category, skills, and
work mode are real fields, so experience-level filtering is exact. The corpus
is tech-focused (software, data, engineering, DevOps, remote).

This is a personal-use helper: reads are public and unauthenticated, the
service is best-effort with no SLA, and nothing is persisted here.
"""

import re

import requests

from app.core.config import settings
from app.services.gemini_analyzer import (
    GeminiAnalyzerError,
    extract_cv_search_profile,
)

SEARCH_URL = "https://freehire.me/api/v1/agent/jobs/search"

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

# FitCV level -> freehire seniority facet value. freehire's controlled
# vocabulary is intern/junior/middle/senior/staff/principal/lead, so Entry,
# Fresher, and Junior collapse to junior and Manager maps to principal.
LEVEL_TO_SENIORITY = {
    "Intern": "intern",
    "Entry": "junior",
    "Fresher": "junior",
    "Junior": "junior",
    "Mid-level": "middle",
    "Senior": "senior",
    "Lead": "lead",
    "Manager": "principal",
}

_COUNTRY_ALIASES = {
    "vietnam": "VN",
    "vn": "VN",
    "viet nam": "VN",
    "singapore": "SG",
    "sg": "SG",
    "germany": "DE",
    "de": "DE",
    "france": "FR",
    "fr": "FR",
    "netherlands": "NL",
    "nl": "NL",
    "japan": "JP",
    "jp": "JP",
    "india": "IN",
    "in": "IN",
    "united kingdom": "GB",
    "uk": "GB",
    "britain": "GB",
    "united states": "US",
    "usa": "US",
    "us": "US",
}

_REGION_ALIASES = {
    "europe": "eu",
    "eu": "eu",
    "asia": "apac",
    "apac": "apac",
    "north america": "us",
    "latin america": "latam",
    "latam": "latam",
    "cis": "cis",
}

_CITY_NORMALIZE = {
    "ho chi minh city": "Ho Chi Minh City",
    "hcmc": "Ho Chi Minh City",
    "hcm": "Ho Chi Minh City",
    "saigon": "Ho Chi Minh City",
    "ho chi minh": "Ho Chi Minh City",
    "ha noi": "Hanoi",
    "hanoi": "Hanoi",
    "da nang": "Da Nang",
    "danang": "Da Nang",
}

_CITY_TO_COUNTRY = {
    "ho chi minh city": "VN",
    "ho chi minh": "VN",
    "hcmc": "VN",
    "hcm": "VN",
    "saigon": "VN",
    "hanoi": "VN",
    "ha noi": "VN",
    "da nang": "VN",
    "danang": "VN",
    "hai phong": "VN",
    "can tho": "VN",
    "nha trang": "VN",
    "vung tau": "VN",
    "hue": "VN",
}


class FreehireSearchError(RuntimeError):
    """Raised when freehire is unreachable or returns an error."""


def normalize_level(value) -> str | None:
    """Return the level only when it is one of the supported values."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned if cleaned in SUPPORTED_LEVELS else None


def seniority_filter(level) -> str | None:
    """Map a FitCV level to freehire's seniority facet value."""
    normalized = normalize_level(level)
    if normalized is None:
        return None
    return LEVEL_TO_SENIORITY[normalized]


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


def _derive_level_from_experience(parsed_payload) -> str | None:
    """Approximate the seniority level from parsed experience years (fallback)."""
    if not isinstance(parsed_payload, dict):
        return None
    years = parsed_payload.get("experience_years")
    if not isinstance(years, (int, float)) or years is None:
        return None
    if years < 1:
        return "Entry"
    if years < 3:
        return "Junior"
    if years < 5:
        return "Mid-level"
    return "Senior"


def derive_ai_search_query(
    *,
    cv_text: str,
    parsed_payload,
    preferred_level: str | None = None,
    use_ai: bool = True,
) -> dict:
    """Derive a search query from the CV, preferring AI when configured.

    When ANALYZER_PROVIDER=gemini and GEMINI_API_KEY is set, asks Gemini for a
    target level and job title plus keywords and a location hint, falling back
    to the deterministic skill list whenever Gemini is unavailable or unusable.
    A user-supplied ``preferred_level`` overrides the AI/experience level.
    The level is returned separately (``level``) so callers can apply it as
    the seniority facet — freehire filters on it exactly, so the level word is
    deliberately left out of the keyword query.
    Returns {"query", "location_hint", "level", "used_ai"}.
    """
    level = normalize_level(preferred_level)
    location_hint: str | None = None
    if use_ai and settings.analyzer_provider.strip().lower() == "gemini":
        try:
            profile = extract_cv_search_profile(cv_text=cv_text)
        except (GeminiAnalyzerError, ValueError):
            profile = {}
        title = profile.get("job_title") if isinstance(profile, dict) else None
        keywords = profile.get("keywords") if isinstance(profile, dict) else None
        ai_level = profile.get("level") if isinstance(profile, dict) else None
        hint = profile.get("location_hint") if isinstance(profile, dict) else None
        parts: list[str] = []
        if level is None and isinstance(ai_level, str) and ai_level.strip():
            level = ai_level.strip()
        if isinstance(title, str) and title.strip():
            parts.append(title.strip())
        if isinstance(keywords, list):
            parts.extend(
                str(keyword).strip()
                for keyword in keywords
                if isinstance(keyword, str) and keyword.strip()
            )
        # Short title-like queries match far better than long keyword lists.
        # Cap the derived query at ~5 words (title + a couple of skills).
        capped: list[str] = []
        word_count = 0
        for part in parts:
            words = part.split()
            if word_count + len(words) > 5:
                break
            capped.append(part)
            word_count += len(words)
        parts = capped
        if parts:
            location_hint = (
                hint.strip()
                if isinstance(hint, str) and hint.strip()
                else None
            )
            return {
                "query": " ".join(parts),
                "location_hint": location_hint,
                "level": level,
                "used_ai": True,
            }
    level = level or _derive_level_from_experience(parsed_payload)
    return {
        "query": derive_search_query(parsed_payload),
        "location_hint": None,
        "level": level,
        "used_ai": False,
    }


def location_to_facets(location: str | None) -> dict[str, str | list[str]]:
    """Map a free-text location to freehire facets.

    "Remote"/"anywhere" become the work_mode facet. "City, Country" or
    "City" or "Country" is parsed into country and city facets. If a known
    Vietnamese city or alias is provided, the country facet is automatically
    attached as "VN" so that location fallbacks stay locked within Vietnam.
    """
    cleaned = (location or "").strip()
    if not cleaned:
        return {}
    lowered = cleaned.lower()
    if "remote" in lowered or lowered in {"worldwide", "anywhere"}:
        return {"work_mode": "remote"}

    country_code: str | None = None
    city_name: str | None = None

    parts = [part.strip() for part in cleaned.split(",")]
    for part in parts:
        part_lower = part.lower()
        if country_code is None:
            country_code = _COUNTRY_ALIASES.get(part_lower) or _CITY_TO_COUNTRY.get(part_lower)
        if not country_code and part_lower in _REGION_ALIASES:
            return {"regions": [_REGION_ALIASES[part_lower]]}
        if city_name is None:
            city_name = _CITY_NORMALIZE.get(part_lower)

    result: dict[str, str | list[str]] = {}
    if city_name:
        result["cities"] = [city_name]
    elif country_code is None and len(parts) == 1:
        result["cities"] = [cleaned]
    if country_code:
        result["countries"] = [country_code]
    return result


def _fetch(params: dict) -> list[dict]:
    try:
        response = requests.get(SEARCH_URL, params=params, timeout=20)
    except requests.RequestException as exc:
        raise FreehireSearchError(f"freehire request failed: {exc}") from exc
    if response.status_code != 200:
        raise FreehireSearchError(
            f"freehire request failed: {response.status_code} {response.reason}"
        )
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, list) else []


def _normalize_hit(hit: dict, keywords: list[str]) -> dict:
    title = (hit.get("title") or "").strip()
    slug = hit.get("public_slug") or ""
    url = (hit.get("url") or "").strip()
    if not url and slug:
        url = f"https://freehire.me/jobs/{slug}"
    posted = (hit.get("posted_at") or "").strip()
    enrichment = hit.get("enrichment") if isinstance(hit.get("enrichment"), dict) else {}
    matched = [keyword for keyword in keywords if keyword in title.lower()]
    return {
        "id": slug or url,
        "title": title,
        "company": hit.get("company") or None,
        "location": hit.get("location") or None,
        "date": posted[:10] or None,
        "url": url,
        "matched_keywords": matched,
        "seniority": enrichment.get("seniority") or None,
        "category": enrichment.get("category") or None,
    }


def search_jobs(
    *,
    query: str,
    location: str = DEFAULT_LOCATION,
    remote: str | None = None,
    jobage: int = _DEFAULT_JOBAGE_DAYS,
    limit: int = 12,
    level: str | None = None,
) -> list[dict]:
    """Search freehire for tech jobs matching the query and return top hits.

    Hits are sorted so the ones whose titles mention the most query keywords
    appear first; ties break on newest posting date. Nothing is persisted.
    """
    params: dict[str, str] = {
        "q": (query or "").strip(),
        "limit": str(max(1, min(limit, MAX_RESULTS))),
        "offset": "0",
        "semantic_ratio": "0",
        "include_description": "false",
    }
    if jobage and 0 < jobage < 9999:
        params["posted_within_days"] = str(jobage)
    if remote and remote.strip().lower() in {"remote", "hybrid", "onsite"}:
        params["work_mode"] = remote.strip().lower()
    seniority = seniority_filter(level)
    if seniority:
        params["seniority"] = seniority
    location_facets = location_to_facets(location)
    for param, values in location_facets.items():
        if isinstance(values, str):
            values = [values]
        for value in values:
            if param not in params or isinstance(params[param], list):
                params.setdefault(param, [])
                params[param].append(value)
            else:
                params[param] = [params[param], value]

    def run(current_params: dict) -> list[dict]:
        return _fetch(current_params)

    data = run(params)
    # Attempt 2: If city facet gave 0 hits, retry without city facet (keeps country facet)
    if not data and "cities" in params:
        without_city = {
            key: value
            for key, value in params.items()
            if key != "cities"
        }
        data = run(without_city)
        if data:
            params = without_city

    # Attempt 3: If the strict city + seniority search still gave 0 hits,
    # retry with the most restrictive location (country) and no seniority facet,
    # since many freehire postings omit the seniority enrichment entirely.
    if not data and ("cities" in params or "seniority" in params):
        relaxed = {
            key: value
            for key, value in params.items()
            if key not in {"cities", "seniority"}
        }
        data = run(relaxed)

    keywords = [token for token in re.split(r"\s+", (query or "").lower()) if token]
    cards = [_normalize_hit(hit, keywords) for hit in data]
    cards.sort(
        key=lambda card: (len(card["matched_keywords"]), card["date"] or ""),
        reverse=True,
    )
    return cards[: max(1, min(limit, MAX_RESULTS))]
