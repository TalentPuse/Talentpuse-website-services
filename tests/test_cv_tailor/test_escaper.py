from app.services.cv_tailor.escaper import latex_escape, escape_url


def test_escapes_all_special_chars():
    assert latex_escape("50% & $5 #1 a_b {x} ~ ^ c") == \
        r"50\% \& \$5 \#1 a\_b \{x\} \textasciitilde{} \textasciicircum{} c"


def test_backslash_becomes_textbackslash():
    assert latex_escape("a\\b") == r"a\textbackslash{}b"


def test_idempotent_on_plain_text():
    s = "Python, SQL, Docker"
    assert latex_escape(s) == s


def test_escape_url_keeps_url_but_escapes_hash_and_percent():
    assert escape_url("http://x.com/a#b%c") == r"http://x.com/a\#b\%c"
