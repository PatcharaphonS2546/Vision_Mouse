"""
WebSocket endpoints for real-time communication
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from ....core.websocket.manager import manager
from ....models.responses import SuccessResponse
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str = Query(None, description="Client identifier")
):
    """Main WebSocket connection endpoint"""
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                await handle_websocket_message(websocket, message)
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def handle_websocket_message(websocket: WebSocket, message: dict):
    """Handle incoming WebSocket messages"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await manager.send_personal_message({
            "type": "pong",
            "data": message.get("data", {})
        }, websocket)
    
    elif message_type == "subscribe":
        # Handle subscription to specific data types
        subscription_type = message.get("subscription_type")
        await manager.send_personal_message({
            "type": "subscription_confirmed",
            "subscription_type": subscription_type
        }, websocket)
    
    elif message_type == "unsubscribe":
        # Handle unsubscription
        subscription_type = message.get("subscription_type")
        await manager.send_personal_message({
            "type": "subscription_cancelled",
            "subscription_type": subscription_type
        }, websocket)
    
    else:
        await manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }, websocket)


@router.get("/status", response_model=SuccessResponse[dict])
async def get_websocket_status():
    """Get WebSocket connection status"""
    return SuccessResponse(
        data={
            "total_connections": manager.get_connection_count(),
            "connected_clients": manager.get_connected_clients()
        },
        message="WebSocket status retrieved successfully"
    )


@router.post("/broadcast", response_model=SuccessResponse[dict])
async def broadcast_message(message: dict):
    """Broadcast message to all connected clients"""
    await manager.broadcast({
        "type": "broadcast",
        "data": message
    })
    
    return SuccessResponse(
        data={
            "message_sent": True,
            "recipients": manager.get_connection_count()
        },
        message="Message broadcasted successfully"
    )
