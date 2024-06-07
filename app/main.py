from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio

import uvloop
import threading


asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())


app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get_home():
    return FileResponse('./static/home.html')

@app.get("/{room_id}/")
async def enter_room(room_id: str):
    return FileResponse('./static/chatroom.html')

@app.post("/{room_id}/checkpoint/")
async def entry_checkpoint(room_id: str, display_name: str = Form(...), mute_audio: str = Form(...), mute_video: str = Form(...)):
    # Process form data here
    return enter_room(room_id)


from typing import Dict

connections: Dict[str, Dict] = {}  # This will store client details and WebSocket connections

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await websocket.accept()
    if room_id not in connections:
        connections[room_id] = {}
    connections[room_id][client_id] = websocket

    try:
        while True:
            data = await websocket.receive_text()
            for cid, ws in connections[room_id].items():
                if cid != client_id:
                    await ws.send_text(f"{client_id} says: {data}")
    except WebSocketDisconnect:
        connections[room_id].pop(client_id)
        if not connections[room_id]:
            del connections[room_id]
        for ws in connections[room_id].values():
            await ws.send_text(f"{client_id} has left the chat.")
