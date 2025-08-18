"""
API v1 router for Vision Mouse Backend
"""

from fastapi import APIRouter

# Create API v1 router
api_router = APIRouter()

# Import endpoints here to avoid circular imports
from .endpoints import health, calibration, tracking, analytics, websocket, files, system

# Include endpoint routers
api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"]
)

api_router.include_router(
    calibration.router,
    prefix="/calibration",
    tags=["calibration"]
)

api_router.include_router(
    tracking.router,
    prefix="/tracking",
    tags=["tracking"]
)

api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["analytics"]
)

api_router.include_router(
    websocket.router,
    prefix="/ws",
    tags=["websocket"]
)

api_router.include_router(
    files.router,
    prefix="/files",
    tags=["files"]
)

api_router.include_router(
    system.router,
    prefix="/system",
    tags=["system"]
)
