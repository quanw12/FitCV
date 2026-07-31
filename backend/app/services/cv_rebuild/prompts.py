"""Prompts and JSON schema for the single-call Gemini CV rebuild step."""

CV_DATA_JSON_SCHEMA: dict = {
    "type": "object",
    "required": ["name"],
    "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "phone": {"type": "string"},
        "summary": {"type": "string"},
        "experience": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "company": {"type": "string"},
                    "date": {"type": "string"},
                    "bullets": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "skills": {"type": "array", "items": {"type": "string"}},
        "projects": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
            },
        },
        "certifications": {"type": "array", "items": {"type": "string"}},
        "education": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "degree": {"type": "string"},
                    "institution": {"type": "string"},
                    "date": {"type": "string"},
                },
            },
        },
    },
}

_EXTRACT_PROMPT = """You are an expert CV reviewer and professional CV writer.

You receive the raw text extracted from a candidate's CV.

Step 1 — Extract: Build a structured JSON profile containing ONLY information
explicitly present in the raw text. Keep numbers, dates, job titles, company
names, and metrics exactly as written. Do not infer, guess, or add anything
that is not in the text.

Step 2 — Polish: Rewrite the summary and each experience bullet to be
professional, concise, grammatically correct, and consistent in style. Do NOT
change facts, and do NOT add skills, responsibilities, numbers, or experiences
that are not present in the extracted data.

Rules:
- If a field is absent in the raw text, leave it as an empty string or an
  empty array. Never invent placeholder values.
- Preserve the original language of the content.
- "name" is the candidate's full name; if not found, use an empty string.

Raw CV text:
<cv_text>

Output ONLY the JSON object matching the provided schema."""

_VALIDATION_SUFFIX = """

Previous attempt was rejected by validation. Fix exactly these errors and
output only the corrected JSON:

<validation_error>
"""


def build_extraction_prompt(raw_text: str, validation_error: str | None = None) -> str:
    prompt = _EXTRACT_PROMPT.replace("<cv_text>", raw_text.strip())
    if validation_error:
        prompt = prompt + _VALIDATION_SUFFIX.replace(
            "<validation_error>", validation_error.strip()
        )
    return prompt
