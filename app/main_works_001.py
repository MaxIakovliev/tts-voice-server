from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate


app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# Placeholder for peer connections
connections = {}

@app.get("/")
async def get_client(request: Request):
    with open("./static/client.html", "r") as f:
        return HTMLResponse(f.read())

@app.get("/admin")
async def get_admin(request: Request):
    with open("./static/admin.html", "r") as f:
        return HTMLResponse(f.read())







@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    print(f"WebSocket connection established with {client_id}")
    connection = RTCPeerConnection()
    connections[client_id] = connection

    @connection.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        print(f"ICE Connection State has changed to {connection.iceConnectionState} for {client_id}")


    @connection.on("icecandidate")
    async def on_icecandidate(event):
        candidate = event.candidate
        if candidate:
            print(f"New ICE candidate: {candidate}")
            await websocket.send_json({
                "candidate": {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex
                }
            })

    @connection.on("track")
    def on_track(track):
        print("Track received from:", client_id)
        if track.kind == "audio":
            connection.addTrack(track) # works on localhost for single  intance of browser!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 
    
    # @connection.on("track")
    # async def on_track(track):
    #     print("Track received from:", client_id)
    #     if track.kind == "audio":
    #         print('-'*50)
    #         print(f"connection:{connection}")
    #         print('-'*50)

    #         # Inform other clients to renegotiate to receive new track
    #         for other_id, other_connection in connections.items():
    #             if other_id != client_id:
    #                 print(f"Requesting {other_id} to renegotiate for new tracks from {client_id}")
    #                 # This should trigger some form of renegotiation process in the clients
    #                 await other_connection.createOffer()
        




    try:
        while True:
            data = await websocket.receive_json()
            print(f"Processed SDP and ICE data for {client_id}")
            print(f"Received data from {client_id}: {data}")
            if "sdp" in data and "type" in data:
                sdp = RTCSessionDescription(sdp=data["sdp"], type=data["type"])
                await connection.setRemoteDescription(sdp)
                print(f"Remote description set for {client_id}")
                if data["type"] == "offer":
                    answer = await connection.createAnswer()
                    await connection.setLocalDescription(answer)
                    await websocket.send_json({"sdp": connection.localDescription.sdp, "type": connection.localDescription.type})
                    print(f"Answer sent to {client_id}")
            elif "candidate" in data:
                candidate_info = data["candidate"]
                print(f"data:{data}")
                try:
                            # Splitting the candidate string to parse it
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
                    print(f"ICE candidate added for {client_id}")
                    
                    # # Optional fields such as 'generation', 'ufrag', 'network-id', 'network-cost'
                    # if len(parts) > 8:
                    #     for i in range(8, len(parts), 2):
                    #         if parts[i] == "generation":
                    #             candidate_dict["generation"] = int(parts[i+1])
                    #         elif parts[i] == "ufrag":
                    #             candidate_dict["ufrag"] = parts[i+1]
                    #         # Add other fields as needed

                    ice_candidate = RTCIceCandidate(**candidate_dict)
                    await connection.addIceCandidate(ice_candidate)
                except Exception as e:
                    print(f"Failed to parse or add ICE candidate: {e}")
                

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for {client_id}")
        await connection.close()
        del connections[client_id]
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await connection.close()
        if client_id in connections:
            del connections[client_id]
            print(f"WebSocket connection closed for {client_id}")






# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
