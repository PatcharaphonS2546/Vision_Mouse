import numpy as np
import cv2
import uvicorn
import asyncio

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from .core.middleware import setup_middleware
from .core.exceptions.custom_exceptions import VisionMouseException
from .core.exceptions.handlers import (
    vision_mouse_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from .api.api import api_router
from .config import settings
from fastapi.responses import JSONResponse
from scripts.core.process_core import process_frame
from collections import deque

# Create FastAPI instance
app = FastAPI(
    title="Vision Mouse Backend API",
    description="Backend API for Vision Mouse frontend communication and Python script execution",
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc"
)

# Phase 1: Endpoint สำหรับรับภาพจาก Angular
frame_queue_http = deque(maxlen=1)

@app.post("/api/v1/gaze/predict")
async def gaze_predict(file: UploadFile = File(...)):
    ts = None  # สามารถรับ timestamp จาก query/body เพิ่มเติมได้
    image_bytes = await file.read()
    frame = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    frame_queue_http.append((frame, ts))  # drop-old keep-latest
    latest = frame_queue_http[-1]
    # TODO: สร้าง/โหลด calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model ตามจริง
    calibration_model = None
    stabilizer = None
    drift_corrector = None
    analytics_reporter = None
    end2end_model = None
    result = process_frame(latest[0], latest[1], calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model)
    # Ensure schema keys for frontend compatibility
    output = {
        'ts': result.get('ts'),
        'gaze_x': result.get('gaze_x'),
        'gaze_y': result.get('gaze_y'),
        'quality': result.get('quality'),
        'timing_ms': result.get('timing_ms'),
        'debug': result.get('debug'),
        'analytics': result.get('analytics')
    }
    return JSONResponse(content=output)

# Phase 2: WebSocket สำหรับ stream real-time และ queue/backpressure
frame_queue = deque(maxlen=1)
@app.websocket("/api/v1/gaze/ws")
async def gaze_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            ts = None  # สามารถรับ timestamp จาก message เพิ่มเติมได้
            frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            frame_queue.append((frame, ts))  # drop-old keep-latest
            latest = frame_queue[-1]
            # TODO: สร้าง/โหลด calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model ตามจริง
            calibration_model = None
            stabilizer = None
            drift_corrector = None
            analytics_reporter = None
            end2end_model = None
            result = process_frame(latest[0], latest[1], calibration_model, stabilizer, drift_corrector, analytics_reporter, end2end_model)
            # Ensure schema keys for frontend compatibility
            output = {
                'ts': result.get('ts'),
                'gaze_x': result.get('gaze_x'),
                'gaze_y': result.get('gaze_y'),
                'quality': result.get('quality'),
                'timing_ms': result.get('timing_ms'),
                'debug': result.get('debug'),
                'analytics': result.get('analytics')
            }
            await websocket.send_json(output)
    except WebSocketDisconnect:
        pass

# Phase 3: Endpoint สำหรับ calibration (รับจุดจริงจาก UI)
@app.post("/api/v1/gaze/calibrate")
async def gaze_calibrate(
    features: list = Body(...),
    targets: list = Body(...)
):
    # TODO: โหลด/สร้าง calibration_model จริง
    from scripts.calibration.calibration import CalibrationModel
    calibration_model = CalibrationModel()
    X = np.array(features)
    y = np.array(targets)
    rmse = calibration_model.fit(X, y)
    # สามารถบันทึก calibration_model หรือพารามิเตอร์ไว้ session/user ได้
    return {"status": "calibrated", "rmse": rmse}

# Phase 4: Endpoint สำหรับ analytics/metrics
@app.get("/api/v1/gaze/metrics")
async def gaze_metrics():
    # TODO: โหลด/สร้าง analytics_reporter จริง
    from scripts.analytics.analytics_reporting import AnalyticsReporter
    analytics_reporter = AnalyticsReporter()
    summary = analytics_reporter.report()
    return {"status": "ok", "metrics": summary}

# Setup CORS middleware for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_middleware(app)

# Add exception handlers
app.add_exception_handler(VisionMouseException, vision_mouse_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include API routes
app.include_router(
    api_router,
    prefix=settings.API_PREFIX
)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Vision Mouse Backend",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Vision Mouse Backend API",
        "docs": "/api/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )