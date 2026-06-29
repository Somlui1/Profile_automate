# Stage 1: Build the frontend React app
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Copy frontend dependency files
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source code
COPY frontend/ ./
RUN npm run build

# Stage 2: Create the Python runtime image
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    krb5-user \
    libkrb5-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API backend source
COPY api/ .

# Copy steps_schema.json from worker directory
COPY worker/steps_schema.json ./worker/steps_schema.json

# Copy built frontend assets from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /build/dist ./frontend/dist

EXPOSE 8000
COPY api/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
