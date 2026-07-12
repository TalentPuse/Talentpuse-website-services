FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/mcp_server/

EXPOSE 8080

CMD ["python", "-m", "mcp_server.server"]
