from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.language import detect_cv_language, detect_language


def test_empty_text_is_english() -> None:
    assert detect_language("") == "en"


def test_plain_english_is_english() -> None:
    text = "Senior software engineer with 5 years of experience building APIs."
    assert detect_language(text) == "en"


def test_vietnamese_text_is_detected() -> None:
    text = (
        "Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API. "
        "Thành thạo Python, React và các hệ thống phân tán."
    )
    assert detect_language(text) == "vi"


def test_french_text_is_not_mistaken_for_vietnamese() -> None:
    text = "Ingénieur logiciel avec cinq années d'expérience en développement."
    assert detect_language(text) == "en"


def test_spanish_text_is_not_mistaken_for_vietnamese() -> None:
    text = "Ingeniero de software con cinco años de experiencia en APIs."
    assert detect_language(text) == "en"


def test_short_vietnamese_text_is_detected() -> None:
    assert detect_language("Lập trình viên tại Đà Nẵng") == "vi"


def test_english_cv_with_vietnamese_name_is_english() -> None:
    cv = CVData(
        name="Nguyễn Văn A",
        summary="Senior backend engineer building payment APIs with Python.",
        skills=["Python", "Docker"],
        experience=[
            {
                "title": "Senior Engineer",
                "company": "Acme",
                "date": "2020-2023",
                "bullets": ["Built a payment system serving 2M transactions a day."],
            }
        ],
    )
    assert detect_cv_language(cv) == "en"


def test_vietnamese_cv_is_vietnamese() -> None:
    cv = CVData(
        name="Nguyen Van A",
        summary="Kỹ sư phần mềm phát triển ứng dụng web.",
        skills=["Python", "React"],
        experience=[
            {
                "title": "Kỹ sư phần mềm",
                "company": "Tech Corp",
                "date": "2021-2023",
                "bullets": ["Xây dựng hệ thống thanh toán phục vụ 2 triệu giao dịch."],
            }
        ],
    )
    assert detect_cv_language(cv) == "vi"


def test_empty_cv_defaults_to_english() -> None:
    assert detect_cv_language(CVData()) == "en"
