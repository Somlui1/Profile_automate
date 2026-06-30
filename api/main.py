import os
import sys

# Locate directories relative to this file
api_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(api_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
worker_dir = os.path.join(backend_dir, "worker")
if worker_dir not in sys.path:
    sys.path.insert(0, worker_dir)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)
else:
    sys.path.remove(api_dir)
    sys.path.insert(0, api_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.wsgi import WSGIMiddleware
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
    _print_startup_banner()

def _print_startup_banner():
    """Print a structured startup diagnostic banner to the terminal."""
    from services.ad_service import ad_service
    from services.papercut_service import papercut_service
    from services.m365_service import m365_service

    system_mode = settings.SYSTEM_MODE

    # Detect ldap3
    try:
        import ldap3 as _  # noqa
        ldap_available = True
    except ImportError:
        ldap_available = False

    MODE_ICON = {"live": "🟢", "mock": "🟡", "debug": "🔵", "unavailable": "🔴"}

    def svc_line(name: str, is_mock: bool, reasons: list[str]) -> str:
        mode = "mock" if is_mock else "live"
        icon = MODE_ICON.get(mode, "⚪")
        reason_str = f"  ← {', '.join(reasons)}" if reasons else ""
        return f"  {icon}  {name:<28} [{mode.upper()}]{reason_str}"

    # Build reasons
    ad_reasons = []
    if system_mode == "mock":
        ad_reasons.append("SYSTEM_MODE=mock")
    if not ldap_available:
        ad_reasons.append("ldap3 not installed")
    if not settings.AD_HOSTS:
        ad_reasons.append("AD_HOSTS empty")
    auth_method = getattr(settings, "AD_AUTH_METHOD", "simple").lower()
    if auth_method == "kerberos":
        if not getattr(settings, "KRB5_PRINCIPAL", None):
            ad_reasons.append("KRB5_PRINCIPAL missing")
        elif settings.AD_HOSTS and ldap_available and not ad_service._real_ad_working:
            ad_reasons.append("connection failed at startup")
    else:
        if not (settings.AD_USER and settings.AD_PASSWORD):
            ad_reasons.append("AD credentials missing")
        elif settings.AD_HOSTS and settings.AD_USER and ldap_available and not ad_service._real_ad_working:
            ad_reasons.append("connection failed at startup")

    pc_reasons = []
    if system_mode == "mock":
        pc_reasons.append("SYSTEM_MODE=mock")
    if not settings.PAPERCUT_API_URL:
        pc_reasons.append("PAPERCUT_API_URL empty")
    if not settings.PAPERCUT_API_KEY:
        pc_reasons.append("PAPERCUT_API_KEY empty")

    m365_reasons = []
    if system_mode == "mock":
        m365_reasons.append("SYSTEM_MODE=mock")
    if not settings.M365_CLIENT_SECRET:
        m365_reasons.append("M365_CLIENT_SECRET empty")

    sys_icon = MODE_ICON.get(system_mode, "⚪")
    border = "=" * 62

    print(f"\n{border}")
    print(f"  🚀  AD & Print Sync API  |  SYSTEM_MODE: {sys_icon} {system_mode.upper()}")
    print(border)
    print("  Service Components:")
    print(svc_line("Active Directory (LDAP)", ad_service.mock_mode, ad_reasons))
    print(svc_line("PaperCut Print Server",   papercut_service.mock_mode, pc_reasons))
    print(svc_line("Microsoft 365 (Graph)",   m365_service.mock_mode, m365_reasons))
    print(border)
    
    redis_url = settings.FAKE_REDIS if system_mode in ["debug", "mock"] else settings.REDIS_URL
    print(f"  🛢️  Redis Server: {redis_url}")
    print(border)
    
    print(f"  📡  Docs  : http://{settings.HOST}:{settings.PORT}/docs")
    print(f"  📋  Status: http://{settings.HOST}:{settings.PORT}/api/v1/debug/system/status")
    print(f"{border}\n")


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

# Mount RQ Dashboard for Redis Queue debugging/monitoring
os.environ["RQ_DASHBOARD_URL_PREFIX"] = "/rq"
os.environ["RQ_DASHBOARD_REDIS_URL"] = settings.FAKE_REDIS if settings.SYSTEM_MODE in ["debug", "mock"] else settings.REDIS_URL
from rq_dashboard.app import create_app

flask_app = create_app()

class PrefixMiddleware:
    def __init__(self, app, prefix=""):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        environ['PATH_INFO'] = self.prefix + environ['PATH_INFO']
        environ['SCRIPT_NAME'] = ""
        return self.app(environ, start_response)

app.mount("/rq", WSGIMiddleware(PrefixMiddleware(flask_app, "/rq")))

# Locate frontend directory (prioritize dist folder)
frontend_dir = os.path.abspath(os.path.join(api_dir, "frontend", "dist"))
if not os.path.exists(os.path.join(frontend_dir, "index.html")):
    frontend_dir = os.path.abspath(os.path.join(api_dir, "frontend"))
if not os.path.exists(os.path.join(frontend_dir, "index.html")):
    frontend_dir = os.path.abspath(os.path.join(backend_dir, "frontend", "dist"))
if not os.path.exists(os.path.join(frontend_dir, "index.html")):
    frontend_dir = os.path.abspath(os.path.join(backend_dir, "frontend"))

# Serve frontend single-page dashboard at root URL
@app.get("/", tags=["Frontend Admin UI"])
def read_root():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AD & Printer Sync API is active. Frontend directory not found locally."}

# Mount static files (CSS, JS) and assets if frontend folder exists
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True, app_dir=backend_dir)
