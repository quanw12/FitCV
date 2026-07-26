import re
from typing import Any

ALGORITHM_VERSION = "fitcv-evidence-v2"
SCORING_FRAMEWORK_VERSION = "fitcv-source-grounded-v2"
CATEGORY_WEIGHTS = {"skills": 45.0, "experience": 30.0, "education": 15.0, "soft_skills": 10.0}
EDUCATION_RANK = {"High School": 1, "Associate": 2, "Bachelor": 3, "Master": 4, "Doctorate": 5}


def match_documents(
    cv: dict[str, Any],
    jd: dict[str, Any],
    *,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    scoring_weights = _validated_weights(weights)
    breakdown: dict[str, dict[str, Any]] = {}
    required_labels = _term_index(jd.get("required_skills") or [])
    preferred_labels = _term_index(jd.get("preferred_skills") or [])
    required_groups = jd.get("required_skill_groups") or []
    preferred_groups = jd.get("preferred_skill_groups") or []
    cv_skill_labels = _term_index(cv.get("skills") or [])
    required = set(required_labels)
    preferred = set(preferred_labels)
    cv_skills = set(cv_skill_labels)

    has_required = bool(required or required_groups)
    has_preferred = bool(preferred or preferred_groups)
    if has_required or has_preferred:
        required_score, required_matched, required_missing, required_group_results = (
            _skill_requirement_score(
                cv_skills,
                required_labels,
                required_groups,
                priority="required",
            )
        )
        preferred_score, preferred_matched, preferred_missing, preferred_group_results = (
            _skill_requirement_score(
                cv_skills,
                preferred_labels,
                preferred_groups,
                priority="preferred",
            )
        )
        if has_required and has_preferred:
            skill_score = required_score * 0.8 + preferred_score * 0.2
        else:
            skill_score = required_score if has_required else preferred_score
        skill_evidence = _evidence(
            skill_score,
            required_matched | preferred_matched,
            [*required_missing, *preferred_missing],
            (
                f"Required skill requirements scored {required_score:g}%"
                if has_required
                else "No required skill requirements were stated"
            )
            + (
                f"; preferred skill requirements scored {preferred_score:g}%."
                if has_preferred
                else "."
            ),
        )
        skill_evidence["groups"] = [
            *required_group_results,
            *preferred_group_results,
        ]
        breakdown["skills"] = skill_evidence

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

    active_weight = sum(scoring_weights[name] for name in breakdown)
    if active_weight <= 0:
        raise ValueError(
            "The active job-description categories have a total scoring weight of 0."
        )
    overall_score = round(
        sum(
            item["score"] * scoring_weights[name]
            for name, item in breakdown.items()
        )
        / active_weight,
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
        "scoring_weights": scoring_weights,
        "framework_version": SCORING_FRAMEWORK_VERSION,
        "rubric": {
            "weights": scoring_weights,
            "active_categories": list(breakdown),
            "missing_categories": [
                name for name in CATEGORY_WEIGHTS if name not in breakdown
            ],
        },
        "eligibility": {
            "status": "not_evaluated",
            "gates": [],
            "detail": (
                "No verified hard eligibility criteria were supplied. "
                "Eligibility is not inferred from CV content."
            ),
        },
    }


def _validated_weights(weights: dict[str, float] | None) -> dict[str, float]:
    if weights is None:
        return dict(CATEGORY_WEIGHTS)
    if set(weights) != set(CATEGORY_WEIGHTS):
        raise ValueError(
            "Scoring weights must define skills, experience, education, and soft_skills."
        )
    normalized: dict[str, float] = {}
    for name in CATEGORY_WEIGHTS:
        value = weights[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Scoring weight '{name}' must be numeric.")
        normalized[name] = float(value)
        if normalized[name] < 0 or normalized[name] > 100:
            raise ValueError(f"Scoring weight '{name}' must be between 0 and 100.")
    if abs(sum(normalized.values()) - 100.0) > 0.001:
        raise ValueError("Scoring weights must total 100.")
    return normalized


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


def supplement_semantic_jd(
    semantic_jd: dict[str, Any], parsed_jd: dict[str, Any]
) -> dict[str, Any]:
    """Keep locally grounded JD requirements omitted by semantic extraction."""
    supplemented = dict(semantic_jd)
    required = _merge_terms(
        semantic_jd.get("required_skills") or [],
        parsed_jd.get("required_skills") or [],
    )
    required_keys = {_term_key(value) for value in required}
    preferred = [
        value
        for value in _merge_terms(
            semantic_jd.get("preferred_skills") or [],
            parsed_jd.get("preferred_skills") or [],
        )
        if _term_key(value) not in required_keys
    ]
    supplemented["required_skills"] = required
    supplemented["preferred_skills"] = preferred
    supplemented["required_skill_groups"] = list(
        semantic_jd.get("required_skill_groups") or []
    )
    supplemented["preferred_skill_groups"] = list(
        semantic_jd.get("preferred_skill_groups") or []
    )
    supplemented["soft_skills"] = _merge_terms(
        semantic_jd.get("soft_skills") or [],
        parsed_jd.get("soft_skills") or [],
    )
    for field in ("experience_years", "education"):
        if supplemented.get(field) is None and parsed_jd.get(field) is not None:
            supplemented[field] = parsed_jd[field]
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


def _skill_requirement_score(
    cv_skills: set[str],
    labels: dict[str, str],
    groups: list[dict],
    *,
    priority: str,
) -> tuple[float, set[str], list[str], list[dict]]:
    matched = {labels[key] for key in set(labels) & cv_skills}
    missing = [labels[key] for key in set(labels) - cv_skills]
    earned_units = float(len(matched))
    total_units = len(labels)
    group_results: list[dict] = []

    for group in groups:
        group_labels, minimum_required = _validated_skill_group(group)
        group_keys = set(group_labels)
        matched_keys = group_keys & cv_skills
        matched_labels = {group_labels[key] for key in matched_keys}
        group_score = min(100.0, (len(matched_keys) / minimum_required) * 100.0)
        satisfied = len(matched_keys) >= minimum_required
        matched.update(matched_labels)
        earned_units += group_score / 100.0
        total_units += 1

        skills = sorted(group_labels.values())
        if not satisfied:
            if minimum_required == 1:
                missing.append(f"One of: {', '.join(skills)}")
            else:
                missing.append(
                    f"At least {minimum_required} of: {', '.join(skills)}"
                )
        group_results.append(
            {
                "priority": priority,
                "minimum_required": minimum_required,
                "skills": skills,
                "matched": sorted(matched_labels),
                "satisfied": satisfied,
                "score": round(group_score, 2),
            }
        )

    score = round((earned_units / total_units) * 100.0, 2) if total_units else 100.0
    return score, matched, missing, group_results


def _validated_skill_group(group: dict) -> tuple[dict[str, str], int]:
    if not isinstance(group, dict):
        raise ValueError("A skill requirement group must be an object.")
    raw_skills = group.get("skills")
    minimum_required = group.get("minimum_required")
    if not isinstance(raw_skills, list) or not all(
        isinstance(skill, str) for skill in raw_skills
    ):
        raise ValueError("A skill requirement group must contain skill names.")
    labels = _term_index(raw_skills)
    if (
        isinstance(minimum_required, bool)
        or not isinstance(minimum_required, int)
        or minimum_required < 1
        or minimum_required > len(labels)
    ):
        raise ValueError("A skill requirement group has an invalid minimum_required.")
    return labels, minimum_required


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
