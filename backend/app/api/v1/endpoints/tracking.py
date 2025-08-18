"""
Eye tracking endpoints
"""

from fastapi import APIRouter
from ....models.responses import SuccessResponse
from ....models.requests import TrackingConfigRequest
from ....models.tracking import TrackingData
from ....core.websocket.manager import manager
import asyncio

router = APIRouter()


@router.get("/status", response_model=SuccessResponse[dict])
async def get_tracking_status():
    """Get current tracking status"""
    return SuccessResponse(
        data={
            "tracking_active": False,
            "camera_connected": True,
            "fps": 30,
            "last_gaze_point": {"x": 0.5, "y": 0.5},
            "confidence": 0.85,
            "calibration_valid": True
        },
        message="Tracking status retrieved successfully"
    )


@router.post("/start", response_model=SuccessResponse[dict])
async def start_tracking(config: TrackingConfigRequest = None):
    """Start eye tracking"""
    
    tracking_data = {
        "tracking_id": "track_123456",
        "status": "started",
        "timestamp": "2025-08-18T10:30:00Z",
        "config": config.dict() if config else {}
    }
    
    # Notify WebSocket clients
    await manager.send_tracking_data(tracking_data)
    
    return SuccessResponse(
        data=tracking_data,
        message="Eye tracking started successfully"
    )


@router.post("/stop", response_model=SuccessResponse[dict])
async def stop_tracking():
    """Stop eye tracking"""
    
    stop_data = {
        "tracking_id": "track_123456",
        "status": "stopped",
        "duration": 120.5,
        "data_points": 3615
    }
    
    # Notify WebSocket clients
    await manager.send_tracking_data(stop_data)
    
    return SuccessResponse(
        data=stop_data,
        message="Eye tracking stopped successfully"
    )



@router.get("/data", response_model=TrackingData)
async def get_tracking_data():
    """Get current tracking data"""
    return TrackingData(
        tracking_id="track_123456",
        gaze_x=0.5,
        gaze_y=0.5,
        confidence=0.87,
        pupil_diameter=3.2,
        blink_detected=False
    )


@router.post("/config", response_model=SuccessResponse[dict])
async def update_tracking_config(config: TrackingConfigRequest):
    """Update tracking configuration"""
    return SuccessResponse(
        data=config.dict(),
        message="Tracking configuration updated successfully"
    )
