"""
Configuration settings for Vision Mouse Backend
"""

import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """Application settings"""
    
    # Server configuration
    HOST: str = "localhost"
    PORT: int = 8000
    DEBUG: bool = True
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:4200",  # Angular dev server
        "http://127.0.0.1:4200",
        "http://localhost:3000",  # Alternative frontend port
    ]
    
    # API configuration
    API_PREFIX: str = "/api"
    API_VERSION: str = "v1"
    
    # WebSocket configuration
    WS_ENDPOINT: str = "/ws"
    
    # Security
    SECRET_KEY: str = "vision-mouse-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Python scripts directory (for future use)
    SCRIPTS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scripts")
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()
