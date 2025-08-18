"""
Calibration models
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CalibrationResult(BaseModel):
    calibration_id: str = Field(..., description="Calibration session ID")
    status: str = Field(..., description="Calibration status")
    accuracy: Optional[float] = Field(None, ge=0, le=100, description="Calibration accuracy (%)")
    valid: bool = Field(..., description="Is calibration valid?")
    points_completed: int = Field(..., ge=0, description="Number of points completed")
    total_points: int = Field(..., ge=1, description="Total calibration points")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
