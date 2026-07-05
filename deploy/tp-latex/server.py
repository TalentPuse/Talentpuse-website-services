import subprocess, tempfile, pathlib
from fastapi import FastAPI, Body, Response

app = FastAPI()


@app.post("/compile")
def compile_tex(tex: str = Body(..., media_type="text/plain")):
    with tempfile.TemporaryDirectory() as d:
        p = pathlib.Path(d)
        (p / "cv.tex").write_text(tex, encoding="utf-8")
        r = subprocess.run(
            ["tectonic", "cv.tex", "--outdir", str(p), "--keep-logs", "-Z", "continue-on-errors"],
            cwd=d, capture_output=True, text=True, timeout=60,
        )
        pdf = p / "cv.pdf"
        log = (p / "cv.log").read_text(errors="ignore") if (p / "cv.log").exists() else r.stderr
        if r.returncode == 0 and pdf.exists():
            return Response(content=pdf.read_bytes(), media_type="application/pdf")
        return Response(content=log, media_type="text/plain", status_code=422)
