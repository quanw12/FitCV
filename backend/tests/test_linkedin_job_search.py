from app.services import linkedin_job_search as ljs

SAMPLE_CARD = """
<li>
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/4426311357?refId=abc"></a>
  <h3 class="base-search-card__title">Data Engineer</h3>
  <h4 class="base-search-card__subtitle"><a href="/company/acme">Acme Corp</a></h4>
  <span class="job-search-card__location">Remote</span>
  <time class="job-search-card__listdate--new" datetime="2026-07-25">2 days ago</time>
</li>
"""


def test_parse_job_cards():
    html = 'data-entity-urn="urn:li:jobPosting:4426311357"' + SAMPLE_CARD
    cards = ljs.parse_job_cards(html)

    assert len(cards) == 1
    card = cards[0]
    assert card["id"] == "4426311357"
    assert card["title"] == "Data Engineer"
    assert card["company"] == "Acme Corp"
    assert card["location"] == "Remote"
    assert card["date"] == "2026-07-25"
    assert card["url"] == "https://www.linkedin.com/jobs/view/4426311357"


def test_parse_job_cards_skips_malformed_chunks():
    html = (
        'data-entity-urn="urn:li:jobPosting:1111111111"<li>no title here</li>'
        + 'data-entity-urn="urn:li:jobPosting:2222222222"'
        + SAMPLE_CARD
    )
    cards = ljs.parse_job_cards(html)

    assert len(cards) == 1
    assert cards[0]["id"] == "2222222222"


def test_parse_job_cards_decodes_entities_and_strips_tags():
    html = (
        'data-entity-urn="urn:li:jobPosting:3333333333"'
        + '<h3 class="base-search-card__title">Full&#8203;Stack Dev &amp; Co</h3>'
    )
    cards = ljs.parse_job_cards(html)

    assert cards[0]["title"] == "Full\u200bStack Dev & Co"
    assert "&amp;" not in cards[0]["title"]


def test_derive_search_query():
    payload = {"skills": ["Python", "AWS", "Docker", "React", "SQL"]}
    assert ljs.derive_search_query(payload) == "Python AWS Docker React"

    assert ljs.derive_search_query({"skills": []}) == ""
    assert ljs.derive_search_query({"skills": "Python"}) == ""
    assert ljs.derive_search_query(None) == ""
    assert ljs.derive_search_query({}) == ""


def test_recommend_jobs_sorts_by_keyword_match_and_limits(monkeypatch):
    titles = ["React Developer", "Python Engineer", "Python React Developer"]
    html = "".join(
        f'data-entity-urn="urn:li:jobPosting:{1000000000 + i}"'
        f'<h3 class="base-search-card__title">{title}</h3>'
        for i, title in enumerate(titles)
    )
    monkeypatch.setattr(ljs, "html_fetch", lambda url, params: html)

    results = ljs.recommend_jobs(query="python react", location="Remote", limit=2)

    assert len(results) == 2
    assert results[0]["title"] == "Python React Developer"
    assert results[0]["matched_keywords"] == ["python", "react"]
    assert results[1]["matched_keywords"] == ["react"]


def test_recommend_jobs_uses_supplied_params(monkeypatch):
    captured: list[dict] = []

    def fake_fetch(url, params):
        captured.append(params)
        return ""

    monkeypatch.setattr(ljs, "html_fetch", fake_fetch)

    ljs.recommend_jobs(
        query="python",
        location="Berlin, Germany",
        remote="remote",
        jobage=7,
        limit=5,
    )

    assert captured[0]["keywords"] == "python"
    assert captured[0]["location"] == "Berlin, Germany"
    assert captured[0]["f_TPR"] == "r604800"
    assert captured[0]["f_WT"] == "2"


def test_jobage_to_tpr_and_work_type_flag():
    assert ljs.jobage_to_tpr(7) == "r604800"
    assert ljs.jobage_to_tpr(30) == "r2592000"
    assert ljs.jobage_to_tpr(0) is None
    assert ljs.jobage_to_tpr(None) is None

    assert ljs.work_type_flag("remote") == "2"
    assert ljs.work_type_flag("hybrid") == "3"
    assert ljs.work_type_flag("onsite") == "1"
    assert ljs.work_type_flag("On-Site") == "1"
    assert ljs.work_type_flag(None) is None
    assert ljs.work_type_flag("") is None
