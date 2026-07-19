import re
from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile

PARSER_VERSION = "fitcv-parser-v1"
MAX_CV_BYTES = 10 * 1024 * 1024

SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "Python": ("python",),
    "Java": ("java",),
    "JavaScript": ("javascript", "js"),
    "TypeScript": ("typescript", "ts"),
    "C++": ("c++",),
    "C#": ("c#", "c sharp"),
    "Go": ("golang",),
    "PHP": ("php",),
    "HTML": ("html",),
    "CSS": ("css",),
    "React": ("react.js", "reactjs", "react"),
    "Node.js": ("node.js", "nodejs", "node js"),
    "FastAPI": ("fastapi",),
    "Django": ("django",),
    "Flask": ("flask",),
    "Laravel": ("laravel",),
    "SQL": ("sql",),
    "MySQL": ("mysql",),
    "PostgreSQL": ("postgresql", "postgres"),
    "MongoDB": ("mongodb", "mongo db"),
    "Redis": ("redis",),
    "REST APIs": ("rest api", "restful api", "restful services"),
    "GraphQL": ("graphql",),
    "Microservices": ("microservices", "microservice architecture"),
    "Docker": ("docker",),
    "Kubernetes": ("kubernetes", "k8s"),
    "AWS": ("amazon web services", "aws"),
    "Azure": ("microsoft azure", "azure"),
    "Google Cloud": ("google cloud platform", "google cloud", "gcp"),
    "Git": ("git",),
    "CI/CD": ("ci/cd", "continuous integration", "continuous delivery"),
    "Linux": ("linux",),
    "Bash": ("bash", "shell scripting"),
    "Agile": ("agile",),
    "Scrum": ("scrum",),
    "Machine Learning": ("machine learning",),
    "Active Directory": ("active directory",),
    "Burp Suite": ("burp suite",),
    "Cybersecurity": ("cybersecurity", "cyber security"),
    "Digital Forensics": ("digital forensics",),
    "Firewalls": ("firewall", "firewalls"),
    "Incident Response": ("incident response",),
    "IDS/IPS": ("ids/ips", "intrusion detection", "intrusion prevention"),
    "MITRE ATT&CK": ("mitre att&ck", "mitre attack"),
    "Microsoft Sentinel": ("microsoft sentinel", "azure sentinel"),
    "Network Security": ("network security",),
    "Nessus": ("nessus",),
    "Nmap": ("nmap",),
    "OWASP Top 10": ("owasp top 10", "owasp top ten"),
    "SIEM": ("siem", "security information and event management"),
    "SOC": ("security operations center", "soc"),
    "Splunk": ("splunk",),
    "TCP/IP": ("tcp/ip", "tcp ip"),
    "Vulnerability Assessment": ("vulnerability assessment", "vulnerability scanning"),
    "Wireshark": ("wireshark",),
}

SOFT_SKILLS: dict[str, tuple[str, ...]] = {
    "Communication": ("communication", "communicate"),
    "Teamwork": ("teamwork", "team player", "collaboration", "collaborative"),
    "Leadership": ("leadership", "lead a team", "mentoring"),
    "Problem Solving": ("problem solving", "problem-solving", "analytical thinking"),
    "Adaptability": ("adaptability", "adaptable"),
    "Time Management": ("time management", "prioritization"),
}


def validate_cv_content(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise ValueError("The uploaded file is not a valid PDF.")
        return "PDF"
    if suffix == ".docx":
        try:
            with ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
        except BadZipFile as exc:
            raise ValueError("The uploaded file is not a valid DOCX document.") from exc
        if "[Content_Types].xml" not in names or "word/document.xml" not in names:
            raise ValueError("The uploaded file is not a valid DOCX document.")
        return "DOCX"
    raise ValueError("Only PDF and DOCX files are supported.")


def extract_document_text(file_path: Path, file_type: str) -> str:
    if file_type == "PDF":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise RuntimeError("PDF parsing is unavailable; install backend requirements.") from exc
        text = "\n".join(page.extract_text() or "" for page in PdfReader(str(file_path)).pages)
    elif file_type == "DOCX":
        from docx import Document

        document = Document(str(file_path))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        table_rows = [" | ".join(cell.text for cell in row.cells) for table in document.tables for row in table.rows]
        text = "\n".join([*paragraphs, *table_rows])
    else:
        raise ValueError("Unsupported CV file type.")

    normalized = _normalize_text(text)
    if len(normalized) < 20:
        raise ValueError("No readable CV text was found. Scanned PDFs require OCR before upload.")
    return normalized


def parse_cv_text(text: str) -> dict:
    normalized = _normalize_text(text)
    if len(normalized) < 20:
        raise ValueError("CV text is empty or too short to parse.")
    return {
        "skills": _extract_terms(normalized, SKILL_ALIASES),
        "experience_years": _extract_years(normalized),
        "education": _extract_education(normalized),
        "soft_skills": _extract_terms(normalized, SOFT_SKILLS),
        "sections": _extract_sections(normalized),
    }


def parse_jd_text(text: str) -> dict:
    normalized = _normalize_text(text)
    if len(normalized) < 50:
        raise ValueError("Job description must contain at least 50 readable characters.")

    required: set[str] = set()
    preferred: set[str] = set()
    chunks = re.split(r"\n+|(?<=[.!?])\s+", normalized)
    for chunk in chunks:
        found = set(_extract_terms(chunk, SKILL_ALIASES))
        if not found:
            continue
        if re.search(r"\b(preferred|nice to have|bonus|plus|advantage)\b", chunk, re.IGNORECASE):
            preferred.update(found)
        else:
            required.update(found)

    preferred.difference_update(required)
    return {
        "required_skills": sorted(required),
        "preferred_skills": sorted(preferred),
        "experience_years": _extract_years(normalized),
        "education": _extract_education(normalized),
        "soft_skills": _extract_terms(normalized, SOFT_SKILLS),
    }


def _normalize_text(value: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.replace("\x00", "").splitlines()]
    return "\n".join(line for line in lines if line).strip()


def _extract_terms(text: str, aliases: dict[str, tuple[str, ...]]) -> list[str]:
    lowered = text.casefold()
    found = {
        canonical
        for canonical, values in aliases.items()
        if any(re.search(rf"(?<!\w){re.escape(alias.casefold())}(?!\w)", lowered) for alias in values)
    }
    return sorted(found)


def _extract_years(text: str) -> float | None:
    values = [
        float(value)
        for value in re.findall(r"\b(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b", text, re.IGNORECASE)
        if float(value) <= 50
    ]
    return max(values) if values else None


def _extract_education(text: str) -> str | None:
    lowered = text.casefold()
    levels = (
        ("Doctorate", ("phd", "ph.d", "doctorate")),
        ("Master", ("master's", "masters degree", "master degree", "msc", "m.sc")),
        ("Bachelor", ("bachelor's", "bachelors degree", "bachelor degree", "bachelor of", "bsc", "b.sc")),
        ("Associate", ("associate degree",)),
        ("High School", ("high school",)),
    )
    return next((level for level, aliases in levels if any(alias in lowered for alias in aliases)), None)


def _extract_sections(text: str) -> dict[str, str]:
    headers = {
        "summary": "summary",
        "professional summary": "summary",
        "experience": "experience",
        "work experience": "experience",
        "employment history": "experience",
        "education": "education",
        "skills": "skills",
        "technical skills": "skills",
        "projects": "projects",
    }
    sections: dict[str, list[str]] = {}
    current = "other"
    for line in text.splitlines():
        candidate = line.rstrip(":").strip().casefold()
        if candidate in headers:
            current = headers[candidate]
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(line)
    return {name: "\n".join(lines).strip() for name, lines in sections.items() if lines}
