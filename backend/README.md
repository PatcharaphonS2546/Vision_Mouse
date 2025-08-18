# Vision Mouse Backend API

FastAPI backend server for Vision Mouse eye tracking system.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration settings
│   └── core/
│       ├── __init__.py
│       └── middleware.py    # Middleware configuration
├── scripts/                 # Python ML/AI scripts (future)
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Installation

1. **Create virtual environment:**
   ```cmd
   cd backend
   python -m venv venv
   venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```cmd
   pip install -r requirements.txt
   ```

## Running the Server

1. **Development mode:**
   ```cmd
   cd backend
   venv\Scripts\activate
   python -m backend.app.main
   ```

2. **Using uvicorn directly:**
   ```cmd
   uvicorn backend.app.main:app --host localhost --port 8000 --reload
   ```

## API Documentation

- **Interactive API docs:** http://localhost:8000/api/docs
- **ReDoc documentation:** http://localhost:8000/api/redoc
- **Health check:** http://localhost:8000/api/health

## Configuration

All configuration is handled in `app/config.py`:

- **Server:** localhost:8000
- **CORS:** Configured for Angular frontend (localhost:4200)
- **API Prefix:** /api
- **WebSocket:** /ws (future use)

## Current Features

- ✅ FastAPI application setup
- ✅ CORS middleware for Angular integration
- ✅ Request logging middleware
- ✅ Health check endpoints
- ✅ API documentation
- ✅ Core API Infrastructure (Step 2)
- ✅ WebSocket real-time communication (Step 3)
- ✅ File upload/download system (Step 3)
- ✅ Request/Response validation (Step 3)
- ✅ Advanced endpoint implementation (Step 3)
- ⏳ Data models & validation (Step 4)
- ⏳ Python script integration (Step 5)

## API Endpoints

### Core Endpoints
- **Health:** `/api/v1/health/`, `/api/v1/health/detailed`
- **System:** `/api/v1/system/info`, `/api/v1/system/status`, `/api/v1/system/config`

### Application Endpoints
- **Calibration:** `/api/v1/calibration/`, `/start`, `/point`, `/complete`, `/reset`
- **Tracking:** `/api/v1/tracking/status`, `/start`, `/stop`, `/data`, `/config`
- **Analytics:** `/api/v1/analytics/summary`, `/sessions`, `/performance`, `/export`

### Advanced Features
- **WebSocket:** `/api/v1/ws/connect`, `/api/v1/ws/status`, `/api/v1/ws/broadcast`
- **Files:** `/api/v1/files/upload`, `/download/{file_id}`, `/list`, `/{file_id}` (DELETE)
- **Scripts:** `/api/v1/system/script/execute`, `/api/v1/system/scripts`

## WebSocket Communication

Connect to: `ws://localhost:8000/api/v1/ws/connect?client_id=your_client_id`

### Message Types:
- `ping/pong` - Keep-alive
- `subscribe/unsubscribe` - Data subscriptions
- `tracking_data` - Real-time gaze data
- `calibration_update` - Calibration progress
- `system_status` - System status updates

## Next Steps

This is Step 1 completion. Next steps will include:
- Step 2: Core API Infrastructure
- Step 3: API Endpoints Implementation
- Step 4: WebSocket Real-time Communication
- Step 5: Data Models & Validation
- Step 6: Python Script Integration
- Step 7: Testing & Validation
- Step 8: Deployment Configuration

## Development Notes

- Uses pydantic-settings for configuration management
- Structured for easy extension and ML/AI script integration
- Ready for Angular frontend communication
- Logging configured for development and production
