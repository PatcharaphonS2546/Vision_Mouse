"""
WebSocket Connection Manager for Vision Mouse Backend
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.client_data: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str = None):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Store client metadata
        self.client_data[websocket] = {
            "client_id": client_id or f"client_{len(self.active_connections)}",
            "connected_at": datetime.now(),
            "last_activity": datetime.now()
        }
        
        logger.info(f"WebSocket connected: {self.client_data[websocket]['client_id']}")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection",
            "status": "connected",
            "client_id": self.client_data[websocket]["client_id"],
            "timestamp": datetime.now().isoformat()
        }, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            client_info = self.client_data.get(websocket, {})
            self.active_connections.remove(websocket)
            if websocket in self.client_data:
                del self.client_data[websocket]
            
            logger.info(f"WebSocket disconnected: {client_info.get('client_id', 'unknown')}")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send message to specific client"""
        try:
            await websocket.send_text(json.dumps(message))
            
            # Update last activity
            if websocket in self.client_data:
                self.client_data[websocket]["last_activity"] = datetime.now()
                
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return
        
        message["timestamp"] = datetime.now().isoformat()
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
                
                # Update last activity
                if connection in self.client_data:
                    self.client_data[connection]["last_activity"] = datetime.now()
                    
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            self.disconnect(conn)
    
    async def send_tracking_data(self, tracking_data: Dict[str, Any]):
        """Send real-time tracking data"""
        message = {
            "type": "tracking_data",
            "data": tracking_data
        }
        await self.broadcast(message)
    
    async def send_calibration_update(self, calibration_data: Dict[str, Any]):
        """Send calibration progress update"""
        message = {
            "type": "calibration_update",
            "data": calibration_data
        }
        await self.broadcast(message)
    
    async def send_system_status(self, status_data: Dict[str, Any]):
        """Send system status update"""
        message = {
            "type": "system_status",
            "data": status_data
        }
        await self.broadcast(message)
    
    def get_connected_clients(self) -> List[Dict[str, Any]]:
        """Get list of connected clients"""
        return [
            {
                "client_id": data["client_id"],
                "connected_at": data["connected_at"].isoformat(),
                "last_activity": data["last_activity"].isoformat()
            }
            for data in self.client_data.values()
        ]
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)


# Global connection manager instance
manager = ConnectionManager()
