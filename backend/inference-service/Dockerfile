FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/inference-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/inference-service/app ./app
COPY backend/inference-service/.env.example ./.env.example
COPY ml-pipeline/models/final/road_sense_model.h5 /models/road_sense_model.h5

ENV MODEL_PATH=/models/road_sense_model.h5
ENV INFERENCE_HOST=0.0.0.0
ENV INFERENCE_PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
