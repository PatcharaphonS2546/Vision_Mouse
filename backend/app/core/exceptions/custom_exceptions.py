"""
Custom exceptions for Vision Mouse Backend
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class VisionMouseException(Exception):
    """Base exception for Vision Mouse application"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(VisionMouseException):
    """Raised when data validation fails"""
    pass


class NotFoundError(VisionMouseException):
    """Raised when requested resource is not found"""
    pass


class CalibrationError(VisionMouseException):
    """Raised when calibration process fails"""
    pass


class TrackingError(VisionMouseException):
    """Raised when eye tracking fails"""
    pass


class ScriptExecutionError(VisionMouseException):
    """Raised when Python script execution fails"""
    pass


class WebSocketError(VisionMouseException):
    """Raised when WebSocket connection fails"""
    pass


# HTTP Exception helpers
def create_http_exception(
    status_code: int,
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> HTTPException:
    """Create standardized HTTP exception"""
    return HTTPException(
        status_code=status_code,
        detail={
            "message": message,
            "details": details or {},
            "error_code": status_code
        }
    )


def not_found_exception(resource: str, identifier: str = "") -> HTTPException:
    """Create 404 Not Found exception"""
    message = f"{resource} not found"
    if identifier:
        message += f": {identifier}"
    
    return create_http_exception(
        status_code=status.HTTP_404_NOT_FOUND,
        message=message,
        details={"resource": resource, "identifier": identifier}
    )


def validation_exception(field: str, value: Any, reason: str) -> HTTPException:
    """Create 422 Validation Error exception"""
    return create_http_exception(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message=f"Validation failed for field '{field}'",
        details={
            "field": field,
            "value": str(value),
            "reason": reason
        }
    )


def internal_server_exception(message: str = "Internal server error") -> HTTPException:
    """Create 500 Internal Server Error exception"""
    return create_http_exception(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message=message
    )
