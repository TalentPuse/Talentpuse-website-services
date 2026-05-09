"""Quick benchmark: extract text from CV + time the LLM call."""
import json
import time
import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Load .env manually (no dotenv dependency)
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    with open(_env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.services.cv_parser import SYSTEM_PROMPT, extract_text


def main():
    cv_path = r"D:\TalentPulse\NguyenMinhBao_cv.pdf"
    if not os.path.exists(cv_path):
        print(f"File not found: {cv_path}")
        return

    # Step 1: extract text
    print(f"OPENAI_BASE_URL = {OPENAI_BASE_URL}")
    print(f"OPENAI_MODEL    = {OPENAI_MODEL}")
    print(f"OPENAI_API_KEY  = {OPENAI_API_KEY[:8]}..." if OPENAI_API_KEY else "OPENAI_API_KEY  = (empty!)")
    print()

    t0 = time.perf_counter()
    with open(cv_path, "rb") as f:
        pdf_bytes = f.read()
    text = extract_text(pdf_bytes)
    t1 = time.perf_counter()
    print(f"[extract_text] {len(pdf_bytes):,} bytes PDF -> {len(text):,} chars text in {t1-t0:.2f}s")
    safe_text = text[:300].encode("utf-8", errors="replace").decode("utf-8")
    print(f"[extract_text] first 300 chars:\n{safe_text}\n")

    if not text.strip():
        print("PDF has no text, aborting.")
        return

    # Step 2: LLM call
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)

    print(f"[parse_cv] calling {OPENAI_MODEL} (timeout=120s)...")
    t2 = time.perf_counter()
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Phân tích CV sau:\n\n{text}"},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            timeout=120,
        )
        t3 = time.perf_counter()
        content = response.choices[0].message.content
        data = json.loads(content)
        print(f"[parse_cv] SUCCESS in {t3-t2:.2f}s")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"\n[total] extract + parse: {t3-t0:.2f}s")
    except Exception as e:
        t3 = time.perf_counter()
        print(f"[parse_cv] FAILED after {t3-t2:.2f}s: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
