"""
Main API router for Vision Mouse Backend
"""

from fastapi import APIRouter
from .v1 import api_router as api_v1_router

# Create main API router
api_router = APIRouter()

# Include version 1 routes
api_router.include_router(
    api_v1_router,
    prefix="/v1",
    tags=["v1"]
)
