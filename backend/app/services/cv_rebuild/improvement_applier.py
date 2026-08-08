"""Build safe prompt instructions from user-selected CV improvements."""

from app.models.improvement import CvImprovementSuggestion, SuggestionType

_MAX_APPLIED = 40


def build_applied_instructions(rows: list[CvImprovementSuggestion]) -> str:
    """Describe selected suggestions without turning skill gaps into new facts."""
    if not rows:
        raise ValueError("Select at least one improvement to apply.")
    if len(rows) > _MAX_APPLIED:
        raise ValueError(f"A maximum of {_MAX_APPLIED} improvements can be applied.")

    instructions: list[str] = []
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
            instructions.append(f"- [Quick win] {suggested} ({explanation})")
        elif row.suggestion_type == SuggestionType.skill_gap:
            instructions.append(
                f'- [Skill gap] The JD needs "{suggested}". Highlight it ONLY '
                "if current CV already proves it, otherwise SKIP entirely."
            )

    if not instructions:
        raise ValueError("The selected improvements could not be applied.")
    return "\n".join(instructions)
