from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder, MediaRelay
import asyncio
import json
import uvloop
import threading


asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())


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

    recorder = MediaRecorder(client_id+".wav")

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
        print('-'*50)
        print("Track received from:", client_id)
        if track.kind == "audio":
            # connections[client_id]['peer'].addTrack(track)
            # connection.addTrack(track) # works on localhost for single  intance of browser!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!             
            
            add_track_and_renegotiate(track, client_id)
            
        
    def add_track_and_renegotiate(track, client_id):
        
        # connections[client_id]['peer'].addTrack(track)
        thread = threading.Thread(target=thread_run_async, args=(renegotiate, client_id, track))
        thread.start()
        thread.join()

    def thread_run_async(async_func, *args):
        # Setup a new event loop for the thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        # Run the coroutine until it completes
        loop.run_until_complete(async_func(*args))

        # Close the loop
        loop.close()        

    async def renegotiate(client_id, track):
        print('-'*50)
        print('renegotiate called')
        await asyncio.sleep(1)# remove this line after testing
        # connections[client_id]['peer'].addTrack(track)

        # offer =  await connections[client_id]['peer'].createOffer()
        # print(f"offer: {offer}")
        print(f"connection count: {len(connections)}")

        # await connections[client_id]['peer'].setLocalDescription(offer)
        for id, conn in connections.items():
            # offer =  await connections[id]['peer'].createOffer()
            # await connections[id]['peer'].setLocalDescription(offer)


            # await asyncio.sleep(1)# remove this line after testing
            # # print(f"type: {connections[id]['peer'].localDescription.type}")
            # payload_to_semd = json.dumps(
            #     {"sdp": connections[id]['peer'].localDescription.sdp, 
            #      "type": connections[id]['peer'].localDescription.type})
            
            # print(f"payload_to_semd: {payload_to_semd}")
            
            # await connections[id]['socket'].send_text(payload_to_semd)
            # connections[id]['peer'].addTrack(track)
            recorder.addTrack(track)
            
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
            

            
            if "sdp" in msg_candidate:
                print(f"{fname} sdp received")
                await process_sdp(msg_candidate, connection, recorder)            
            elif msg_candidate["type"] == "candidate":
                print(f"{fname} candidate received")
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
                candidate = RTCIceCandidate(**candidate_dict)
                await connection.addIceCandidate(candidate)

            elif msg_candidate["type"] =="offer":
                print(f"{fname} offer received")
                # for id, conn in connections.items():
                #     offer =  await connections[id]['peer'].createOffer()
                #     await connections[id]['peer'].setLocalDescription(offer)
                #     await connections[id]['socket'].send_text(json.dumps(
                #         {"sdp": connections[id]['peer'].localDescription.sdp, 
                #          "type": connections[id]['peer'].localDescription.type}))
                    
            # elif msg_candidate["type"] in ["offer", "answer"]:
                # sdp = RTCSessionDescription(sdp=msg_candidate["sdp"], type=msg_candidate["type"])
                # await connection.setRemoteDescription(sdp)
                # if msg_candidate["type"] == "offer":
                #     answer = await connection.createAnswer()
                #     await connection.setLocalDescription(answer)
                #     await websocket.send_json({
                #         "type": "answer",
                #         "sdp": connection.localDescription.sdp
                #     })
            else:
                print(fname+" Unknown message")
                print(f"{fname} Message received from {client_id}: {msg_candidate}")

    except WebSocketDisconnect:
        connection.close()
        print(f"{fname} WebSocket connection closed with {client_id}")
        del connections[client_id]
        print(f"{fname} Connection with {client_id} deleted")


# async def create_offer_for_client(client_id):
#     offer = await connections[client_id]['peer'].createOffer()
#     await connections[client_id]['peer'].setLocalDescription(offer)
#     await connections[client_id]['socket'].send_text(json.dumps({
#         "sdp": connections[client_id]['peer'].localDescription.sdp,
#         "type": connections[client_id]['peer'].localDescription.type
#     }))    


async def process_sdp(msg, connection, recorder):
    description = RTCSessionDescription(sdp=msg['sdp'], type=msg['type'])
    await connection.setRemoteDescription(description)
    await recorder.start()
    if msg['type'] == 'offer':
        answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        client_info = next((c for cid, c in connections.items() if c['peer'] == connection), None)
        if client_info:
            await client_info['socket'].send_text(json.dumps({"sdp": connection.localDescription.sdp, "type": "answer"}))


async def add_ice_candidate(msg, connection):
    fname= "add_ice_candidate"
    print(fname+" add_ice_candidate called")
    candidate = RTCIceCandidate(sdpMid=msg['sdpMid'], sdpMLineIndex=msg['sdpMLineIndex'], candidate=msg['candidate'])
    print(fname+" RTCIceCandidate created")
    await connection.addIceCandidate(candidate)
    print(fname+" ICE candidate added")

