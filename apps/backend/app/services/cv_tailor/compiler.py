from __future__ import annotations
import os
from dataclasses import dataclass
import httpx

LATEX_URL = os.environ.get("LATEX_SERVICE_URL", "http://tp-latex:8090")


@dataclass
class CompileResult:
    ok: bool
    pdf: bytes | None
    log: str


async def _post(tex: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=70) as c:
        return await c.post(f"{LATEX_URL}/compile", content=tex.encode("utf-8"),
                            headers={"Content-Type": "text/plain"})


async def compile_tex(tex: str) -> CompileResult:
    resp = await _post(tex)
    if resp.status_code == 200:
        return CompileResult(ok=True, pdf=resp.content, log="")
    return CompileResult(ok=False, pdf=None, log=resp.text)
