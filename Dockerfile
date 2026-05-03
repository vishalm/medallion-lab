FROM node:20-alpine AS frontend
WORKDIR /build
COPY app/frontend/package.json app/frontend/package-lock.json* ./
RUN npm install
COPY app/frontend/ ./
RUN npm run build

FROM python:3.11-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/static

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY app/backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY app/backend/ ./backend/
COPY --from=frontend /build/dist/ ./static/

RUN mkdir -p /app/data

EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=5s --start-period=25s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
