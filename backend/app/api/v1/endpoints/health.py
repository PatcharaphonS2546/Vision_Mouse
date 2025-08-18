"""
Health check endpoints
"""

from fastapi import APIRouter, Depends
from ....models.responses import HealthCheckResponse, SuccessResponse
from ....config import settings
import sys
from datetime import datetime

router = APIRouter()


@router.get("/", response_model=HealthCheckResponse)
async def health_check():
    """Basic health check endpoint"""
    return HealthCheckResponse(
        status="healthy",
        service="Vision Mouse Backend",
        version="1.0.0"
    )


@router.get("/detailed", response_model=SuccessResponse[dict])
async def detailed_health_check():
    """Detailed health check with system information"""
    
    health_data = {
        "service": {
            "name": "Vision Mouse Backend",
            "version": "1.0.0",
            "status": "healthy",
            "uptime": "running"
        },
        "system": {
            "python_version": sys.version,
            "platform": sys.platform
        },
        "environment": {
            "host": settings.HOST,
            "port": settings.PORT,
            "debug": settings.DEBUG
        },
        "timestamp": datetime.now()
    }
    
    return SuccessResponse(
        data=health_data,
        message="Detailed health check completed successfully"
    )
