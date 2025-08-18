"""
Analytics models
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class AnalyticsSession(BaseModel):
    session_id: str = Field(..., description="Session ID")
    start_time: datetime = Field(..., description="Session start time")
    end_time: Optional[datetime] = Field(None, description="Session end time")
    duration: Optional[float] = Field(None, ge=0, description="Session duration (seconds)")
    accuracy: Optional[float] = Field(None, ge=0, le=100, description="Session accuracy (%)")
    calibration_accuracy: Optional[float] = Field(None, ge=0, le=100)
    data_points: int = Field(..., ge=0)
