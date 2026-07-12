# tp-latex: Tectonic-based LaTeX compile microservice.
FROM python:3.11-slim-trixie
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates \
      libfontconfig1 libgraphite2-3 libharfbuzz0b libicu76 libssl3t64 libfreetype6 \
 && curl -fsSL https://drop-sh.fullyjustified.net | sh && mv tectonic /usr/local/bin/ \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir fastapi==0.115.0 uvicorn==0.32.0 python-multipart
COPY server.py /app/server.py
WORKDIR /app
RUN printf '\\documentclass{article}\\begin{document}x\\end{document}' > /tmp/w.tex \
 && tectonic /tmp/w.tex -o /tmp || true
EXPOSE 8090
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8090"]
