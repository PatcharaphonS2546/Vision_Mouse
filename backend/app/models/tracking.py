"""
Tracking models
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TrackingData(BaseModel):
    tracking_id: str = Field(..., description="Tracking session ID")
    gaze_x: float = Field(..., ge=0.0, le=1.0, description="Gaze X coordinate")
    gaze_y: float = Field(..., ge=0.0, le=1.0, description="Gaze Y coordinate")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    pupil_diameter: Optional[float] = Field(None, ge=0.0, description="Pupil diameter (mm)")
    blink_detected: bool = Field(False, description="Blink detected")
    timestamp: datetime = Field(default_factory=datetime.now)
