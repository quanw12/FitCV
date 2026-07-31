"""Prompts and JSON schema for the single-call Gemini CV rebuild step."""

CV_DATA_JSON_SCHEMA: dict = {
    "type": "object",
    "required": ["name"],
    "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "phone": {"type": "string"},
        "links": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "url": {"type": "string"},
                },
            },
        },
        "summary": {"type": "string"},
        "experience": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "company": {"type": "string"},
                    "location": {"type": "string"},
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
                    "links": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "url": {"type": "string"},
                            },
                        },
                    },
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
        "languages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "proficiency": {"type": "string"},
                },
            },
        },
        "publications": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "venue": {"type": "string"},
                    "date": {"type": "string"},
                },
            },
        },
        "awards": {"type": "array", "items": {"type": "string"}},
    },
}

_EXTRACT_PROMPT = """You are an expert CV reviewer and professional CV writer.

You receive the raw text extracted from a candidate's CV.

Step 1 — Extract: Build a structured JSON profile containing ONLY information
explicitly present in the raw text. Capture ALL important information:
contact details, profile links (LinkedIn, GitHub, portfolio), professional
experience, projects, education, skills, certifications, languages,
publications, awards, and honors. Keep numbers, dates, job titles, company
names, and metrics exactly as written. Do not infer, guess, or add anything
that is not in the text.

Step 2 — Polish: Rewrite the summary and each experience bullet to be
professional, concise, grammatically correct, and consistent in style. Do NOT
change facts, and do NOT add skills, responsibilities, numbers, or experiences
that are not present in the extracted data.

Rules:
- Completeness: Do NOT omit important information just to fit the format.
  Every meaningful detail in the raw text belongs in the closest field. Only
  leave out content that is irrelevant for a professional CV, such as
  references, age, or marital status.
- If a field is absent in the raw text, leave it as an empty string or an
  empty array. Never invent placeholder values.
- Use one consistent language for the whole CV: the dominant language of the
  raw text. If the source mixes languages, unify everything into that
  dominant language. Keep technical terms, tools, and domain jargon in their
  original form.
- "name" is the candidate's full name; if not found, use an empty string.
- For "links", use the platform name as the label (for example "LinkedIn" or
  "GitHub") and the full URL as the "url".
- Each project may have its own "links" containing the repository or demo URL
  that appears in the raw text; give the link a short label (for example
  "GitHub" or "Demo") and the full URL as the "url".

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
