# Web box alert worker — chi chay flow alert_dispatch, khong keo theo stack
# crawl cua warehouse. Ghim cung version prefect voi tp-prefect-server de
# client/server khong lech schema (da vuong 1 lan voi 2.20 client + 2.16 server).
FROM prefecthq/prefect:2.16.5-python3.10
WORKDIR /app
ENV PYTHONPATH=/app
COPY flows/ ./flows/
