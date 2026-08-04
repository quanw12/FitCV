from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(r"C:\Studybase\FitCV\output\sad_db_work")
OUT.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT = 3600, 2100
MARGIN = 80
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
MONO = Path(r"C:\Windows\Fonts\consola.ttf")

COLORS = {
    "identity": ("#E8F1FF", "#2563EB"),
    "recruitment": ("#FFF4E5", "#D97706"),
    "analysis": ("#ECFDF3", "#16A34A"),
    "tracking": ("#F5F3FF", "#7C3AED"),
    "support": ("#F1F5F9", "#475569"),
}


def font(path, size):
    return ImageFont.truetype(str(path), size)


TITLE_FONT = font(BOLD, 70)
ENTITY_FONT = font(BOLD, 48)
ATTR_FONT = font(MONO, 40)
LABEL_FONT = font(FONT, 30)
LEGEND_FONT = font(FONT, 31)


def px_box(x, y, w, h):
    left = int(MARGIN + x * (WIDTH - 2 * MARGIN))
    top = int(MARGIN + y * (HEIGHT - 2 * MARGIN))
    right = int(left + w * (WIDTH - 2 * MARGIN))
    bottom = int(top + h * (HEIGHT - 2 * MARGIN))
    return (left, top, right, bottom)


def add_entity(draw, x, y, w, h, name, attrs, domain):
    fill, edge = COLORS[domain]
    box = px_box(x, y, w, h)
    draw.rounded_rectangle(box, radius=18, fill=fill, outline=edge, width=5)
    header_h = min(70, int((box[3] - box[1]) * 0.24))
    draw.line((box[0], box[1] + header_h, box[2], box[1] + header_h), fill=edge, width=4)
    name_box = draw.textbbox((0, 0), name, font=ENTITY_FONT)
    draw.text(
        ((box[0] + box[2] - (name_box[2] - name_box[0])) / 2, box[1] + 14),
        name,
        fill="#0F172A",
        font=ENTITY_FONT,
    )
    draw.multiline_text(
        (box[0] + 16, box[1] + header_h + 12),
        "\n".join(attrs),
        fill="#0F172A",
        font=ATTR_FONT,
        spacing=7,
    )
    return {"left": box[0], "top": box[1], "right": box[2], "bottom": box[3]}


def center(box):
    return ((box["left"] + box["right"]) / 2, (box["top"] + box["bottom"]) / 2)


def edge_point(box, toward):
    cx, cy = center(box)
    tx, ty = toward
    dx, dy = tx - cx, ty - cy
    half_w = (box["right"] - box["left"]) / 2
    half_h = (box["bottom"] - box["top"]) / 2
    if abs(dx / max(half_w, 1)) > abs(dy / max(half_h, 1)):
        x = box["right"] if dx > 0 else box["left"]
        y = cy + dy * half_w / max(abs(dx), 1)
    else:
        y = box["bottom"] if dy > 0 else box["top"]
        x = cx + dx * half_h / max(abs(dy), 1)
    return (int(x), int(y))


def text_label(draw, xy, text, anchor="mm"):
    bbox = draw.textbbox((0, 0), text, font=LABEL_FONT)
    w = bbox[2] - bbox[0] + 16
    h = bbox[3] - bbox[1] + 10
    x, y = xy
    draw.rounded_rectangle((x - w / 2, y - h / 2, x + w / 2, y + h / 2), radius=5, fill="white", outline="#CBD5E1", width=1)
    draw.text((x, y), text, font=LABEL_FONT, fill="#334155", anchor=anchor)


def connect(draw, parent, child, parent_card="1", child_card="0..N", label="", dashed=False):
    pc, cc = center(parent), center(child)
    start, end = edge_point(parent, cc), edge_point(child, pc)
    if dashed:
        segments = 22
        for index in range(0, segments, 2):
            x1 = int(start[0] + (end[0] - start[0]) * index / segments)
            y1 = int(start[1] + (end[1] - start[1]) * index / segments)
            x2 = int(start[0] + (end[0] - start[0]) * min(index + 1, segments) / segments)
            y2 = int(start[1] + (end[1] - start[1]) * min(index + 1, segments) / segments)
            draw.line((x1, y1, x2, y2), fill="#64748B", width=4)
    else:
        draw.line((*start, *end), fill="#64748B", width=4)
    text_label(
        draw,
        (
            int(start[0] + (end[0] - start[0]) * 0.10),
            int(start[1] + (end[1] - start[1]) * 0.10),
        ),
        parent_card,
    )
    text_label(
        draw,
        (
            int(start[0] + (end[0] - start[0]) * 0.90),
            int(start[1] + (end[1] - start[1]) * 0.90),
        ),
        child_card,
    )
    if label:
        text_label(
            draw,
            ((start[0] + end[0]) // 2, (start[1] + end[1]) // 2),
            label,
        )


def new_canvas(title):
    image = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(image)
    title_box = draw.textbbox((0, 0), title, font=TITLE_FONT)
    draw.text(((WIDTH - (title_box[2] - title_box[0])) / 2, 24), title, fill="#0F172A", font=TITLE_FONT)
    return image, draw


def save(image, name):
    legend = "Notation: PK = primary key, FK = foreign key, UK = unique key. Cardinalities reflect the physical FitCV schema."
    draw = ImageDraw.Draw(image)
    legend_box = draw.textbbox((0, 0), legend, font=LEGEND_FONT)
    draw.text(((WIDTH - (legend_box[2] - legend_box[0])) / 2, HEIGHT - 45), legend, fill="#475569", font=LEGEND_FONT)
    path = OUT / name
    image.save(path, dpi=(300, 300), optimize=True)
    return path


def build_core():
    image, draw = new_canvas("FitCV ER Model A - Identity, Recruitment, CV, and Hiring Pipeline")
    boxes = {}
    boxes["industry"] = add_entity(draw, 0.00, 0.07, 0.18, 0.16, "industry", ["PK industry_id", "UK industry_name"], "identity")
    boxes["position"] = add_entity(draw, 0.00, 0.36, 0.18, 0.18, "position", ["PK position_id", "UK abbreviation", "full_name"], "recruitment")
    boxes["level"] = add_entity(draw, 0.00, 0.67, 0.18, 0.16, "level", ["PK level_id", "UK level_name"], "recruitment")
    boxes["company"] = add_entity(draw, 0.27, 0.06, 0.20, 0.21, "company", ["PK company_id", "FK industry_id", "company_name", "website_url", "logo_url"], "identity")
    boxes["job"] = add_entity(draw, 0.27, 0.36, 0.20, 0.35, "job", ["PK job_id", "FK company_id", "FK created_by_account_id", "FK position_id", "FK level_id", "title", "requirements", "status", "deadline"], "recruitment")
    boxes["account"] = add_entity(draw, 0.53, 0.05, 0.20, 0.27, "account", ["PK account_id", "FK company_id", "UK email", "password_hash", "full_name", "role", "auth_provider", "reset_token_*"], "identity")
    boxes["job_hr"] = add_entity(draw, 0.53, 0.39, 0.20, 0.18, "job_hr", ["PK/FK job_id", "PK/FK hr_account_id", "role_type"], "recruitment")
    boxes["candidate"] = add_entity(draw, 0.79, 0.05, 0.19, 0.24, "candidate", ["PK candidate_id", "FK account_id", "FK created_by_hr_account_id", "full_name", "email", "phone"], "identity")
    boxes["cv"] = add_entity(draw, 0.79, 0.36, 0.19, 0.23, "cv", ["PK cv_id", "FK account_id", "FK candidate_id", "file_name", "file_type", "file_sha256", "version_number", "is_latest"], "analysis")
    boxes["application"] = add_entity(draw, 0.57, 0.69, 0.25, 0.23, "application", ["PK application_id", "FK candidate_id", "FK job_id", "FK cv_id", "current_stage", "status", "applied_at"], "recruitment")

    connect(draw, boxes["industry"], boxes["company"], label="industry_id")
    connect(draw, boxes["company"], boxes["account"], label="company_id")
    connect(draw, boxes["company"], boxes["job"], label="company_id")
    connect(draw, boxes["position"], boxes["job"], label="position_id")
    connect(draw, boxes["level"], boxes["job"], label="level_id")
    connect(draw, boxes["account"], boxes["job"], label="created_by")
    connect(draw, boxes["job"], boxes["job_hr"], label="job_id")
    connect(draw, boxes["account"], boxes["job_hr"], label="hr_account_id")
    connect(draw, boxes["account"], boxes["candidate"], label="account_id")
    connect(draw, boxes["account"], boxes["candidate"], label="created_by_hr")
    connect(draw, boxes["account"], boxes["cv"], label="account_id")
    connect(draw, boxes["candidate"], boxes["cv"], label="candidate_id")
    connect(draw, boxes["candidate"], boxes["application"], label="candidate_id")
    connect(draw, boxes["job"], boxes["application"], label="job_id")
    connect(draw, boxes["cv"], boxes["application"], label="cv_id")
    return save(image, "fitcv_erd_core.png")


def build_analysis():
    image, draw = new_canvas("FitCV ER Model B - CV/JD Analysis, AI Results, and Student Application Tracking")
    boxes = {}
    boxes["account"] = add_entity(draw, 0.00, 0.05, 0.18, 0.18, "account", ["PK account_id", "UK email", "role", "company_id"], "identity")
    boxes["candidate"] = add_entity(draw, 0.00, 0.31, 0.18, 0.17, "candidate", ["PK candidate_id", "FK account_id", "created_by_hr_account_id"], "identity")
    boxes["tracked_application"] = add_entity(draw, 0.00, 0.59, 0.21, 0.27, "tracked_application", ["PK tracked_application_id", "FK account_id", "company_name", "position_title", "applied_on", "status", "reminder_at"], "tracking")
    boxes["tracked_note"] = add_entity(draw, 0.27, 0.60, 0.20, 0.17, "tracked_application_note", ["PK note_id", "FK tracked_application_id", "content", "created_at"], "tracking")
    boxes["tracked_history"] = add_entity(draw, 0.27, 0.79, 0.20, 0.16, "tracked_application_status_history", ["PK status_history_id", "FK tracked_application_id", "previous_status", "new_status", "changed_at"], "tracking")
    boxes["cv"] = add_entity(draw, 0.27, 0.04, 0.18, 0.20, "cv", ["PK cv_id", "FK account_id", "FK candidate_id", "file_path", "version_number"], "analysis")
    boxes["cv_parse"] = add_entity(draw, 0.27, 0.31, 0.18, 0.17, "cv_parse_result", ["PK cv_parse_id", "FK cv_id", "parsed_json", "parse_status", "parser_version"], "analysis")
    boxes["job"] = add_entity(draw, 0.79, 0.04, 0.19, 0.17, "job", ["PK job_id", "FK company_id", "title", "requirements", "status"], "recruitment")
    boxes["job_description"] = add_entity(draw, 0.53, 0.04, 0.20, 0.21, "job_description", ["PK job_description_id", "FK account_id", "FK job_id", "source_type", "raw_text", "content_sha256"], "analysis")
    boxes["jd_parse"] = add_entity(draw, 0.53, 0.31, 0.20, 0.17, "jd_parse_result", ["PK jd_parse_id", "FK job_description_id", "parsed_json", "parse_status"], "analysis")
    boxes["application"] = add_entity(draw, 0.79, 0.31, 0.19, 0.17, "application", ["PK application_id", "FK candidate_id", "FK job_id", "FK cv_id", "current_stage"], "recruitment")
    boxes["match_result"] = add_entity(draw, 0.50, 0.57, 0.26, 0.27, "match_result", ["PK match_result_id", "FK cv_id / job_id / job_description_id", "FK cv_parse_id / jd_parse_id / application_id", "status", "overall + category scores", "evidence_json", "algorithm_version"], "analysis")
    boxes["suggestion"] = add_entity(draw, 0.78, 0.61, 0.20, 0.22, "cv_improvement_suggestion", ["PK suggestion_id", "FK match_result_id", "suggestion_type", "category", "suggested_text", "priority"], "analysis")
    boxes["ai_task"] = add_entity(draw, 0.53, 0.86, 0.20, 0.12, "ai_task", ["PK ai_task_id", "task_type + resource_id", "status", "provider + model_name"], "support")

    connect(draw, boxes["account"], boxes["candidate"], label="account_id")
    connect(draw, boxes["account"], boxes["cv"], label="account_id")
    connect(draw, boxes["candidate"], boxes["cv"], label="candidate_id")
    connect(draw, boxes["cv"], boxes["cv_parse"], label="cv_id")
    connect(draw, boxes["account"], boxes["job_description"], label="account_id")
    connect(draw, boxes["job"], boxes["job_description"], label="job_id")
    connect(draw, boxes["job_description"], boxes["jd_parse"], label="job_description_id")
    connect(draw, boxes["job"], boxes["application"], label="job_id")
    connect(draw, boxes["application"], boxes["match_result"], label="application_id")
    connect(draw, boxes["cv"], boxes["match_result"], label="cv_id")
    connect(draw, boxes["cv_parse"], boxes["match_result"], label="cv_parse_id")
    connect(draw, boxes["job"], boxes["match_result"], label="job_id")
    connect(draw, boxes["job_description"], boxes["match_result"], label="job_description_id")
    connect(draw, boxes["jd_parse"], boxes["match_result"], label="jd_parse_id")
    connect(draw, boxes["match_result"], boxes["suggestion"], label="match_result_id")
    connect(draw, boxes["account"], boxes["tracked_application"], label="account_id")
    connect(draw, boxes["tracked_application"], boxes["tracked_note"], label="tracked_application_id")
    connect(draw, boxes["tracked_application"], boxes["tracked_history"], label="tracked_application_id")
    connect(draw, boxes["ai_task"], boxes["match_result"], parent_card="0..N", child_card="0..1", label="logical reference", dashed=True)
    return save(image, "fitcv_erd_analysis.png")


if __name__ == "__main__":
    print(build_core())
    print(build_analysis())
