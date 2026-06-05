from fastapi import APIRouter
from endpoints import parse, user, m365, jobs, debug

api_router = APIRouter()

# Include endpoint sub-routers under api/v1 namespace
api_router.include_router(parse.router, prefix="/parse", tags=["PDF Parsing"])
api_router.include_router(user.router, prefix="/user", tags=["User Sync & AD Provisioning (Legacy)"])
api_router.include_router(m365.router, prefix="/m365", tags=["M365 License Inventory"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Job Queue & Worker Management"])
api_router.include_router(debug.router, prefix="/debug", tags=["Debug & Inspection"])

