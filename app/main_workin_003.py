from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStreamTrack
import asyncio
import json

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

connections = {}

@app.get("/")
async def get_client(request: Request):
    with open("./static/client.html", "r") as f:
        return HTMLResponse(f.read())

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    fname= "websocket_endpoint"
    print(fname+" websocket_endpoint started")
    await websocket.accept()
    print(f"{fname} WebSocket connection established with {client_id}")
    connection = RTCPeerConnection()
    print(fname+" RTCPeerConnection created")
    connections[client_id] = {'peer': connection, 'socket': websocket}
    print(fname+ " Connection added to connections")

    @connection.on("icecandidate")
    async def on_icecandidate(event):
        fname= "on_icecandidate"
        print(fname+ " on_icecandidate called")
        candidate = event.candidate
        if candidate:
            print(f"{fname} New ICE candidate: {candidate}")
            await websocket.send_json({
                "candidate": {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex
                }
            })
            print(fname+" ICE candidate sent")
        else:
            print(fname+" ICE candidate is None")

    
    @connection.on("track")
    def on_track(track):
        print("Track received from:", client_id)
        if track.kind == "audio":
            # connections[client_id]['peer'].addTrack(track)
            # connection.addTrack(track) # works on localhost for single  intance of browser!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 
            # distribute_track(track, client_id)
            # asyncio.create_task(distribute_track(track, client_id))
            distribute_track(track, client_id)

    try:
        while True:
            data = await websocket.receive_text()
            print(f"{fname} Data received from {client_id}: {data}")
            msg = json.loads(data)            
            print(f"{fname} Message received from {client_id}: {msg}")
            if "candidate" in msg:
                msg_candidate = msg["candidate"]
            else:
                msg_candidate = msg
            if msg_candidate["type"] == "candidate":
                candidate_info = msg["candidate"]
                parts = candidate_info["candidate"].split()
                    # Constructing the dictionary for RTCIceCandidate
                candidate_dict = {
                        "foundation": parts[0].split(':')[1],
                        "component": int(parts[1]),
                        "protocol": parts[2],
                        "priority": int(parts[3]),
                        "ip": parts[4],
                        "port": int(parts[5]),
                        "type": parts[7],  # 'typ' is at index 6 and type is at 7
                        "sdpMid": candidate_info["sdpMid"],
                        "sdpMLineIndex": int(candidate_info["sdpMLineIndex"])
                    }
                candidate = RTCIceCandidate(
                    **candidate_dict                )
                await connection.addIceCandidate(candidate)
            elif msg_candidate["type"] in ["offer", "answer"]:
                sdp = RTCSessionDescription(sdp=msg["sdp"], type=msg["type"])
                await connection.setRemoteDescription(sdp)
                if msg_candidate["type"] == "offer":
                    answer = await connection.createAnswer()
                    await connection.setLocalDescription(answer)
                    await websocket.send_json({
                        "type": "answer",
                        "sdp": connection.localDescription.sdp
                    })
            else:
                print(fname+" Unknown message")

    except WebSocketDisconnect:
        connection.close()
        print(f"{fname} WebSocket connection closed with {client_id}")
        del connections[client_id]
        print(f"{fname} Connection with {client_id} deleted")

def distribute_track(track, origin_id):
    print ("distribute_track called")
    print(len(connections))
    for client_id, conn in connections.items():
        # if client_id != origin_id:
            # connections[client_id]['peer'].addTrack(track)
            connections[client_id]['peer'].addTrack(track)

            # await create_offer_for_client(conn)
            asyncio.create_task(create_offer_for_client(conn))



# def distribute_track(track, origin_id):
#     print ("distribute_track called")
#     print(len(connections))
#     for client_id, conn in connections.items():
#         # if client_id != origin_id:
#             # peer_connection = conn['peer']
#             # peer_connection.addTrack(track)
#             connections[client_id]['peer'].addTrack(track)
#             # await create_offer_for_client(conn)
#             asyncio.create_task(create_offer_for_client(conn))

# async def create_offer_for_client(conn):
#     offer = await conn['peer'].createOffer()
#     await conn['peer'].setLocalDescription(offer)
#     await conn['socket'].send_text(json.dumps({
#         "sdp": conn['peer'].localDescription.sdp,
#         "type": conn['peer'].localDescription.type
#     }))

async def create_offer_for_client(client_id):
    offer = await connections[client_id]['peer'].createOffer()
    await connections[client_id]['peer'].setLocalDescription(offer)
    await connections[client_id]['socket'].send_text(json.dumps({
        "sdp": connections[client_id]['peer'].localDescription.sdp,
        "type": connections[client_id]['peer'].localDescription.type
    }))    


async def process_sdp(msg, connection, client_id):
    fname= "process_sdp"
    print(fname+" process_sdp called")
    description = RTCSessionDescription(sdp=msg['sdp'], type=msg['type'])
    print(fname+" RTCSessionDescription created")
    await connection.setRemoteDescription(description)
    print(fname+" Remote description set")
    if msg['type'] == 'offer':
        print(fname+" Offer in message")
        answer = await connection.createAnswer()
        print(fname+" Answer created")
        await connection.setLocalDescription(answer)
        print(fname+" Local description set")
        await connections[client_id]['socket'].send_text(json.dumps({"sdp": connection.localDescription.sdp, "type": connection.localDescription.type}))
        print(fname+" Answer sent")

async def add_ice_candidate(msg, connection):
    fname= "add_ice_candidate"
    print(fname+" add_ice_candidate called")
    candidate = RTCIceCandidate(sdpMid=msg['sdpMid'], sdpMLineIndex=msg['sdpMLineIndex'], candidate=msg['candidate'])
    print(fname+" RTCIceCandidate created")
    await connection.addIceCandidate(candidate)
    print(fname+" ICE candidate added")

