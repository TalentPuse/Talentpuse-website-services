from pathlib import Path
from app.services.cv_tailor.validator import page_count


def test_page_count_one():
    pdf = (Path(__file__).parent / "fixtures" / "one_page.pdf").read_bytes()
    assert page_count(pdf) == 1
