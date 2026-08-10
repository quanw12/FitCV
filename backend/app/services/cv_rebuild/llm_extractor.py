"""Extract + polish a CV from raw text with a single Gemini call."""

from pydantic import ValidationError

from app.core.config import settings
from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.grounding import (
    _ENTRY_COUNT_SECTIONS,
    _find_title_inflation_details,
    find_missing_sections,
    find_project_description_overlap,
    find_title_inflation,
    find_unfounded_numbers,
    find_unfounded_skills,
    find_verb_tense_issues,
)
from app.services.cv_rebuild.prompts import (
    CV_DATA_JSON_SCHEMA,
    build_extraction_prompt,
    build_polish_prompt,
)
from app.services.gemini_client import GeminiClient, GeminiClientError


class CvExtractionError(RuntimeError):
    """Raised when the LLM output is still invalid after all attempts."""


_GROUNDING_MESSAGE = (
    "Grounded-numbers check: the following numbers or metrics in your output "
    "are NOT present in the source text: {numbers}. You MUST remove them and "
    "use the exact numbers from the source. If a metric was phrased differently "
    "in the source, use that exact phrasing."
)

_SKILL_MESSAGE = (
    "Grounded-skills check: the following skills/competencies in your output "
    "are NOT present in ANY field of the source text: {skills}. You MUST "
    "remove them. Keep only skills that actually appear in the source data."
)

_COMPLETENESS_MESSAGE = (
    "Completeness check: the following sections exist in the entered "
    "information but are missing or empty in your output: {sections}. You "
    "MUST restore every dropped section, entry, bullet, and detail."
)

_ENTRY_COUNT_MESSAGE = (
    "Entry-count check: {section} has {entered} entries in the entered data "
    "but only {output} in your output. You MUST NOT merge separate entries "
    "into one — keep each as its own entry even if company/context is "
    "similar. Output exactly {entered} separate {section} entries."
)

_TITLE_MESSAGE = (
    "Title fidelity check: the following experience titles were changed "
    "without justification. You MUST use the exact original title for each "
    "entry: {titles}"
)

_VERB_TENSE_MESSAGE = (
    "Verb tense check: the following lines use present tense but describe "
    "completed work. ALL completed-work verbs MUST use past tense "
    "(Built, Led, Implemented, Engineered) — NEVER present tense "
    "(Build, Lead, Implement, Engineer). Fix these lines: {lines}"
)

_OVERLAP_MESSAGE = (
    "Project description/bullet overlap detected: the following bullets "
    "repeat content already in the project description instead of adding "
    "new information. Each bullet MUST describe something DIFFERENT from "
    "the one-line summary. Rewrite them to cover specific actions, "
    "technologies, or outcomes NOT already stated in the description: "
    "{details}"
)


def _grounding_message(unfounded: list[str]) -> str:
    return _GROUNDING_MESSAGE.format(numbers=", ".join(unfounded))


def _skill_message(skills: list[str]) -> str:
    return _SKILL_MESSAGE.format(skills=", ".join(skills))


def _completeness_message(missing: list[str]) -> str:
    return _COMPLETENESS_MESSAGE.format(sections=", ".join(missing))


def _entry_count_message(section: str, entered: int, output: int) -> str:
    return _ENTRY_COUNT_MESSAGE.format(
        section=section, entered=entered, output=output
    )


def _title_message(titles: list[str]) -> str:
    return _TITLE_MESSAGE.format(titles="; ".join(titles))


def _verb_tense_message(lines: list[str]) -> str:
    return _VERB_TENSE_MESSAGE.format(lines="; ".join(lines))


def _overlap_message(details: list[str]) -> str:
    return _OVERLAP_MESSAGE.format(details="; ".join(details))


def _fix_title_inflation(entered: CVData, polished: CVData) -> CVData:
    """Restore original experience titles only where inflation was flagged.

    Uses the structured details from :func:`_find_title_inflation_details` so
    only entries that were actually inflated/fabricated are restored — and
    each is restored by its own matched original title (correct duplicate
    company alignment).  Returns a new CVData; the input is not mutated.
    """
    details = _find_title_inflation_details(entered, polished)
    if not details:
        return polished

    fixed_experiences = list(polished.experience)
    for detail in details:
        index = detail["index"]
        if 0 <= index < len(fixed_experiences):
            fixed_experiences[index] = fixed_experiences[index].model_copy(
                update={"title": detail["orig"]}
            )
    return polished.model_copy(update={"experience": fixed_experiences})


class CvExtractor:
    def __init__(self, client: GeminiClient | None = None) -> None:
        self._client = client or GeminiClient()

    def extract(
        self,
        raw_text: str,
        *,
        max_attempts: int = 3,
        missing_sections: list[str] | None = None,
    ) -> CVData:
        last_error: str | None = None
        prompt = build_extraction_prompt(
            raw_text, missing_sections=missing_sections
        )
        for _ in range(max_attempts):
            try:
                payload = self._client.generate_structured(
                    prompt=prompt,
                    response_schema=CV_DATA_JSON_SCHEMA,
                    temperature=settings.gemini_cv_rebuild_temperature,
                    seed=settings.gemini_cv_rebuild_seed,
                )
            except GeminiClientError:
                raise
            try:
                return CVData.model_validate(payload)
            except ValidationError as exc:
                last_error = str(exc)
                prompt = build_extraction_prompt(raw_text, last_error)
        raise CvExtractionError(
            f"AI returned an invalid CV structure after {max_attempts} attempts. "
            f"Last validation errors: {last_error}"
        )

    def polish(
        self,
        cv: CVData,
        *,
        language: str = "en",
        max_attempts: int = 3,
        jd_text: str | None = None,
        applied_improvements: str | None = None,
        baseline: CVData | None = None,
    ) -> tuple[CVData, list[str]]:
        last_error: str | None = None
        entered = baseline or cv
        source_text = entered.model_dump_json()
        prompt = build_polish_prompt(
            source_text,
            language,
            jd_text=jd_text,
            applied_improvements=applied_improvements,
        )
        # Best-attempt tracking: lowest guard-issue count wins (later attempt
        # on a tie) so exhaustion returns the most complete, most grounded
        # output instead of the last one tried.
        best_cv: CVData | None = None
        best_score: int | None = None
        for _ in range(max_attempts):
            try:
                payload = self._client.generate_structured(
                    prompt=prompt,
                    response_schema=CV_DATA_JSON_SCHEMA,
                    temperature=settings.gemini_cv_rebuild_temperature,
                    seed=settings.gemini_cv_rebuild_seed,
                )
            except GeminiClientError:
                raise
            try:
                polished = CVData.model_validate(payload)
            except ValidationError as exc:
                last_error = str(exc)
                prompt = build_polish_prompt(
                    source_text,
                    language,
                    last_error,
                    jd_text=jd_text,
                    applied_improvements=applied_improvements,
                )
                continue
            unfounded_nums = find_unfounded_numbers(source_text, polished)
            unfounded_skills = find_unfounded_skills(source_text, polished)
            missing = find_missing_sections(entered, polished)
            title_issues = find_title_inflation(entered, polished)
            verb_issues = find_verb_tense_issues(polished)
            overlap_issues = find_project_description_overlap(polished)
            if unfounded_nums or unfounded_skills or missing or title_issues or verb_issues or overlap_issues:
                issue_score = (
                    len(unfounded_nums)
                    + len(unfounded_skills)
                    + len(missing)
                    + len(title_issues)
                    + len(verb_issues)
                    + len(overlap_issues)
                )
                if best_score is None or issue_score <= best_score:
                    best_cv = polished
                    best_score = issue_score
                messages: list[str] = []
                if unfounded_nums:
                    messages.append(_grounding_message(unfounded_nums))
                if unfounded_skills:
                    messages.append(_skill_message(unfounded_skills))
                # Split missing into plain sections vs merged_* count issues
                plain_missing = [
                    m for m in missing if not m.startswith("merged_")
                ]
                merged_sections = [
                    m for m in missing if m.startswith("merged_")
                ]
                if plain_missing:
                    messages.append(_completeness_message(plain_missing))
                for section_label in merged_sections:
                    section = section_label[len("merged_"):]
                    e_count = len(getattr(entered, section) or [])
                    o_count = len(getattr(polished, section) or [])
                    messages.append(
                        _entry_count_message(section, e_count, o_count)
                    )
                if title_issues:
                    messages.append(_title_message(title_issues))
                if verb_issues:
                    messages.append(_verb_tense_message(verb_issues))
                if overlap_issues:
                    messages.append(_overlap_message(overlap_issues))
                last_error = "\n".join(messages)
                prompt = build_polish_prompt(
                    source_text,
                    language,
                    last_error,
                    jd_text=jd_text,
                    applied_improvements=applied_improvements,
                )
                continue
            # Hard-override: restore original titles even on clean pass
            # (LLM may have silently fixed some titles but not others)
            return _fix_title_inflation(entered, polished), []
        # Exhausted retries — return the best attempt with warnings
        warnings: list[str] = []
        if best_cv is not None:
            unfounded_nums = find_unfounded_numbers(source_text, best_cv)
            unfounded_skills = find_unfounded_skills(source_text, best_cv)
            missing = find_missing_sections(entered, best_cv)
            title_issues = find_title_inflation(entered, best_cv)
            verb_issues = find_verb_tense_issues(best_cv)
            if unfounded_nums:
                warnings.append(
                    f"Numbers not grounded in source: {', '.join(unfounded_nums)}"
                )
            if unfounded_skills:
                warnings.append(
                    f"Skills not grounded in source: {', '.join(unfounded_skills)}"
                )
            merged = [m for m in missing if m.startswith("merged_")]
            plain_missing = [m for m in missing if not m.startswith("merged_")]
            if plain_missing:
                warnings.append(
                    f"Sections/fields missing from output: {', '.join(plain_missing)}"
                )
            for section_label in merged:
                section = section_label[len("merged_"):]
                e_count = len(getattr(entered, section) or [])
                o_count = len(getattr(best_cv, section) or [])
                warnings.append(
                    f"Entries merged in {section}: entered {e_count}, "
                    f"output {o_count} — keep each entry separate"
                )
            if title_issues:
                warnings.append(
                    f"Titles changed from input: {'; '.join(title_issues)}"
                )
            if verb_issues:
                warnings.append(
                    f"Present-tense verbs in completed work: {'; '.join(verb_issues)}"
                )
            overlap_issues = find_project_description_overlap(best_cv)
            if overlap_issues:
                warnings.append(
                    f"Project description/bullet overlap: {'; '.join(overlap_issues)}"
                )
            # Hard-override: restore original titles on fallback too
            best_cv = _fix_title_inflation(entered, best_cv)
            return best_cv, warnings
        raise CvExtractionError(
            f"AI returned an invalid CV structure after {max_attempts} attempts. "
            f"Last validation errors: {last_error}"
        )
