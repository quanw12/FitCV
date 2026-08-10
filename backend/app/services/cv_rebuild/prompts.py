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
        "core_competencies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
            },
        },
        "skill_groups": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "items": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "projects": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "bullets": {"type": "array", "items": {"type": "string"}},
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
- CRITICAL — verb tense consistency: ALL verbs describing completed work —
  in summary lines, bullets, project descriptions, and competency
  descriptions — MUST use past tense (Built, Led, Implemented, Engineered,
  Designed, Delivered, Contributed, Developed, Optimized, Deployed), NEVER
  present tense (Build, Lead, Implement, Engineer, Design, Deliver,
  Contribute, Develop, Optimize, Deploy). This applies uniformly within a
  single entry: a project's one-line summary and its bullets must use the
  same tense. If the work is ongoing, use present tense consistently
  throughout that entry — but never mix tenses within one entry.
- CRITICAL — do not fabricate experience titles: if the source does not
  provide an explicit job title or role for an entry (for example a
  collaboration, contribution, or project entry that only names the project
  or topic without a role label), the "title" field MUST be left empty.
  Do NOT invent professional titles like "Researcher", "Contributor",
  "Collaborator", "Engineer", "Specialist", etc. When no title is present,
  describe the work in the bullets and use the company/project name field
  instead. A fabricated title from empty input is a defect.
- Bullets: begin each bullet with a strong action verb, keep it to one or two
  concise lines, avoid personal pronouns (I, we, my), and keep concrete
  numbers or metrics when the source provides them.
- CRITICAL — never collapse an enumerated or parenthetical list into a vague
  summary phrase, regardless of bullet length. If the source text lists
  specific items (separated by commas, listed in parentheses, or after a
  colon — such as component names, feature names, tool names, or technology
  names), EVERY listed item must appear in the output. A longer accurate
  bullet that preserves the full list is always correct; a shorter bullet
  that replaces the list with a generic phrase (e.g. "various components",
  "multiple features", "hardware and system control") is a defect and must
  never be produced. Only tighten grammar and connecting words around the
  list — never remove or generalize list items themselves.
- Preserve technical detail: NEVER drop technology keywords, product names,
  or acronyms that appear in the source (for example JWT, VNPay, Admin
  Dashboard, Redis, microservices). When polishing bullets and project
  descriptions, keep every such keyword and keep the concrete work detail.
  When in doubt, keep MORE detail instead of summarizing into generic lines;
  technical recruiters judge projects by the keywords and the real work.
- Career goal: if the source contains a personal objective or career goal,
  merge it into "summary" so the intro shows the direction; do not delete
  it and do not add a separate objective section.
- Certifications: keep ONLY certifications the candidate has completed. Do
  not include planned or in-progress certifications; a CV lists credentials,
  not intentions.
- ATS-safe text: convert rating symbols (★, ☆, ●, ▲, ■ and similar) in
  languages or skills into clear words, for example "Native", "Fluent",
  "Intermediate" (English) or "Thành thạo", "Khá", "Cơ bản" (Vietnamese), or
  a CEFR level. Do not output decorative symbols anywhere in the JSON; ATS
  scanners cannot read them.
- Preserve self-directed learning: keep expressions of self-study and
  initiative exactly as they appear ("self-taught", "tự học", "tự tìm hiểu",
  "built a HomeLab", "nghiên cứu độc lập"). Do not rewrite them into neutral
  administrative language; for intern and fresher candidates these are
  highlights.
- Completeness: Do NOT omit important information just to fit the format.
  Every meaningful detail in the raw text belongs in the closest field. Only
  leave out content that is irrelevant for a professional CV, such as
  references, age, or marital status.
- "skills" is a compact list of short technology, framework, and tool names
  only (for example "Python", "React", "Docker"); keep the raw names exactly
  as written, without explanations.
- "core_competencies" is a curated section: choose 5-7 capability themes
  (for example "Computer Vision", "Edge AI", "Backend Architecture") that
  represent the candidate's strongest domains. The "name" is a domain or
  capability theme — NOT a single tool name (write "Backend Development"
  not "Python"; the "skills" section lists tool names). The "description"
  must emphasize proven capability and scale: what the candidate built or
  delivered, at what scale, with what impact (for example "built 3
  production computer vision pipelines deployed at city-level events" or
  "designed microservices architecture serving 10K+ daily active users").
  Do NOT repeat tool or technology names already listed in "skills" inside
  the description — the description tells the story of what the candidate
  can DO, not what tools they use. Ground strictly in the CV; do not invent
  depth the CV does not show.
- "skill_groups" organizes the technical "skills" into 2-4 categories (for
  example "Languages", "Frameworks & Libraries", "Tools & Platforms"); each
  item stays a short name. Only include this field when there are enough
  skills to group; otherwise leave it as an empty array.
- If a field is absent in the raw text, leave it as an empty string or an
  empty array. Never invent placeholder values.
- Language consistency is MANDATORY: choose ONE language for the entire CV —
  the dominant language of the raw text — and write EVERY field in that
  language: summary, job titles, experience bullets, project descriptions,
  competency names and descriptions, certifications, education degrees, and
  awards. If the source mixes languages, translate the minority-language
  content into the dominant language. A CV whose summary is in one language
  while its bullets, headings, or other sections are in another is a defect;
  never produce that. Only the candidate's name, technical terms, tool
  names, company names, locations, and URLs stay in their original form.
- "name" is the candidate's full name; if not found, use an empty string.
  Keep it exactly as written, including Vietnamese diacritics (for example
  "Nguyễn Văn A"), even when the rest of the CV is in English.
- For "links", use the platform name as the label (for example "LinkedIn" or
  "GitHub") and the full URL as the "url".
- Each project may have its own "links" containing the repository or demo URL
  that appears in the raw text; give the link a short label (for example
  "GitHub" or "Demo") and the full URL as the "url".
- For projects: use "description" as a one-line executive summary of the
  project (what the project IS, in one sentence). Then put detailed
  information in "bullets" — each bullet should be one concise line starting
  with a strong action verb, covering features built, technologies used,
  architecture decisions, or outcomes achieved.
  CRITICAL — description and bullets must NOT overlap: the description is a
  high-level summary (what it is), bullets describe WHAT WAS DONE (specific
  actions, technologies, outcomes). Do NOT write the description first and
  then expand the same sentence into bullet 1 — this creates redundant,
  repetitive content and is a defect. Each bullet must cover DIFFERENT
  information not already stated in the description.
  CORRECT example:
    description: "AI voice assistant running on ESP32 with zero cloud dependency."
    bullets: ["Implemented streaming ASR pipeline using Whisper Tiny.", "Integrated LLM inference with Qwen 3 for on-device conversation.", "Engineered TTS output with Coqui TTS and I2S audio driver."]
  WRONG example (description repeats in bullet 1):
    description: "AI voice assistant on ESP32 with streaming ASR, LLM, and TTS."
    bullets: ["Engineered an AI voice assistant on ESP32 with streaming ASR, LLM, and TTS."] ← DEFECT: same content as description
  If the project has a simple one-line description with no further detail,
  leave "bullets" empty.

Raw CV text:
<cv_text>

Reminder: do not collapse any enumerated list from the source into a generic
phrase. Every listed item must appear individually in the output.

Output ONLY the JSON object matching the provided schema."""

_VALIDATION_SUFFIX = """

Previous attempt was rejected by validation. Fix exactly these errors and
output only the corrected JSON:

<validation_error>
"""

_LANGUAGE_LABELS = {"en": "English", "vi": "Vietnamese"}

_BUILD_PROMPT = """You are an expert CV writer. The candidate entered their CV
information in a form and selected the CV language: <language_label>.

Polish the entered information into a professional, ATS-friendly CV profile.
Follow the schema exactly.

Rules:
- CRITICAL — verb tense consistency: ALL verbs describing completed work —
  in summary lines, bullets, project descriptions, and competency
  descriptions — MUST use past tense (Built, Led, Implemented, Engineered,
  Designed, Delivered, Contributed, Developed, Optimized, Deployed), NEVER
  present tense (Build, Lead, Implement, Engineer, Design, Deliver,
  Contribute, Develop, Optimize, Deploy). This applies uniformly within a
  single entry: a project's one-line summary and its bullets must use the
  same tense. If the work is ongoing, use present tense consistently
  throughout that entry — but never mix tenses within one entry.
- Polish for impact: paraphrase the entered information into confident,
  impressive, results-oriented language with strong action verbs ("built",
  "led", "designed", "optimized", "delivered" instead of "did", "worked on",
  "helped with"). Fix grammar and avoid personal pronouns (I, we, my).
  Never upgrade an action the candidate did not claim: "participated in"
  must not become "led". Never change facts, numbers, dates, names, or
  URLs, and never add experience the candidate did not enter.
- Never invent anything: no new skills, technologies, numbers, metrics,
  percentages, counts, responsibilities, projects, or outcomes beyond what
  the candidate entered. Every number in your output must already exist in
  the entered information.
- CRITICAL — do not fabricate experience titles: if the entered title is
  empty for an entry, the polished "title" field MUST also be left empty.
  Do NOT invent professional titles like "Researcher", "Contributor",
  "Collaborator", "Engineer", "Specialist", etc. When no title is present,
  describe the work in the bullets and use the company/project name field
  instead. A fabricated title from empty input is a defect.
- CRITICAL — never collapse an enumerated or parenthetical list into a vague
  summary phrase, regardless of bullet length. If the entered data lists
  specific items (separated by commas, listed in parentheses, or after a
  colon — such as component names, feature names, tool names, or technology
  names), EVERY listed item must appear in the output. A longer accurate
  bullet that preserves the full list is always correct; a shorter bullet
  that replaces the list with a generic phrase (e.g. "various components",
  "multiple features", "hardware and system control") is a defect and must
  never be produced. Only tighten grammar and connecting words around the
  list — never remove or generalize list items themselves.
- Completeness is MANDATORY: every entered section and every entered entry
  must survive the polish. Keep ALL sections — education, projects,
  certifications, publications, awards, languages, experience — even when a
  section seems minor. Never drop an entered bullet, project, publication,
  certification, award, education entry, or language, and never merge
  several entered entries into one. Keep every bullet and description
  complete; do not truncate them for brevity. When in doubt, keep MORE
  detail instead of summarizing into generic lines.
- Preserve technical detail: NEVER drop technology keywords, product names,
  or acronyms the candidate entered (for example JWT, VNPay, Admin
  Dashboard, Redis).
- Keep expressions of self-study and initiative exactly as they appear
  ("self-taught", "tự học", "built a HomeLab", "nghiên cứu độc lập").
- Keep the candidate's name exactly as entered, including Vietnamese
  diacritics (for example "Nguyễn Văn A"), even when the selected CV
  language is English.
- Language consistency is MANDATORY: write EVERY field — summary, job titles,
  experience bullets, project descriptions, competency names and
  descriptions, certifications, education degrees, and awards — in the
  selected language (<language_label>), translating the entered content when
  needed. Never leave a field in a different language. Only the candidate's
  name, technical terms, tool names, company names, locations, and URLs stay
  in their original form.
- "summary": polish it and merge in any career goal the candidate mentioned.
- "skills": keep the short tool names exactly as entered. If there are
  enough skills, also organize them into "skill_groups" with 2-4 categories
  (for example Languages, Frameworks & Libraries, Tools & Platforms).
- "core_competencies": derive 5-7 capability themes from the entered
  experience and skills — domain-level strengths like "Computer Vision",
  "Backend Architecture", or "Data Engineering", not individual tool names.
  The "name" is a capability theme; the "description" must emphasize proven
  capability and scale: what the candidate built or delivered, at what scale,
  with what impact (e.g. "built 3 production pipelines deployed at
  city-level events", "designed microservices serving 10K+ daily users").
  Do NOT repeat tool or technology names already in "skills" inside the
  description — the description tells the story of capability, not a tool
  list. Ground ONLY in the entered data. Do not invent facts.
- ATS-safe: do not output decorative symbols anywhere (★, ☆, ●, ✓, ▲...).
  Convert rating symbols in language proficiency into words ("Native",
  "Fluent", "Intermediate" or "Thành thạo", "Khá", "Cơ bản").
- Empty arrays mean the candidate did not provide that section; leave them
  empty. Do not invent placeholder values.
- Projects: keep "description" as a short one-line executive summary (what the
  project IS). Put detailed information in "bullets" — each bullet one concise
  line starting with a strong action verb. CRITICAL — description and bullets
  must NOT overlap: the description is a high-level summary, bullets describe
  WHAT WAS DONE (specific actions, technologies, outcomes). Do NOT write the
  description first and then expand the same sentence into bullet 1 — this
  creates redundant, repetitive content and is a defect. Each bullet must
  cover DIFFERENT information not already stated in the description. If the
  candidate entered a multi-sentence project description, split it into
  separate bullets. If bullets already exist, keep them; if only a description
  exists, split it into bullets when there is meaningful detail to separate.
  The same "never collapse enumerated list" rule applies to project bullets.

Entered CV JSON:
<cv_json>

Reminder: do not collapse any enumerated list from the source into a generic
phrase. Every listed item must appear individually in the output.

Output ONLY the JSON object matching the provided schema."""


def build_extraction_prompt(
    raw_text: str,
    validation_error: str | None = None,
    missing_sections: list[str] | None = None,
) -> str:
    prompt = _EXTRACT_PROMPT.replace("<cv_text>", raw_text.strip())
    if validation_error:
        prompt = prompt + _VALIDATION_SUFFIX.replace(
            "<validation_error>", validation_error.strip()
        )
    if missing_sections:
        remediation = (
            "\n\nCRITICAL — you omitted sections that are clearly present in the "
            "source text: "
            + ", ".join(missing_sections)
            + ". You MUST re-scan the raw text and include EVERY entry for those "
            "sections (all experience roles, all education entries, all projects, "
            "all skills). Do not drop or merge them."
        )
        prompt = prompt + remediation
    return prompt


def build_polish_prompt(
    cv_json: str,
    language: str,
    validation_error: str | None = None,
    jd_text: str | None = None,
    applied_improvements: str | None = None,
) -> str:
    prompt = _BUILD_PROMPT.replace(
        "<language_label>", _LANGUAGE_LABELS.get(language, "English")
    )
    context_blocks = ""
    if jd_text:
        jd_block = (
            "\n\nJob description for tailoring (optional):\n"
            "<jd_text>\n"
            f"{jd_text.strip()[:8000]}\n"
            "</jd_text>\n"
            "Tailor the CV to this job: prioritize and reorder skills, "
            "core_competencies, and experience-bullet order by relevance to the "
            "JD, and emphasize JD keyword overlaps already present in the entered "
            "data. Keep every fact 100% grounded in the entered data and re-run "
            "the number/skill/section grounding checks. Never invent skills, "
            "technologies, or metrics that the entered data does not state, and "
            "never add a skill just because it appears in the JD.\n"
        )
        context_blocks += jd_block
    if applied_improvements:
        improvement_block = (
            "\nSelected improvements to apply (reviewed by the candidate):\n"
            "<approved_improvements>\n"
            f"{applied_improvements.strip()[:8000]}\n"
            "</approved_improvements>\n"
            "Apply every instruction when the entered CV already provides the "
            "necessary facts. If an instruction would require a new skill, "
            "technology, employer, date, metric, or achievement, skip only that "
            "unsupported part. Never invent or infer facts from the job description "
            "or these instructions; the entered CV JSON remains the sole source of "
            "truth. Re-run all number, skill, title, and section grounding checks.\n"
        )
        context_blocks += improvement_block
    if context_blocks:
        prompt = prompt.replace("<cv_json>", context_blocks + "<cv_json>")
    prompt = prompt.replace("<cv_json>", cv_json.strip())
    if validation_error:
        prompt = prompt + _VALIDATION_SUFFIX.replace(
            "<validation_error>", validation_error.strip()
        )
    return prompt
