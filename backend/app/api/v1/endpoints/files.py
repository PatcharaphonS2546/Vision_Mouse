"""
File management endpoints
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse
from ....models.responses import SuccessResponse
from ....config import settings
import os
import uuid
import aiofiles
from typing import List, Optional
import mimetypes

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(settings.SCRIPTS_DIR), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=SuccessResponse[dict])
async def upload_file(
    file: UploadFile = File(...),
    category: str = Query("general", description="File category")
):
    """Upload a file"""
    
    # Validate file type
    allowed_types = {
        "image": ["image/jpeg", "image/png", "image/gif", "image/webp"],
        "video": ["video/mp4", "video/avi", "video/mov", "video/mkv"],
        "data": ["application/json", "text/csv", "application/octet-stream"],
        "general": ["*"]
    }
    
    if category != "general":
        if file.content_type not in allowed_types.get(category, []):
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} not allowed for category {category}"
            )
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{file_id}{file_extension}"
    
    # Create category directory
    category_dir = os.path.join(UPLOAD_DIR, category)
    os.makedirs(category_dir, exist_ok=True)
    
    file_path = os.path.join(category_dir, unique_filename)
    
    try:
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get file info
        file_size = len(content)
        
        return SuccessResponse(
            data={
                "file_id": file_id,
                "filename": file.filename,
                "unique_filename": unique_filename,
                "category": category,
                "size": file_size,
                "content_type": file.content_type,
                "upload_path": f"/api/v1/files/download/{file_id}"
            },
            message="File uploaded successfully"
        )
        
    except Exception as e:
        # Clean up file if error occurred
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/download/{file_id}")
async def download_file(file_id: str):
    """Download a file by ID"""
    
    # Search for file in all categories
    for category in os.listdir(UPLOAD_DIR):
        category_path = os.path.join(UPLOAD_DIR, category)
        if os.path.isdir(category_path):
            for filename in os.listdir(category_path):
                if filename.startswith(file_id):
                    file_path = os.path.join(category_path, filename)
                    
                    if os.path.exists(file_path):
                        # Determine content type
                        content_type, _ = mimetypes.guess_type(file_path)
                        
                        return FileResponse(
                            path=file_path,
                            media_type=content_type,
                            filename=filename
                        )
    
    raise HTTPException(status_code=404, detail="File not found")


@router.get("/list", response_model=SuccessResponse[list])
async def list_files(
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100, description="Limit number of results")
):
    """List uploaded files"""
    
    files = []
    search_dirs = [category] if category else os.listdir(UPLOAD_DIR)
    
    for cat in search_dirs:
        category_path = os.path.join(UPLOAD_DIR, cat)
        if os.path.isdir(category_path):
            for filename in os.listdir(category_path):
                file_path = os.path.join(category_path, filename)
                if os.path.isfile(file_path):
                    # Extract file ID from filename
                    file_id = filename.split('.')[0]
                    
                    stat = os.stat(file_path)
                    files.append({
                        "file_id": file_id,
                        "filename": filename,
                        "category": cat,
                        "size": stat.st_size,
                        "created_at": stat.st_ctime,
                        "download_url": f"/api/v1/files/download/{file_id}"
                    })
    
    # Sort by creation time (newest first) and limit
    files.sort(key=lambda x: x["created_at"], reverse=True)
    files = files[:limit]
    
    return SuccessResponse(
        data=files,
        message=f"Found {len(files)} files"
    )


@router.delete("/{file_id}", response_model=SuccessResponse[dict])
async def delete_file(file_id: str):
    """Delete a file by ID"""
    
    # Search for file in all categories
    for category in os.listdir(UPLOAD_DIR):
        category_path = os.path.join(UPLOAD_DIR, category)
        if os.path.isdir(category_path):
            for filename in os.listdir(category_path):
                if filename.startswith(file_id):
                    file_path = os.path.join(category_path, filename)
                    
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        
                        return SuccessResponse(
                            data={
                                "file_id": file_id,
                                "filename": filename,
                                "deleted": True
                            },
                            message="File deleted successfully"
                        )
    
    raise HTTPException(status_code=404, detail="File not found")
