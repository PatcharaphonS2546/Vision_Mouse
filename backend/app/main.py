"""
FastAPI Main Application
Entry point for Vision Mouse Backend API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uvicorn

from .core.middleware import setup_middleware
from .core.exceptions.custom_exceptions import VisionMouseException
from .core.exceptions.handlers import (
    vision_mouse_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from .api.api import api_router
from .config import settings

# Create FastAPI instance
app = FastAPI(
    title="Vision Mouse Backend API",
    description="Backend API for Vision Mouse frontend communication and Python script execution",
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc"
)


# Setup CORS middleware for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_middleware(app)

# Add exception handlers
app.add_exception_handler(VisionMouseException, vision_mouse_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include API routes
app.include_router(
    api_router,
    prefix=settings.API_PREFIX
)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Vision Mouse Backend",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Vision Mouse Backend API",
        "docs": "/api/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
