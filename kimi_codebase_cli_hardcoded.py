#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Iterable

from openai import OpenAI


BASE_URL = "https://api.tokenrouter.com/v1"
DEFAULT_MODEL = "moonshotai/kimi-k3-free"

TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".kts",
    ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".rb",
    ".swift", ".scala", ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd",
    ".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml",
    ".sql", ".graphql", ".gql", ".md", ".txt", ".rst", ".env.example",
}

SPECIAL_FILENAMES = {
    "Dockerfile", "Makefile", "Procfile", "Gemfile", "Rakefile",
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "requirements.txt", "pyproject.toml", "poetry.lock", "Pipfile",
    "go.mod", "go.sum", "Cargo.toml", "Cargo.lock",
    "pom.xml", "build.gradle", "settings.gradle",
    "README", "README.md", ".gitignore", ".dockerignore",
}

IGNORED_DIRS = {
    ".git", ".idea", ".vscode", ".venv", "venv", "env",
    "__pycache__", "node_modules", "dist", "build", "target",
    ".next", ".nuxt", ".cache", "coverage", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", "vendor",
}

MAX_FILE_BYTES = 250_000
MAX_FILES_PER_QUESTION = 14
MAX_CONTEXT_CHARS = 110_000


def configure_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        fn = getattr(stream, "reconfigure", None)
        if callable(fn):
            fn(encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Chat with Kimi about a local codebase."
    )
    parser.add_argument(
        "project",
        nargs="?",
        default=".",
        help="Project directory (default: current directory).",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("KIMI_MODEL", DEFAULT_MODEL),
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("TOKENROUTER_BASE_URL", BASE_URL),
    )
    return parser.parse_args()


def get_api_key() -> str:
    return "sk-0Q0puGhvNZSKbU8SlBAcCVZ844ZddSD8kTuWFPG7633Mip6o"


def is_probably_text_file(path: Path) -> bool:
    if path.name in SPECIAL_FILENAMES:
        return True
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    return False


def iter_code_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue

        try:
            relative_parts = path.relative_to(root).parts
        except ValueError:
            continue

        if any(part in IGNORED_DIRS for part in relative_parts):
            continue

        if not is_probably_text_file(path):
            continue

        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue

        yield path


def safe_read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
    except OSError:
        return ""


def tokenize(text: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[A-Za-z_][A-Za-z0-9_.\-/]{1,}", text)
        if len(token) >= 3
    }


def score_file(question: str, relative_path: str, content: str) -> int:
    question_tokens = tokenize(question)
    path_lower = relative_path.lower()
    content_lower = content[:40_000].lower()

    score = 0

    for token in question_tokens:
        if token in path_lower:
            score += 15
        count = content_lower.count(token)
        score += min(count, 8)

    name = Path(relative_path).name.lower()

    if name.startswith("readme"):
        score += 4
    if name in {
        "package.json", "pyproject.toml", "requirements.txt",
        "go.mod", "cargo.toml", "pom.xml", "dockerfile",
    }:
        score += 4

    explicit_paths = re.findall(
        r"[\w./\\-]+\.(?:py|js|jsx|ts|tsx|java|go|rs|cpp|c|h|cs|php|rb|md|json|ya?ml|toml)",
        question,
        flags=re.IGNORECASE,
    )
    for explicit in explicit_paths:
        explicit = explicit.replace("\\", "/").lower()
        if explicit in relative_path.replace("\\", "/").lower():
            score += 100

    return score


def select_relevant_files(
    root: Path,
    indexed_files: list[Path],
    question: str,
) -> list[tuple[str, str]]:
    candidates: list[tuple[int, str, str]] = []

    for path in indexed_files:
        relative = path.relative_to(root).as_posix()
        content = safe_read(path)
        if not content:
            continue

        score = score_file(question, relative, content)
        candidates.append((score, relative, content))

    candidates.sort(key=lambda item: (item[0], -len(item[2])), reverse=True)

    selected: list[tuple[str, str]] = []
    total_chars = 0

    for score, relative, content in candidates:
        if len(selected) >= MAX_FILES_PER_QUESTION:
            break

        if score <= 0 and selected:
            continue

        remaining = MAX_CONTEXT_CHARS - total_chars
        if remaining <= 0:
            break

        clipped = content[:remaining]
        selected.append((relative, clipped))
        total_chars += len(clipped)

    return selected


def build_codebase_context(files: list[tuple[str, str]]) -> str:
    blocks = []

    for relative, content in files:
        blocks.append(
            f"\n===== FILE: {relative} =====\n"
            f"{content}\n"
            f"===== END FILE: {relative} =====\n"
        )

    return "".join(blocks)


def stream_reply(
    client: OpenAI,
    model: str,
    messages: list[dict[str, str]],
) -> str:
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
        stream_options={"include_usage": True},
        extra_body={},
    )

    parts: list[str] = []
    print("\nKimi: ", end="", flush=True)

    for chunk in stream:
        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta
        text = getattr(delta, "content", None)

        if text:
            print(text, end="", flush=True)
            parts.append(text)

    print("\n")
    return "".join(parts)


def main() -> int:
    configure_console()
    args = parse_args()

    root = Path(args.project).expanduser().resolve()

    if not root.is_dir():
        print(f"Không tìm thấy thư mục: {root}", file=sys.stderr)
        return 1

    try:
        api_key = get_api_key()
    except RuntimeError as exc:
        print(exc, file=sys.stderr)
        return 1

    client = OpenAI(
        base_url=args.base_url,
        api_key=api_key,
    )

    print(f"Đang quét codebase: {root}")
    indexed_files = list(iter_code_files(root))
    print(f"Đã tìm thấy {len(indexed_files)} file có thể đọc.")
    print("Lệnh: /files, /rescan, /clear, /exit\n")

    history: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "You are a senior software engineer analyzing a local codebase. "
                "Use only the supplied files as codebase evidence. "
                "Mention exact file paths when discussing code. "
                "If required code is missing, say which file or symbol is needed. "
                "Do not pretend to have edited or executed code."
            ),
        }
    ]

    while True:
        try:
            question = input("Bạn: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0

        if not question:
            continue

        command = question.lower()

        if command in {"/exit", "/quit"}:
            return 0

        if command == "/files":
            for path in indexed_files:
                print(path.relative_to(root).as_posix())
            print()
            continue

        if command == "/rescan":
            indexed_files = list(iter_code_files(root))
            print(f"Đã quét lại: {len(indexed_files)} file.\n")
            continue

        if command == "/clear":
            history = history[:1]
            print("Đã xóa lịch sử chat.\n")
            continue

        selected = select_relevant_files(root, indexed_files, question)

        if not selected:
            print("Không tìm thấy file phù hợp để gửi cho model.\n")
            continue

        print(
            "Đang gửi các file: "
            + ", ".join(relative for relative, _ in selected)
        )

        codebase_context = build_codebase_context(selected)

        user_message = (
            f"Question:\n{question}\n\n"
            f"Relevant codebase files:\n{codebase_context}"
        )

        history.append({
            "role": "user",
            "content": user_message,
        })

        try:
            reply = stream_reply(client, args.model, history)
        except Exception as exc:
            print(f"Lỗi gọi API: {exc}\n", file=sys.stderr)
            history.pop()
            continue

        history.append({
            "role": "assistant",
            "content": reply,
        })


if __name__ == "__main__":
    raise SystemExit(main())
