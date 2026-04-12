import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import get_current_user

router = APIRouter(prefix="/api/collab", tags=["collaboration"])

# In-memory room state (production would use Redis)
_rooms: dict[str, dict] = {}
_connections: dict[str, list[WebSocket]] = {}


def _dedupe_participants(participants: list[dict]) -> list[dict]:
    deduped: dict[str, dict] = {}
    for participant in participants:
        user_id = str(participant.get("user_id") or "").strip()
        if not user_id:
            continue
        deduped[user_id] = {
            "user_id": user_id,
            "display_name": participant.get("display_name") or "Unknown",
        }
    return list(deduped.values())


def _prune_room_state(room_id: str) -> None:
    connections = _connections.get(room_id, [])
    if connections:
        _connections[room_id] = connections
        return
    _connections.pop(room_id, None)


async def _broadcast(room_id: str, payload: dict) -> None:
    live_connections: list[WebSocket] = []
    for connection in _connections.get(room_id, []):
        try:
            await connection.send_json(payload)
            live_connections.append(connection)
        except Exception:
            continue
    if live_connections:
        _connections[room_id] = live_connections
    else:
        _connections.pop(room_id, None)


class CreateRoomRequest(BaseModel):
    module_id: str
    name: str
    room_type: str = "study"  # study, quiz, review


class RoomResponse(BaseModel):
    id: str
    name: str
    module_id: str
    room_type: str
    host_id: str
    host_name: str
    participants: list[dict]
    created_at: str


@router.post("/rooms", response_model=RoomResponse)
def create_room(
    body: CreateRoomRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    room_id = str(uuid.uuid4())[:8]
    room = {
        "id": room_id,
        "name": body.name,
        "module_id": body.module_id,
        "room_type": body.room_type,
        "host_id": user.id,
        "host_name": user.display_name,
        "participants": [{"user_id": user.id, "display_name": user.display_name}],
        "created_at": datetime.utcnow().isoformat(),
    }
    _rooms[room_id] = room

    return RoomResponse(**room)


@router.get("/rooms")
def list_rooms():
    return list(_rooms.values())


@router.get("/rooms/{room_id}")
def get_room(room_id: str):
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return _rooms[room_id]


@router.delete("/rooms/{room_id}")
def delete_room(room_id: str, user: User = Depends(get_current_user)):
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    if not user or _rooms[room_id]["host_id"] != user.id:
        raise HTTPException(status_code=403, detail="Only host can delete room")
    del _rooms[room_id]
    if room_id in _connections:
        del _connections[room_id]
    return {"status": "deleted"}


@router.websocket("/rooms/{room_id}/ws")
async def websocket_room(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for real-time study collaboration."""
    if room_id not in _rooms:
        await websocket.close(code=4004, reason="Room not found")
        return

    await websocket.accept()

    if room_id not in _connections:
        _connections[room_id] = []
    _connections[room_id].append(websocket)

    try:
        await websocket.send_json({
            "type": "room_state",
            "data": _rooms[room_id],
        })

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "join":
                user_info = data.get("user", {})
                _rooms[room_id]["participants"] = _dedupe_participants(
                    [*_rooms[room_id]["participants"], user_info]
                )
                await _broadcast(room_id, {
                    "type": "user_joined",
                    "data": user_info,
                    "participants": _rooms[room_id]["participants"],
                })

            elif msg_type == "answer":
                await _broadcast(room_id, {
                    "type": "answer_submitted",
                    "data": data.get("data", {}),
                })

            elif msg_type == "chat":
                await _broadcast(room_id, {
                    "type": "chat_message",
                    "data": data.get("data", {}),
                })

            elif msg_type == "next_question":
                await _broadcast(room_id, {
                    "type": "next_question",
                    "data": data.get("data", {}),
                })

    except WebSocketDisconnect:
        if room_id in _connections:
            _connections[room_id] = [ws for ws in _connections[room_id] if ws != websocket]
            _prune_room_state(room_id)
    except Exception:
        if room_id in _connections:
            _connections[room_id] = [ws for ws in _connections[room_id] if ws != websocket]
            _prune_room_state(room_id)
