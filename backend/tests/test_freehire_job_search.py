import json

from app.services import freehire_job_search as fjs
from app.services import gemini_analyzer as ga


def test_normalize_level_and_seniority_filter():
    assert fjs.normalize_level(" Senior ") == "Senior"
    assert fjs.normalize_level("senior") is None
    assert fjs.normalize_level("") is None
    assert fjs.normalize_level(None) is None

    assert fjs.seniority_filter("Intern") == "intern"
    assert fjs.seniority_filter("Entry") == "junior"
    assert fjs.seniority_filter("Fresher") == "junior"
    assert fjs.seniority_filter("Junior") == "junior"
    assert fjs.seniority_filter("Mid-level") == "middle"
    assert fjs.seniority_filter("Senior") == "senior"
    assert fjs.seniority_filter("Lead") == "lead"
    assert fjs.seniority_filter("Manager") == "principal"
    assert fjs.seniority_filter("unknown") is None
    assert fjs.seniority_filter(None) is None


def test_derive_search_query():
    payload = {"skills": ["Python", "AWS", "Docker", "React", "SQL"]}
    assert fjs.derive_search_query(payload) == "Python AWS Docker React"

    assert fjs.derive_search_query({"skills": []}) == ""
    assert fjs.derive_search_query({"skills": "Python"}) == ""
    assert fjs.derive_search_query(None) == ""
    assert fjs.derive_search_query({}) == ""


def test_derive_level_from_experience():
    assert fjs._derive_level_from_experience({"experience_years": 0.5}) == "Entry"
    assert fjs._derive_level_from_experience({"experience_years": 1}) == "Junior"
    assert fjs._derive_level_from_experience({"experience_years": 3}) == "Mid-level"
    assert fjs._derive_level_from_experience({"experience_years": 6}) == "Senior"
    assert fjs._derive_level_from_experience({"experience_years": None}) is None
    assert fjs._derive_level_from_experience({}) is None
    assert fjs._derive_level_from_experience(None) is None


def test_derive_ai_search_query_uses_deterministic_when_provider_is_deterministic(monkeypatch):
    monkeypatch.setattr(fjs.settings, "analyzer_provider", "deterministic")

    derived = fjs.derive_ai_search_query(
        cv_text="Python developer with AWS experience.",
        parsed_payload={"skills": ["Python", "AWS"]},
    )

    assert derived["query"] == "Python AWS"
    assert derived["location_hint"] is None
    assert derived["used_ai"] is False
    assert derived["level"] is None


def test_derive_ai_search_query_prepends_fallback_level_in_deterministic_mode(monkeypatch):
    monkeypatch.setattr(fjs.settings, "analyzer_provider", "deterministic")

    derived = fjs.derive_ai_search_query(
        cv_text="...",
        parsed_payload={
            "skills": ["Python", "AWS"],
            "experience_years": 6,
        },
    )

    assert derived["query"] == "Python AWS"
    assert derived["level"] == "Senior"
    assert derived["used_ai"] is False


def test_derive_ai_search_query_uses_gemini_profile(monkeypatch):
    monkeypatch.setattr(fjs.settings, "analyzer_provider", "gemini")

    profile = {
        "job_title": "Backend Engineer",
        "keywords": ["Python", "FastAPI", "Docker"],
        "location_hint": "Ho Chi Minh City",
        "level": "Senior",
    }
    monkeypatch.setattr(
        fjs, "extract_cv_search_profile", lambda **kwargs: profile
    )

    derived = fjs.derive_ai_search_query(
        cv_text="...", parsed_payload={"skills": ["Python", "AWS"]}
    )

    assert derived["query"] == "Backend Engineer Python FastAPI Docker"
    assert derived["location_hint"] == "Ho Chi Minh City"
    assert derived["level"] == "Senior"
    assert derived["used_ai"] is True


def test_derive_ai_search_query_caps_query_at_five_words(monkeypatch):
    monkeypatch.setattr(fjs.settings, "analyzer_provider", "gemini")

    profile = {
        "job_title": "Software Engineer",
        "keywords": ["Python", "FastAPI", "Docker", "AWS", "SQL", "React"],
        "location_hint": None,
        "level": "Intern",
    }
    monkeypatch.setattr(
        fjs, "extract_cv_search_profile", lambda **kwargs: profile
    )

    derived = fjs.derive_ai_search_query(
        cv_text="...", parsed_payload={"skills": ["Python"]}
    )

    assert derived["query"] == "Software Engineer Python FastAPI Docker"
    assert len(derived["query"].split()) == 5
    assert derived["level"] == "Intern"
    assert derived["used_ai"] is True


def test_derive_ai_search_query_prefers_user_level(monkeypatch):
    monkeypatch.setattr(fjs.settings, "analyzer_provider", "gemini")

    profile = {
        "job_title": "Backend Engineer",
        "keywords": ["Python", "Docker"],
        "location_hint": "Hanoi",
        "level": "Senior",
    }
    monkeypatch.setattr(
        fjs, "extract_cv_search_profile", lambda **kwargs: profile
    )

    derived = fjs.derive_ai_search_query(
        cv_text="...",
        parsed_payload={"skills": ["Python"], "experience_years": 6},
        preferred_level="Junior",
    )

    assert derived["query"] == "Backend Engineer Python Docker"
    assert derived["level"] == "Junior"
    assert derived["used_ai"] is True


def test_derive_ai_search_query_falls_back_on_gemini_error(monkeypatch):
    monkeypatch.setattr(fjs.settings, "analyzer_provider", "gemini")

    def boom(**kwargs):
        raise fjs.GeminiAnalyzerError("Gemini is busy.")

    monkeypatch.setattr(fjs, "extract_cv_search_profile", boom)

    derived = fjs.derive_ai_search_query(
        cv_text="...",
        parsed_payload={"skills": ["React"], "experience_years": 1.5},
    )

    assert derived["query"] == "React"
    assert derived["location_hint"] is None
    assert derived["used_ai"] is False
    assert derived["level"] == "Junior"


def test_extract_cv_search_profile_normalizes_output(monkeypatch):
    monkeypatch.setattr(
        ga, "_send_request", lambda url, body: {"candidates": []}
    )
    monkeypatch.setattr(
        ga,
        "_output_text",
        lambda payload: json.dumps(
            {
                "job_title": " Backend Engineer ",
                "keywords": ["Python", "python", " FastAPI ", "", "Docker", "AWS", "SQL", "React"],
                "location_hint": "  Ho Chi Minh City ",
                "level": "Senior",
                "level_evidence": "Senior Backend Engineer at Example Co",
            }
        ),
    )
    monkeypatch.setattr(ga.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(ga.settings, "gemini_model", "gemini-test")

    profile = ga.extract_cv_search_profile(cv_text="Python developer CV")

    assert profile["job_title"] == "Backend Engineer"
    assert profile["keywords"] == ["Python", "FastAPI", "Docker", "AWS", "SQL"]
    assert profile["location_hint"] == "Ho Chi Minh City"
    assert profile["level"] is None


def test_extract_cv_search_profile_keeps_level_with_grounded_evidence(monkeypatch):
    monkeypatch.setattr(
        ga, "_send_request", lambda url, body: {"candidates": []}
    )
    monkeypatch.setattr(
        ga,
        "_output_text",
        lambda payload: json.dumps(
            {
                "job_title": "Backend Engineer",
                "keywords": ["Python"],
                "location_hint": None,
                "level": "Senior",
                "level_evidence": "Senior Backend Engineer at Example Co",
            }
        ),
    )
    monkeypatch.setattr(ga.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(ga.settings, "gemini_model", "gemini-test")

    profile = ga.extract_cv_search_profile(
        cv_text="Senior Backend Engineer at Example Co with Python."
    )

    assert profile["level"] == "Senior"


def test_extract_cv_search_profile_raises_on_unreadable_output(monkeypatch):
    monkeypatch.setattr(
        ga, "_send_request", lambda url, body: {"candidates": []}
    )
    monkeypatch.setattr(ga, "_output_text", lambda payload: "not-json")
    monkeypatch.setattr(ga.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(ga.settings, "gemini_model", "gemini-test")

    try:
        ga.extract_cv_search_profile(cv_text="Python developer CV")
        raise AssertionError("expected GeminiAnalyzerError")
    except ga.GeminiAnalyzerError as exc:
        assert "invalid search profile" in str(exc)


def test_location_to_facets():
    assert fjs.location_to_facets("Remote") == {"work_mode": "remote"}
    assert fjs.location_to_facets("Anywhere") == {"work_mode": "remote"}
    assert fjs.location_to_facets("Vietnam") == {"countries": ["VN"]}
    assert fjs.location_to_facets("Viet Nam") == {"countries": ["VN"]}
    assert fjs.location_to_facets("vn") == {"countries": ["VN"]}
    assert fjs.location_to_facets("Europe") == {"regions": ["eu"]}
    # Vietnamese cities are locked to VN so location fallbacks stay in Vietnam
    assert fjs.location_to_facets("Ho Chi Minh City") == {
        "cities": ["Ho Chi Minh City"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("HCMC") == {
        "cities": ["Ho Chi Minh City"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("Saigon") == {
        "cities": ["Ho Chi Minh City"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("Hanoi") == {
        "cities": ["Hanoi"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("Ha Noi") == {
        "cities": ["Hanoi"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("Da Nang") == {
        "cities": ["Da Nang"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("Hai Phong") == {"countries": ["VN"]}
    assert fjs.location_to_facets("Can Tho") == {"countries": ["VN"]}
    assert fjs.location_to_facets("Ho Chi Minh City, Vietnam") == {
        "cities": ["Ho Chi Minh City"], "countries": ["VN"]
    }
    assert fjs.location_to_facets("Berlin, Germany") == {"countries": ["DE"]}
    assert fjs.location_to_facets("") == {}
    assert fjs.location_to_facets(None) == {}


def test_search_jobs_builds_params_and_normalizes_hits(monkeypatch):
    captured: list[dict] = []

    def fake_get(url, params, timeout):
        captured.append(params)
        return type(
            "Resp",
            (),
            {
                "status_code": 200,
                "reason": "OK",
                "json": lambda self: {
                    "meta": {"total": 1},
                    "data": [
                        {
                            "public_slug": "backend-engineer-acme-abc123",
                            "title": "Backend Engineer (Python)",
                            "company": "Acme Corp",
                            "location": "Ho Chi Minh City, Vietnam",
                            "posted_at": "2026-07-20T10:00:00Z",
                            "url": "https://job-boards.greenhouse.io/acme/123",
                            "enrichment": {
                                "seniority": "senior",
                                "category": "backend",
                            },
                        }
                    ],
                },
            },
        )()

    monkeypatch.setattr(fjs.requests, "get", fake_get)

    results = fjs.search_jobs(
        query="Senior Backend Engineer Python",
        location="Vietnam",
        remote="remote",
        jobage=7,
        limit=5,
        level="Senior",
    )

    assert len(results) == 1
    assert results[0]["id"] == "backend-engineer-acme-abc123"
    assert results[0]["title"] == "Backend Engineer (Python)"
    assert results[0]["company"] == "Acme Corp"
    assert results[0]["location"] == "Ho Chi Minh City, Vietnam"
    assert results[0]["date"] == "2026-07-20"
    assert results[0]["url"] == "https://job-boards.greenhouse.io/acme/123"
    assert results[0]["matched_keywords"] == ["backend", "engineer", "python"]
    assert results[0]["seniority"] == "senior"
    assert results[0]["category"] == "backend"

    params = captured[0]
    assert params["q"] == "Senior Backend Engineer Python"
    assert params["posted_within_days"] == "7"
    assert params["work_mode"] == "remote"
    assert params["seniority"] == "senior"
    assert params["countries"] == ["VN"]
    assert params["limit"] == "5"
    assert params["include_description"] == "false"


def test_search_jobs_falls_back_without_city_then_seniority_keeping_country(monkeypatch):
    calls: list[dict] = []

    def fake_get(url, params, timeout):
        calls.append(params)
        empty = {"meta": {"total": 0}, "data": []}
        return type(
            "Resp",
            (),
            {
                "status_code": 200,
                "reason": "OK",
                "json": lambda self: empty,
            },
        )()

    monkeypatch.setattr(fjs.requests, "get", fake_get)

    results = fjs.search_jobs(
        query="python", location="HCMC", level="Intern"
    )

    assert results == []
    # 3 attempts: strict, drop cities, drop cities + seniority
    assert len(calls) == 3
    # Attempt 1: cities + countries + seniority
    assert calls[0]["cities"] == ["Ho Chi Minh City"]
    assert calls[0]["countries"] == ["VN"]
    assert calls[0]["seniority"] == "intern"
    # Attempt 2: drops cities, keeps countries + seniority
    assert "cities" not in calls[1]
    assert calls[1]["countries"] == ["VN"]
    assert calls[1]["seniority"] == "intern"
    # Attempt 3: drops cities + seniority, keeps countries (location lockdown)
    assert "cities" not in calls[2]
    assert "seniority" not in calls[2]
    assert calls[2]["countries"] == ["VN"]


def test_search_jobs_sorts_by_keyword_match_and_limits(monkeypatch):
    def fake_get(url, params, timeout):
        titles = ["React Developer", "Python Engineer", "Python React Developer"]
        data = [
            {
                "public_slug": f"job-{i}",
                "title": title,
                "company": None,
                "location": None,
                "posted_at": None,
                "url": None,
                "enrichment": None,
            }
            for i, title in enumerate(titles)
        ]
        return type(
            "Resp",
            (),
            {
                "status_code": 200,
                "reason": "OK",
                "json": lambda self: {"meta": {"total": 3}, "data": data},
            },
        )()

    monkeypatch.setattr(fjs.requests, "get", fake_get)

    results = fjs.search_jobs(query="python react", location="Remote", limit=2)

    assert len(results) == 2
    assert results[0]["title"] == "Python React Developer"
    assert results[0]["matched_keywords"] == ["python", "react"]
    assert results[1]["matched_keywords"] == ["react"]
    assert results[0]["url"] == "https://freehire.me/jobs/job-2"


def test_search_jobs_raises_on_http_error(monkeypatch):
    def fake_get(url, params, timeout):
        return type(
            "Resp",
            (),
            {
                "status_code": 500,
                "reason": "Server Error",
                "json": lambda self: {},
            },
        )()

    monkeypatch.setattr(fjs.requests, "get", fake_get)

    try:
        fjs.search_jobs(query="python", location="Remote")
        raise AssertionError("expected FreehireSearchError")
    except fjs.FreehireSearchError as exc:
        assert "500" in str(exc)
