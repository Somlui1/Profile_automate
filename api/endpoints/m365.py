from fastapi import APIRouter, HTTPException, status
from services.m365_service import m365_service
import logging

router = APIRouter()
logger = logging.getLogger("app.api.m365")

@router.get("/licenses", status_code=status.HTTP_200_OK)
def get_m365_licenses():
    """
    Get Microsoft 365 license inventory data including prepaid, consumed, and unassigned units.
    """
    try:
        data = m365_service.get_licenses()
        return data
    except Exception as e:
        logger.error(f"Error serving M365 licenses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve license data: {str(e)}"
        )
