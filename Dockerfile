FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8000
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 fixflow && mkdir -p /app/storage && chown fixflow:fixflow /app/storage
COPY --chown=fixflow:fixflow backend ./backend
COPY --chown=fixflow:fixflow web ./web
COPY --chown=fixflow:fixflow assets ./assets
USER fixflow
EXPOSE 8000
CMD ["python", "-m", "backend.server"]
