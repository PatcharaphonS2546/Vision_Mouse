"""
Global exception handlers for FastAPI application
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
from typing import Union

from .custom_exceptions import VisionMouseException, create_http_exception

logger = logging.getLogger(__name__)


async def vision_mouse_exception_handler(
    request: Request, 
    exc: VisionMouseException
) -> JSONResponse:
    """Handle custom VisionMouseException"""
    logger.error(f"VisionMouseException: {exc.message}", extra={"details": exc.details})
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "message": exc.message,
            "details": exc.details,
            "error_code": 500,
            "path": str(request.url)
        }
    )


async def http_exception_handler(
    request: Request, 
    exc: Union[HTTPException, StarletteHTTPException]
) -> JSONResponse:
    """Handle HTTP exceptions"""
    logger.warning(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    
    # Ensure detail is properly formatted
    if isinstance(exc.detail, dict):
        content = exc.detail
    else:
        content = {
            "message": str(exc.detail),
            "details": {},
            "error_code": exc.status_code
        }
    
    content["path"] = str(request.url)
    
    return JSONResponse(
        status_code=exc.status_code,
        content=content
    )


async def validation_exception_handler(
    request: Request, 
    exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors"""
    logger.warning(f"Validation Error: {exc.errors()}")
    
    # Format validation errors
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "message": "Request validation failed",
            "details": {"validation_errors": errors},
            "error_code": 422,
            "path": str(request.url)
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "message": "An unexpected error occurred",
            "details": {"error_type": type(exc).__name__},
            "error_code": 500,
            "path": str(request.url)
        }
    )
