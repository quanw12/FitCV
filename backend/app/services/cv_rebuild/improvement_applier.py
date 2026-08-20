"""Build prompt instructions from user-selected CV improvements."""

from app.models.improvement import CvImprovementSuggestion, SuggestionType

_MAX_APPLIED = 40


def build_applied_instructions(
    rows: list[CvImprovementSuggestion],
) -> tuple[str, list[str]]:
    """Describe selected suggestions and collect approved skill-gap additions.

    Skill gaps are explicit candidate-approved additions: the candidate
    reviewed each missing skill and chose to add it, so the rebuild may
    insert those exact skill names even though they are absent from the
    source CV. Returns ``(instructions, approved_new_skills)``.
    """
    if not rows:
        raise ValueError("Select at least one improvement to apply.")
    if len(rows) > _MAX_APPLIED:
        raise ValueError(f"A maximum of {_MAX_APPLIED} improvements can be applied.")

    instructions: list[str] = []
    approved_skills: list[str] = []
    for row in rows:
        section = row.section or "Other"
        suggested = row.suggested_text or ""
        explanation = row.explanation or ""
        original = row.original_text or ""

        if row.suggestion_type == SuggestionType.rewrite:
            instructions.append(
                f'- [Rewrite · {section}] Replace "{original}" → "{suggested}"'
            )
        elif row.suggestion_type == SuggestionType.section_feedback:
            instructions.append(
                f'- [Section · {section}] "{original}" → Action: {suggested}'
            )
        elif row.suggestion_type == SuggestionType.quick_win:
            category = (
                (row.metadata_json or {}).get("category")
                or row.category.value
                or "Other"
            )
            instructions.append(
                f"- [Quick win · {category}] {suggested} ({explanation})"
            )
        elif row.suggestion_type == SuggestionType.skill_gap:
            instructions.append(
                f'- [Skill gap · approved] The candidate reviewed and approved '
                f'adding "{suggested}" as a new skill. Add it, using this exact '
                "name, to the skills list and to the most relevant skill_groups "
                "category (create a suitable category when none fits)."
            )
            if suggested and suggested not in approved_skills:
                approved_skills.append(suggested)

    if not instructions:
        raise ValueError("The selected improvements could not be applied.")
    return "\n".join(instructions), approved_skills
