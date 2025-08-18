"""
Calibration endpoints
"""


from fastapi import APIRouter
from ....models.responses import SuccessResponse
from ....models.requests import CalibrationPointRequest
from ....models.calibration import CalibrationResult
from ....core.websocket.manager import manager

router = APIRouter()



@router.get("/", response_model=CalibrationResult)
async def get_calibration_status():
    """Get current calibration status"""
    return CalibrationResult(
        calibration_id="cal_123456",
        status="ready",
        accuracy=None,
        valid=False,
        points_completed=0,
        total_points=9,
        completed_at=None
    )


@router.post("/start", response_model=SuccessResponse[dict])
async def start_calibration():
    """Start calibration process"""
    calibration_data = {
        "calibration_id": "cal_123456",
        "status": "started",
        "next_point": {"x": 0.1, "y": 0.1},
        "points_completed": 0,
        "total_points": 9
    }
    
    # Notify WebSocket clients
    await manager.send_calibration_update(calibration_data)
    
    return SuccessResponse(
        data=calibration_data,
        message="Calibration started successfully"
    )


@router.post("/point", response_model=SuccessResponse[dict])
async def submit_calibration_point(point_data: CalibrationPointRequest):
    """Submit calibration point"""
    
    # Calculate accuracy (mock calculation)
    accuracy = 95.0 - abs(point_data.point_x - point_data.gaze_x) * 10
    
    response_data = {
        "point_accepted": True,
        "points_completed": 1,
        "accuracy": accuracy,
        "next_point": {"x": 0.5, "y": 0.1} if accuracy > 80 else {"x": 0.1, "y": 0.1},
        "confidence": point_data.confidence
    }
    
    # Notify WebSocket clients
    await manager.send_calibration_update(response_data)
    
    return SuccessResponse(
        data=response_data,
        message="Calibration point submitted successfully"
    )


@router.post("/complete", response_model=SuccessResponse[dict])
async def complete_calibration():
    """Complete calibration process"""
    
    completion_data = {
        "calibration_id": "cal_123456",
        "status": "completed",
        "accuracy": 95.5,
        "valid": True,
        "points_completed": 9,
        "total_points": 9
    }
    
    # Notify WebSocket clients
    await manager.send_calibration_update(completion_data)
    
    return SuccessResponse(
        data=completion_data,
        message="Calibration completed successfully"
    )


@router.post("/reset", response_model=SuccessResponse[dict])
async def reset_calibration():
    """Reset calibration data"""
    
    reset_data = {
        "status": "reset",
        "points_completed": 0,
        "total_points": 9,
        "accuracy": None
    }
    
    # Notify WebSocket clients
    await manager.send_calibration_update(reset_data)
    
    return SuccessResponse(
        data=reset_data,
        message="Calibration reset successfully"
    )
