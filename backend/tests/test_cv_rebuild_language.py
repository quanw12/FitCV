from app.services.cv_rebuild.language import detect_language


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
