"""
Analytics endpoints
"""

import os
import json
from fastapi import HTTPException
from fastapi import APIRouter, Query
from ....models.responses import SuccessResponse

from typing import Optional

router = APIRouter()



@router.get("/summary")
async def get_analytics_summary():
    """Get analytics summary"""
    return {
        "data": {
            "total_sessions": 25,
            "total_duration": 3600.5,
            "average_accuracy": 92.3,
            "calibration_success_rate": 96.2,
            "last_session": "2025-08-18T09:30:00Z"
        },
        "message": "Analytics summary retrieved successfully"
    }


@router.get("/sessions")
async def get_sessions(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
    date_from: Optional[str] = Query(None, description="Start date filter"),
    date_to: Optional[str] = Query(None, description="End date filter")
):
    """Get paginated sessions data from Python script or file (future-ready)"""
    # Mock: Read from file (replace with subprocess/script call in future)
    script_output_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "scripts", "analytics_sessions.json")
    script_output_path = os.path.abspath(script_output_path)
    sessions = []
    if os.path.exists(script_output_path):
        try:
            with open(script_output_path, "r", encoding="utf-8") as f:
                sessions = json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read analytics data: {e}")
    else:
        # Fallback mock data
        from datetime import datetime, timedelta
        for i in range(1, size + 1):
            s = {
                "session_id": f"session_{i}",
                "start_time": (datetime.now() - timedelta(minutes=30*i)).isoformat(),
                "end_time": (datetime.now() - timedelta(minutes=30*i-5)).isoformat(),
                "duration": 300.5,
                "accuracy": float(91.5 + i),
                "calibration_accuracy": float(95.2),
                "data_points": int(1800)
            }
            sessions.append(s)
    # Pagination (simple)
    total = len(sessions)
    start = (page - 1) * size
    end = start + size
    paged_sessions = sessions[start:end]
    return {
        "message": "Sessions retrieved successfully",
        "data": paged_sessions,
        "total": total,
        "page": page,
        "size": size
    }



@router.get("/performance")
async def get_performance_metrics():
    """Get performance metrics"""
    return {
        "data": {
            "accuracy_trend": [91.2, 92.1, 93.5, 92.8, 94.1],
            "fps_average": 29.8,
            "latency_average": 16.5,
            "error_rate": 0.02,
            "uptime": 99.8
        },
        "message": "Performance metrics retrieved successfully"
    }



@router.get("/export")
async def export_analytics_data(
    format: str = Query("csv", description="Export format: csv, json, xlsx"),
    date_from: Optional[str] = Query(None, description="Start date"),
    date_to: Optional[str] = Query(None, description="End date")
):
    """Export analytics data"""
    return {
        "data": {
            "export_id": "export_123456",
            "format": format,
            "status": "processing",
            "download_url": f"/api/v1/analytics/download/export_123456.{format}"
        },
        "message": "Export initiated successfully"
    }
