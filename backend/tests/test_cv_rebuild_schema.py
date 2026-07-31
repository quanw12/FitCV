import pytest
from pydantic import ValidationError

from app.schemas.cv_rebuild import CVData, CvRebuildResponse


class TestCVData:
    def test_empty_document_defaults_are_empty(self) -> None:
        cv = CVData.model_validate({})
        assert cv.name == ""
        assert cv.email == ""
        assert cv.phone == ""
        assert cv.links == []
        assert cv.summary == ""
        assert cv.experience == []
        assert cv.skills == []
        assert cv.projects == []
        assert cv.certifications == []
        assert cv.education == []
        assert cv.languages == []
        assert cv.publications == []
        assert cv.awards == []

    def test_rejects_skills_as_string(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate({"skills": "Python"})

    def test_rejects_experience_bullets_as_string(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate(
                {"experience": [{"title": "Engineer", "bullets": "led team"}]}
            )

    def test_rejects_unknown_experience_item_type(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate({"experience": [{"title": 42}]})

    def test_accepts_full_document(self) -> None:
        cv = CVData.model_validate(
            {
                "name": "Nguyen Van A",
                "email": "a@example.com",
                "phone": "+84 912 345 678",
                "links": [{"label": "LinkedIn", "url": "https://linkedin.com/in/a"}],
                "summary": "Backend engineer.",
                "experience": [
                    {
                        "title": "Engineer",
                        "company": "Acme",
                        "location": "HCMC",
                        "date": "2020-2023",
                        "bullets": ["Built APIs."],
                    }
                ],
                "skills": ["Python"],
                "projects": [{"name": "FitCV", "description": "CV tool."}],
                "certifications": ["AWS"],
                "education": [{"degree": "BSc", "institution": "HCMUS", "date": "2016-2020"}],
                "languages": [{"name": "English", "proficiency": "Fluent"}],
                "publications": [{"title": "Paper", "venue": "Journal", "date": "2022"}],
                "awards": ["Dean's List"],
            }
        )
        assert cv.experience[0].bullets == ["Built APIs."]
        assert cv.experience[0].location == "HCMC"
        assert cv.links[0].url == "https://linkedin.com/in/a"
        assert cv.languages[0].proficiency == "Fluent"
        assert cv.publications[0].venue == "Journal"
        assert cv.awards == ["Dean's List"]

    def test_rejects_links_as_string(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate({"links": "https://linkedin.com/in/a"})

    def test_rejects_languages_as_string(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate({"languages": "English"})

    def test_response_model_shape(self) -> None:
        response = CvRebuildResponse(
            filename="rebuilt_cv.pdf",
            preview_json=CVData(name="A"),
            pdf_base64="AAA",
            thumbnail_base64="BBB",
        )
        assert response.filename == "rebuilt_cv.pdf"
        assert response.preview_json.name == "A"


class TestCvRebuildResponse:
    def test_defaults(self) -> None:
        response = CvRebuildResponse(preview_json=CVData(), pdf_base64="", thumbnail_base64="")
        assert response.filename == "rebuilt_cv.pdf"
