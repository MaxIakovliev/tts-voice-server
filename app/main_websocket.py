import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from typing import List
from collections import defaultdict
import os
import wave
import io
from wave import Wave_write
import numpy as np

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

@app.get("/room")
async def get_client(request: Request):
    with open("./static_websocket/room.html", "r") as f:
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
    pre_recorded_file_path = "/home/maks/Documents/my_startups/TTS/my_git/tts-voice-server/audio_files/welcome.wav"
    if os.path.exists(pre_recorded_file_path):
        with open(pre_recorded_file_path, 'rb') as pre_recorded_wf:
            wav_data = pre_recorded_wf.read()
            await websocket.send_bytes(wav_data)
    
    # In-memory wave writer
    audio_buffer = io.BytesIO()
    wf_memory = Wave_write(audio_buffer)
    wf_memory.setnchannels(1)
    wf_memory.setsampwidth(2)
    wf_memory.setframerate(16000)
    wf_memory.writeframes(b'')

    some_minimum_size = 640  # Minimum size of audio data to broadcast
    try:
        while True:
            data = await websocket.receive_bytes()
            if isinstance(data, bytes):
                # Generate 0.5 seconds of silence (0.5 seconds * 16000 samples/second * 2 bytes/sample)
                silence_duration_seconds = 0.5
                sample_rate = 16000
                num_channels = 1
                num_samples = int(silence_duration_seconds * sample_rate)
                silence = np.zeros(num_samples * num_channels, dtype=np.int16).tobytes()
                # Append the silence to the received data
                combined_data = data + silence

                wf.writeframes(data)
                wf_memory.writeframes(data)
                # Check if buffer size is at least some_minimum_size
                if audio_buffer.getbuffer().nbytes >= some_minimum_size:  
                    # Send the data and reset the buffer
                    frame_data = audio_buffer.getvalue()  # Get all data in the buffer
                    await manager.broadcast(frame_data, room_id)
                    audio_buffer.seek(0)
                    audio_buffer.truncate()
                    wf_memory = Wave_write(audio_buffer)
                    wf_memory.setnchannels(1)
                    wf_memory.setsampwidth(2)
                    wf_memory.setframerate(16000)
                    wf_memory.writeframes(b'')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        rooms[room_id].remove(websocket)
    finally:
        wf.close()


@app.post("/create_room/")
async def create_room():
    room_id = str(uuid.uuid4())
    rooms[room_id] = []
    return {"room_id": room_id[:8]}

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