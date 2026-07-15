from __future__ import annotations

from io import BytesIO
import re
from zipfile import ZipFile

from fastapi import HTTPException, UploadFile, status

from app.schemas.cv_ranking import BatchParseResponse, ParsedCandidateResponse, ScoreBreakdown


MAX_FILE_SIZE = 10 * 1024 * 1024
KNOWN_SKILLS = [
    "Node.js",
    "TypeScript",
    "JavaScript",
    "Python",
    "Java",
    "Spring Boot",
    "Django",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Docker",
    "Kubernetes",
    "AWS",
    "REST API",
    "GraphQL",
    "FastAPI",
    "React",
    "Next.js",
]


def _format_bytes(size: int) -> str:
    if size < 1024 * 1024:
        return f"{max(1, round(size / 1024))} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", " ", value.lower())


def _candidate_name_from_file(file_name: str) -> str:
    base_name = re.sub(r"\.[^.]+$", "", file_name)
    base_name = re.sub(r"[_-]+", " ", base_name).strip()
    base_name = re.sub(r"\b(cv|resume|profile|candidate)\b", "", base_name, flags=re.IGNORECASE)
    base_name = re.sub(r"\s+", " ", base_name).strip()
    return base_name.title() if base_name else "Unnamed Candidate"


def _extract_docx_text(content: bytes) -> tuple[str, str | None]:
    try:
        from docx import Document

        document = Document(BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
        return text, None
    except ImportError:
        pass
    except Exception as exc:
        return "", f"DOCX parser failed: {exc}"

    try:
        with ZipFile(BytesIO(content)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
        text = re.sub(r"<[^>]+>", " ", xml)
        return re.sub(r"\s+", " ", text), "python-docx is not installed; used a simple XML fallback."
    except Exception as exc:
        return "", f"DOCX XML fallback failed: {exc}"


def _extract_pdf_text(content: bytes) -> tuple[str, str | None]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text, None
    except ImportError:
        return "", "pypdf is not installed; PDF text was not extracted."
    except Exception as exc:
        return "", f"PDF parser failed: {exc}"


def _extract_text(file_name: str, content: bytes) -> tuple[str, str | None]:
    extension = file_name.rsplit(".", 1)[-1].lower()
    if extension == "pdf":
        return _extract_pdf_text(content)
    if extension == "docx":
        return _extract_docx_text(content)
    return "", "Unsupported file type."


def _extract_skills(source: str) -> list[str]:
    normalized = _normalize(source)
    return [skill for skill in KNOWN_SKILLS if _normalize(skill).strip() in normalized]


def _required_skills(job_description: str) -> list[str]:
    skills = _extract_skills(job_description)
    return skills if skills else ["Node.js", "TypeScript", "PostgreSQL", "Docker"]


def _first_match(pattern: str, source: str, default: str) -> str:
    match = re.search(pattern, source, flags=re.IGNORECASE)
    return match.group(0).strip() if match else default


def _infer_name(text: str, file_name: str) -> str:
    for line in text.splitlines()[:8]:
        value = line.strip()
        if 2 <= len(value) <= 80 and not re.search(r"@|\d{4,}", value):
            return value.title()
    return _candidate_name_from_file(file_name)


def _infer_experience_years(source: str) -> int:
    match = re.search(r"(\d+)\s*(?:years?|yrs?)", source, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    if re.search(r"senior|lead|principal", source, flags=re.IGNORECASE):
        return 5
    if re.search(r"middle|mid", source, flags=re.IGNORECASE):
        return 3
    if re.search(r"junior|intern|fresher", source, flags=re.IGNORECASE):
        return 1
    return 2


def _infer_education(source: str) -> str:
    if re.search(r"master|msc", source, flags=re.IGNORECASE):
        return "Master degree mentioned"
    if re.search(r"bachelor|bs|bsc|computer science|software engineering|cs\b", source, flags=re.IGNORECASE):
        return "Bachelor or CS background mentioned"
    return "Education not detected"


def _score_candidate(
    skills: list[str], experience_years: int, education: str, required_skills: list[str]
) -> tuple[int, ScoreBreakdown]:
    matched_count = len([skill for skill in required_skills if skill in skills])
    skill_score = round((matched_count / len(required_skills)) * 100) if required_skills else 0
    experience_score = min(100, round((experience_years / 5) * 100))
    education_score = 45 if education == "Education not detected" else 85
    total = round(skill_score * 0.6 + experience_score * 0.3 + education_score * 0.1)
    return max(0, min(100, total)), ScoreBreakdown(
        skills=skill_score,
        experience=experience_score,
        education=education_score,
    )


async def parse_batch(files: list[UploadFile], job_description: str) -> BatchParseResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one CV file is required.")

    required = _required_skills(job_description)
    warnings: list[str] = []
    candidates: list[ParsedCandidateResponse] = []

    for file in files:
        extension = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
        if extension not in {"pdf", "docx"}:
            warnings.append(f"{file.filename}: Only PDF and DOCX files are supported.")
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            warnings.append(f"{file.filename}: File must be 10MB or smaller.")
            continue

        parsed_text, parse_warning = _extract_text(file.filename, content)
        source = "\n".join([file.filename, parsed_text])
        skills = _extract_skills(source)
        missing_skills = [skill for skill in required if skill not in skills]
        experience_years = _infer_experience_years(source)
        education = _infer_education(source)
        score, score_breakdown = _score_candidate(skills, experience_years, education, required)

        notes = [
            "MVP parser extracts text when local parser dependencies are available.",
            "Ranking is rule-based for now; AI scoring will be designed in the next phase.",
        ]
        if parse_warning:
            notes.append(parse_warning)
            warnings.append(f"{file.filename}: {parse_warning}")

        candidates.append(
            ParsedCandidateResponse(
                id=f"{file.filename}-{len(content)}",
                file_name=file.filename,
                file_type=extension.upper(),
                file_size_label=_format_bytes(len(content)),
                name=_infer_name(parsed_text, file.filename),
                email=_first_match(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", parsed_text, "Not detected"),
                phone=_first_match(r"(?:\+?\d[\d\s().-]{7,}\d)", parsed_text, "Not detected"),
                location="Not detected",
                position="Senior Backend Developer",
                skills=skills,
                missing_skills=missing_skills,
                experience_years=experience_years,
                education=education,
                score=score,
                score_breakdown=score_breakdown,
                status="Ready",
                parse_notes=notes,
            )
        )

    return BatchParseResponse(
        required_skills=required,
        candidates=sorted(candidates, key=lambda candidate: candidate.score, reverse=True),
        warnings=warnings,
    )
