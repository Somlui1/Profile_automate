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

# Install dependencies
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API backend source
COPY api/ .

# Copy built frontend assets from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /build/dist ./frontend/dist

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
