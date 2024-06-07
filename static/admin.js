let pc;
let ws;

async function joinCall() {
    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    ws = new WebSocket('ws://localhost:8081/ws/admin');
    ws.onopen = () => console.log("Connected to the server as admin.");
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received data:', data);
        if (data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            if (data.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type }));
                console.log("Answer sent from admin.");
            }
        } else if (data.candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Error adding received ice candidate:', e);
            }
        }
    };

    pc.ontrack = (event) => {
        console.log('Track received:', event.track.kind);
        // var audio = document.createElement("audio");
        // audio.autoplay = true;  // Ensure the audio plays automatically
        // audio.controls = true;  // Add controls to pause/play the audio manually
        // document.body.appendChild(audio);  // Add the audio element to the body to ensure it's in the DOM

        if (event.track.kind === "audio") {
            // audio.srcObject = new MediaStream([event.track]);
            // console.log("Playing incoming audio.");
            let audio = new Audio();
            audio.srcObject = new MediaStream([event.track]);
            audio.controls = true;
            audio.autoplay = true;
            document.body.appendChild(audio);
            audio.onplay = () => console.log("Audio is playing.");
            audio.onerror = (e) => console.error("Error playing audio", e);
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE state: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') {
            console.error('ICE Connection Failed');
        }
    };
}

// Call joinCall when the page is fully loaded or when a button is clicked
document.addEventListener('DOMContentLoaded', joinCall);