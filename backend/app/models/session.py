"""
User session models
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserSession(BaseModel):
    user_id: str = Field(..., description="User ID")
    session_id: str = Field(..., description="Session ID")
    started_at: datetime = Field(...)
    ended_at: Optional[datetime] = Field(None)
    active: bool = Field(True)
