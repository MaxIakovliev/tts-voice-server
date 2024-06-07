import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from typing import List
from collections import defaultdict
import os
import wave
app = FastAPI()

# Mount the directory with static files (HTML, JS) at the root URL
app.mount("/static_websocket", StaticFiles(directory="static_websocket", html=True), name="static_websocket")

# Dictionary to store rooms and their participants
rooms = defaultdict(list)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: bytes, websocket: WebSocket):
        await websocket.send_bytes(message)

    async def broadcast(self, message: bytes, room_id: str):
        for connection in rooms[room_id]:
            await connection.send_bytes(message)

manager = ConnectionManager()


@app.get("/")
async def get_client(request: Request):
    with open("./static_websocket/index.html", "r") as f:
        return HTMLResponse(f.read())


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket)
    rooms[room_id].append(websocket)
    file_name = f"{room_id}_{uuid.uuid4()}.wav"
    file_path = os.path.join("audio_files", file_name)
    os.makedirs("audio_files", exist_ok=True)
    wf = wave.open(file_path, 'wb')
    wf.setnchannels(1)
    wf.setsampwidth(2)  # 16-bit audio
    wf.setframerate(16000)  # 16kHz sampling rate

    # Read a pre-recorded WAV file and send its audio data to the client
    # pre_recorded_file_path = "/home/maks/Documents/my_startups/TTS/my_git/tts-voice-server/audio_files/welcome.wav"
    # if os.path.exists(pre_recorded_file_path):
    #     with wave.open(pre_recorded_file_path, 'rb') as pre_recorded_wf:
    #         while True:
    #             frames = pre_recorded_wf.readframes(1024)
    #             if not frames:
    #                 break
    #             await websocket.send_bytes(frames)


    try:
        while True:
            data = await websocket.receive_bytes()
            if isinstance(data, bytes):
                wf.writeframes(data)
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        rooms[room_id].remove(websocket)
    finally:
        wf.close()


@app.post("/create_room/")
async def create_room():
    room_id = str(uuid.uuid4())
    rooms[room_id] = []
    return {"room_id": room_id}

@app.get("/create_room/")
async def create_room_get():
    room_id = str(uuid.uuid4())
    rooms[room_id] = []
    return {"room_id": room_id}


@app.post("/connect_room/{room_id}")
async def connect_room(room_id: str):
    if room_id in rooms:
        return {"room_id": room_id, "message": "Room exists. You can connect."}
    else:
        return {"message": "Room not found."}



#how to run this code
#
# uvicorn app.main_websocket:app --host 127.0.0.1 --port 8000 --reload