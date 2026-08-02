from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.language import cv_is_mixed, detect_cv_language, detect_language


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


def test_common_vietnamese_sentence_is_detected() -> None:
    text = "Tôi là sinh viên tại thành phố Hồ Chí Minh, chuyên ngành công nghệ thông tin."
    assert detect_language(text) == "vi"


def test_vietnamese_words_with_e_m_forms_are_detected() -> None:
    text = "Kinh nghiệm triển khai hệ thống, thêm tính năng mới và nghiệp vụ thanh toán."
    assert detect_language(text) == "vi"


def test_english_with_scattered_vietnamese_place_names_is_english() -> None:
    text = "Worked remotely from Da Nang and Ho Chi Minh City on payment systems."
    assert detect_language(text) == "en"


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


def _mixed_cv() -> CVData:
    return CVData(
        name="Nguyen Van A",
        summary="Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API.",
        experience=[
            {
                "title": "Backend Engineer",
                "company": "Acme",
                "date": "2021-2023",
                "bullets": [
                    "Built a payment system serving 2M transactions a day.",
                    "Tối ưu hiệu năng hệ thống và giảm độ trễ 40%.",
                ],
            }
        ],
    )


class TestCvIsMixed:
    def test_mixed_vietnamese_and_english_prose_is_mixed(self) -> None:
        assert cv_is_mixed(_mixed_cv()) is True

    def test_all_english_cv_is_not_mixed(self) -> None:
        cv = CVData(
            name="Nguyen Van A",
            summary="Senior backend engineer building payment APIs with Python.",
            experience=[
                {
                    "title": "Senior Engineer",
                    "company": "Acme",
                    "bullets": ["Built a payment system serving 2M transactions a day."],
                }
            ],
        )
        assert cv_is_mixed(cv) is False

    def test_all_vietnamese_cv_with_english_skills_is_not_mixed(self) -> None:
        cv = CVData(
            name="Nguyen Van A",
            summary="Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API.",
            skills=["Python", "Docker", "React"],
            experience=[
                {
                    "title": "Kỹ sư phần mềm",
                    "company": "Acme",
                    "bullets": ["Xây dựng hệ thống thanh toán phục vụ 2 triệu giao dịch."],
                }
            ],
        )
        assert cv_is_mixed(cv) is False

    def test_vietnamese_summary_with_english_bullets_is_mixed(self) -> None:
        cv = CVData(
            name="Nguyen Van A",
            summary="Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API.",
            experience=[
                {
                    "title": "Kỹ sư phần mềm",
                    "company": "Acme",
                    "bullets": ["Built payment APIs with Python and FastAPI."],
                }
            ],
        )
        assert cv_is_mixed(cv) is True

    def test_empty_cv_is_not_mixed(self) -> None:
        assert cv_is_mixed(CVData()) is False
