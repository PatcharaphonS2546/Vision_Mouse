"""
Request models for Vision Mouse API
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class CalibrationPointRequest(BaseModel):
    """Request model for calibration point submission"""
    point_x: float = Field(..., ge=0.0, le=1.0, description="X coordinate (0-1)")
    point_y: float = Field(..., ge=0.0, le=1.0, description="Y coordinate (0-1)")
    gaze_x: float = Field(..., description="Detected gaze X coordinate")
    gaze_y: float = Field(..., description="Detected gaze Y coordinate")
    confidence: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="Detection confidence")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)


class TrackingConfigRequest(BaseModel):
    """Request model for tracking configuration"""
    fps: Optional[int] = Field(30, ge=1, le=120, description="Frames per second")
    resolution: Optional[str] = Field("640x480", description="Camera resolution")
    enable_mouse_control: Optional[bool] = Field(False, description="Enable mouse control")
    smoothing_factor: Optional[float] = Field(0.5, ge=0.0, le=1.0, description="Smoothing factor")
    calibration_required: Optional[bool] = Field(True, description="Require calibration")


class AnalyticsFilterRequest(BaseModel):
    """Request model for analytics filtering"""
    date_from: Optional[datetime] = Field(None, description="Start date filter")
    date_to: Optional[datetime] = Field(None, description="End date filter")
    session_ids: Optional[List[str]] = Field(None, description="Specific session IDs")
    min_duration: Optional[float] = Field(None, ge=0, description="Minimum session duration")
    min_accuracy: Optional[float] = Field(None, ge=0, le=100, description="Minimum accuracy")


class WebSocketSubscriptionRequest(BaseModel):
    """Request model for WebSocket subscription"""
    subscription_type: str = Field(..., description="Type of data to subscribe to")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Subscription filters")
    
    @field_validator('subscription_type')
    def validate_subscription_type(cls, v):
        allowed_types = ['tracking_data', 'calibration_updates', 'system_status', 'analytics']
        if v not in allowed_types:
            raise ValueError(f'subscription_type must be one of: {allowed_types}')
        return v


class SystemConfigRequest(BaseModel):
    """Request model for system configuration"""
    auto_calibration: Optional[bool] = Field(None, description="Enable auto-calibration")
    data_retention_days: Optional[int] = Field(None, ge=1, le=365, description="Data retention period")
    performance_monitoring: Optional[bool] = Field(None, description="Enable performance monitoring")
    debug_mode: Optional[bool] = Field(None, description="Enable debug mode")
    max_concurrent_sessions: Optional[int] = Field(None, ge=1, le=100, description="Max concurrent sessions")


class ScriptExecutionRequest(BaseModel):
    """Request model for Python script execution"""
    script_name: str = Field(..., description="Name of the script to execute")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Script parameters")
    async_execution: Optional[bool] = Field(False, description="Execute asynchronously")
    timeout: Optional[int] = Field(300, ge=1, le=3600, description="Execution timeout in seconds")


class BulkDataRequest(BaseModel):
    """Request model for bulk data operations"""
    operation: str = Field(..., description="Bulk operation type")
    data: List[Dict[str, Any]] = Field(..., description="Bulk data payload")
    batch_size: Optional[int] = Field(100, ge=1, le=1000, description="Batch processing size")
    
    @field_validator('operation')
    def validate_operation(cls, v):
        allowed_operations = ['import', 'export', 'delete', 'update']
        if v not in allowed_operations:
            raise ValueError(f'operation must be one of: {allowed_operations}')
        return v
