import os
import sys

# Locate directories relative to this file
api_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(api_dir)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from endpoints.router import api_router
from core.config import settings
from core.database import init_db

app = FastAPI(
    title="AD User & Print Code Sync API",
    description="3-tier API service to parse request PDFs, provision AD accounts, and configure Papercut printer PINs.",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    init_db()

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for admin UI convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include core REST API router
app.include_router(api_router, prefix="/api/v1")

frontend_dir = os.path.abspath(os.path.join(backend_dir, "frontend"))

# Serve frontend single-page dashboard at root URL
@app.get("/", tags=["Frontend Admin UI"])
def read_root():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AD & Printer Sync API is active. Frontend directory not found locally."}

# Mount static files (CSS, JS) if frontend folder exists
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True, app_dir=backend_dir)
