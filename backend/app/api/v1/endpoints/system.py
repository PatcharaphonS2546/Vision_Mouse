"""
System configuration and advanced endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from ....models.responses import SuccessResponse
from ....models.requests import SystemConfigRequest, ScriptExecutionRequest, BulkDataRequest
from ....config import settings
import asyncio
import subprocess
import os
import json
from typing import Dict, Any

router = APIRouter()


@router.get("/info", response_model=SuccessResponse[dict])
async def get_system_info():
    """Get system information and configuration"""
    return SuccessResponse(
        data={
            "version": "1.0.0",
            "api_version": settings.API_VERSION,
            "host": settings.HOST,
            "port": settings.PORT,
            "debug": settings.DEBUG,
            "features": {
                "websocket": True,
                "file_upload": True,
                "script_execution": True,
                "analytics": True,
                "real_time_tracking": True
            },
            "limits": {
                "max_file_size": "100MB",
                "max_connections": 100,
                "rate_limit": "1000/hour"
            }
        },
        message="System information retrieved successfully"
    )


@router.post("/config", response_model=SuccessResponse[dict])
async def update_system_config(config: SystemConfigRequest):
    """Update system configuration"""
    
    # In a real implementation, this would update actual system settings
    updated_config = config.dict(exclude_unset=True)
    
    return SuccessResponse(
        data={
            "updated_settings": updated_config,
            "applied": True,
            "restart_required": False
        },
        message="System configuration updated successfully"
    )


@router.get("/config", response_model=SuccessResponse[dict])
async def get_system_config():
    """Get current system configuration"""
    return SuccessResponse(
        data={
            "auto_calibration": True,
            "data_retention_days": 30,
            "performance_monitoring": True,
            "debug_mode": settings.DEBUG,
            "max_concurrent_sessions": 10
        },
        message="System configuration retrieved successfully"
    )


@router.post("/script/execute", response_model=SuccessResponse[dict])
async def execute_python_script(request: ScriptExecutionRequest):
    """Execute a Python script"""
    
    script_path = os.path.join(settings.SCRIPTS_DIR, f"{request.script_name}.py")
    
    if not os.path.exists(script_path):
        raise HTTPException(
            status_code=404,
            detail=f"Script '{request.script_name}' not found"
        )
    
    try:
        if request.async_execution:
            # For async execution, return execution ID
            execution_id = f"exec_{request.script_name}_{int(asyncio.get_event_loop().time())}"
            
            # In a real implementation, this would start the script in background
            return SuccessResponse(
                data={
                    "execution_id": execution_id,
                    "status": "started",
                    "async": True,
                    "script": request.script_name
                },
                message="Script execution started asynchronously"
            )
        else:
            # Synchronous execution: run script and capture output
            import sys
            import time
            start_time = time.time()
            try:
                result = subprocess.run([
                    sys.executable,
                    script_path
                ] + [str(v) for v in request.parameters.values()],
                    capture_output=True, text=True, timeout=request.timeout)
                exec_time = time.time() - start_time
                output = result.stdout.strip()
                # Try to parse output as JSON
                try:
                    output_json = json.loads(output)
                except Exception:
                    output_json = output
                return SuccessResponse(
                    data={
                        "script": request.script_name,
                        "status": "completed" if result.returncode == 0 else "error",
                        "exit_code": result.returncode,
                        "output": output_json,
                        "execution_time": exec_time
                    },
                    message="Script executed successfully" if result.returncode == 0 else "Script error"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Script execution failed: {str(e)}"
                )
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Script execution failed: {str(e)}"
        )


@router.get("/scripts", response_model=SuccessResponse[list])
async def list_available_scripts():
    """List available Python scripts"""
    
    scripts = []
    if os.path.exists(settings.SCRIPTS_DIR):
        for file in os.listdir(settings.SCRIPTS_DIR):
            if file.endswith('.py'):
                script_name = file[:-3]  # Remove .py extension
                script_path = os.path.join(settings.SCRIPTS_DIR, file)
                
                stat = os.stat(script_path)
                scripts.append({
                    "name": script_name,
                    "filename": file,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "executable": os.access(script_path, os.X_OK)
                })
    
    return SuccessResponse(
        data=scripts,
        message=f"Found {len(scripts)} available scripts"
    )


@router.post("/bulk", response_model=SuccessResponse[dict])
async def bulk_data_operation(request: BulkDataRequest):
    """Perform bulk data operations"""
    
    total_items = len(request.data)
    processed = 0
    errors = []
    
    # Process in batches
    for i in range(0, total_items, request.batch_size):
        batch = request.data[i:i + request.batch_size]
        
        try:
            # Mock processing
            processed += len(batch)
            await asyncio.sleep(0.1)  # Simulate processing time
            
        except Exception as e:
            errors.append(f"Batch {i//request.batch_size + 1}: {str(e)}")
    
    return SuccessResponse(
        data={
            "operation": request.operation,
            "total_items": total_items,
            "processed": processed,
            "failed": total_items - processed,
            "errors": errors,
            "batch_size": request.batch_size
        },
        message=f"Bulk {request.operation} operation completed"
    )


@router.get("/status", response_model=SuccessResponse[dict])
async def get_system_status():
    """Get current system status"""
    return SuccessResponse(
        data={
            "status": "running",
            "uptime": "2h 30m",
            "memory_usage": "245MB",
            "cpu_usage": "15%",
            "active_connections": 3,
            "last_error": None,
            "services": {
                "api": "running",
                "websocket": "running",
                "file_handler": "running",
                "script_executor": "ready"
            }
        },
        message="System status retrieved successfully"
    )
