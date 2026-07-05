import pytest
from unittest.mock import AsyncMock, patch
from app.services.cv_tailor.compiler import compile_tex


class _Resp:
    def __init__(self, status, content=b"", text=""):
        self.status_code = status
        self.content = content
        self.text = text


@pytest.mark.asyncio
async def test_compile_ok_returns_pdf():
    with patch("app.services.cv_tailor.compiler._post",
               AsyncMock(return_value=_Resp(200, content=b"%PDF-1.5 fake"))):
        r = await compile_tex(r"\documentclass{article}\begin{document}x\end{document}")
    assert r.ok is True and r.pdf == b"%PDF-1.5 fake"


@pytest.mark.asyncio
async def test_compile_fail_returns_log():
    with patch("app.services.cv_tailor.compiler._post",
               AsyncMock(return_value=_Resp(422, text="! Undefined control sequence."))):
        r = await compile_tex(r"\bad")
    assert r.ok is False and "Undefined control sequence" in r.log
