import re
from typing import Any

ALGORITHM_VERSION = "fitcv-deterministic-v1"
CATEGORY_WEIGHTS = {"skills": 45.0, "experience": 30.0, "education": 15.0, "soft_skills": 10.0}
EDUCATION_RANK = {"High School": 1, "Associate": 2, "Bachelor": 3, "Master": 4, "Doctorate": 5}


def match_documents(cv: dict[str, Any], jd: dict[str, Any]) -> dict[str, Any]:
    breakdown: dict[str, dict[str, Any]] = {}
    required_labels = _term_index(jd.get("required_skills") or [])
    preferred_labels = _term_index(jd.get("preferred_skills") or [])
    cv_skill_labels = _term_index(cv.get("skills") or [])
    required = set(required_labels)
    preferred = set(preferred_labels)
    cv_skills = set(cv_skill_labels)

    if required or preferred:
        required_score = _ratio(cv_skills & required, required)
        preferred_score = _ratio(cv_skills & preferred, preferred)
        if required and preferred:
            skill_score = required_score * 0.8 + preferred_score * 0.2
        else:
            skill_score = required_score if required else preferred_score
        listed_labels = {**preferred_labels, **required_labels}
        matched_keys = cv_skills & (required | preferred)
        missing_keys = (required | preferred) - cv_skills
        breakdown["skills"] = _evidence(
            skill_score,
            {listed_labels[key] for key in matched_keys},
            {listed_labels[key] for key in missing_keys},
            f"Matched {len(matched_keys)} of {len(required | preferred)} listed skills.",
        )

    required_years = _number(jd.get("experience_years"))
    if required_years is not None:
        cv_years = _number(cv.get("experience_years")) or 0.0
        experience_score = min(100.0, (cv_years / required_years) * 100.0) if required_years > 0 else 100.0
        breakdown["experience"] = _evidence(
            experience_score,
            [f"{cv_years:g} years"] if cv_years >= required_years else [],
            [f"{required_years:g} years required"] if cv_years < required_years else [],
            f"CV evidence: {cv_years:g} years; JD requirement: {required_years:g} years.",
        )

    required_education = jd.get("education")
    if required_education:
        cv_education = cv.get("education")
        education_score = 100.0 if EDUCATION_RANK.get(cv_education, 0) >= EDUCATION_RANK.get(required_education, 0) else 0.0
        breakdown["education"] = _evidence(
            education_score,
            [str(cv_education)] if education_score == 100.0 and cv_education else [],
            [str(required_education)] if education_score < 100.0 else [],
            f"CV education: {cv_education or 'not found'}; JD requirement: {required_education}.",
        )

    required_soft_labels = _term_index(jd.get("soft_skills") or [])
    required_soft_skills = set(required_soft_labels)
    if required_soft_skills:
        cv_soft_skills = set(_term_index(cv.get("soft_skills") or []))
        matched_soft = cv_soft_skills & required_soft_skills
        missing_soft = required_soft_skills - cv_soft_skills
        breakdown["soft_skills"] = _evidence(
            _ratio(matched_soft, required_soft_skills),
            {required_soft_labels[key] for key in matched_soft},
            {required_soft_labels[key] for key in missing_soft},
            f"Matched {len(matched_soft)} of {len(required_soft_skills)} stated soft skills.",
        )

    if not breakdown:
        raise ValueError("The job description has no scorable skills, experience, education, or soft-skill requirements.")

    active_weight = sum(CATEGORY_WEIGHTS[name] for name in breakdown)
    overall_score = round(
        sum(item["score"] * CATEGORY_WEIGHTS[name] for name, item in breakdown.items()) / active_weight,
        2,
    )
    critical_scores = [breakdown[name]["score"] for name in ("skills", "experience") if name in breakdown]
    critical_score = min(critical_scores) if critical_scores else overall_score
    pass_probability = round(min(95.0, max(0.0, overall_score * 0.7 + critical_score * 0.3)), 2)

    strengths = [f"{_category_label(name)} is strongly supported by CV evidence." for name, item in breakdown.items() if item["score"] >= 80]
    weaknesses = [f"{_category_label(name)} has important missing evidence." for name, item in breakdown.items() if item["score"] < 50]
    suggestions = _suggestions(breakdown)
    label = _match_label(overall_score)
    return {
        "overall_score": overall_score,
        "match_label": label,
        "pass_probability": pass_probability,
        "breakdown": breakdown,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "match_summary": f"{label} based on the requirements explicitly found in the supplied job description.",
        "algorithm_version": ALGORITHM_VERSION,
    }


def supplement_semantic_cv(
    semantic_cv: dict[str, Any], parsed_cv: dict[str, Any]
) -> dict[str, Any]:
    """Keep locally grounded CV facts that the semantic extractor omitted."""
    supplemented = dict(semantic_cv)
    for field in ("skills", "soft_skills"):
        supplemented[field] = _merge_terms(
            semantic_cv.get(field) or [],
            parsed_cv.get(field) or [],
        )
    for field in ("experience_years", "education"):
        if supplemented.get(field) is None and parsed_cv.get(field) is not None:
            supplemented[field] = parsed_cv[field]
    return supplemented


def _merge_terms(primary: list[str], supplemental: list[str]) -> list[str]:
    merged: dict[str, str] = {}
    for value in [*primary, *supplemental]:
        key = _term_key(value)
        if key:
            merged.setdefault(key, value)
    return sorted(merged.values(), key=str.casefold)


def _ratio(matched: set[str], required: set[str]) -> float:
    return round((len(matched) / len(required)) * 100.0, 2) if required else 100.0


def _term_index(values: list[str]) -> dict[str, str]:
    return {_term_key(value): value for value in values if _term_key(value)}


def _term_key(value: str) -> str:
    key = re.sub(r"[^a-z0-9+#.]+", " ", value.casefold()).strip()
    return {
        "rest apis": "rest api",
        "restful api": "rest api",
        "restful apis": "rest api",
    }.get(key, key)


def _number(value: object) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def _evidence(score: float, matched: set[str] | list[str], missing: set[str] | list[str], detail: str) -> dict[str, Any]:
    return {
        "score": round(score, 2),
        "matched": sorted(matched),
        "missing": sorted(missing),
        "detail": detail,
    }


def _match_label(score: float) -> str:
    if score >= 80:
        return "Strong Match"
    if score >= 50:
        return "Moderate Match"
    return "Weak Match"


def _category_label(name: str) -> str:
    return {"skills": "Skills", "experience": "Experience", "education": "Education", "soft_skills": "Soft skills"}[name]


def _suggestions(breakdown: dict[str, dict[str, Any]]) -> list[str]:
    suggestions: list[str] = []
    missing_skills = breakdown.get("skills", {}).get("missing", [])
    if missing_skills:
        suggestions.append(f"Add evidence for these skills only if accurate: {', '.join(missing_skills[:5])}.")
    if breakdown.get("experience", {}).get("score", 100) < 100:
        suggestions.append("Clarify relevant experience duration and outcomes without inventing metrics.")
    if breakdown.get("education", {}).get("score", 100) < 100:
        suggestions.append("State the closest relevant education or verified equivalent training.")
    if breakdown.get("soft_skills", {}).get("missing"):
        suggestions.append("Demonstrate requested soft skills with brief, factual project or work examples.")
    return suggestions
