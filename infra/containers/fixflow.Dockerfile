FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8000
WORKDIR /app
COPY apps/fixflow/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 fixflow && mkdir -p /app/storage && chown fixflow:fixflow /app/storage
COPY --chown=fixflow:fixflow apps/fixflow/backend ./backend
COPY --chown=fixflow:fixflow apps/fixflow/web ./web
COPY --chown=fixflow:fixflow apps/fixflow/public/assets ./public/assets
USER fixflow
EXPOSE 8000
CMD ["python", "-m", "backend.server"]
