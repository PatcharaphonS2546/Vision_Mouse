"""
Base response models for Vision Mouse API
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, Optional, Generic, TypeVar, List
from datetime import datetime

T = TypeVar('T')


class BaseResponse(BaseModel):
    """Base response model"""
    success: bool = Field(default=True, description="Operation success status")
    message: str = Field(description="Response message")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")


class SuccessResponse(BaseResponse, Generic[T]):
    """Success response with data"""
    data: T = Field(description="Response data")
    
    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})


class ErrorResponse(BaseResponse):
    """Error response model"""
    success: bool = Field(default=False)
    error_code: int = Field(description="Error code")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Error details")
    path: Optional[str] = Field(description="Request path where error occurred")


class ValidationErrorResponse(ErrorResponse):
    """Validation error response"""
    validation_errors: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of validation errors"
    )


class HealthCheckResponse(BaseModel):
    """Health check response model"""
    status: str = Field(description="Service status")
    service: str = Field(description="Service name")
    version: str = Field(description="Service version")
    timestamp: datetime = Field(default_factory=datetime.now)
    
    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})


class PaginatedResponse(BaseResponse, Generic[T]):
    """Paginated response model"""
    data: List[T] = Field(description="Paginated data")
    pagination: Dict[str, Any] = Field(description="Pagination information")
    
    @classmethod
    def create(
        cls,
        data: List[T],
        total: int,
        page: int = 1,
        size: int = 10,
        message: str = "Data retrieved successfully"
    ):
        """Create paginated response"""
        total_pages = (total + size - 1) // size
        
        return cls(
            data=data,
            message=message,
            pagination={
                "total": total,
                "page": page,
                "size": size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1
            }
        )
