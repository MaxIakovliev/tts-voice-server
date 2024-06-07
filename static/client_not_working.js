let pc;
let ws;


function generateUniqueId() {
    // Simple unique ID using a timestamp and random number
    return 'client' + Date.now() + Math.floor(Math.random() * 1000);
}


async function startCall() {
    const selectedMic = document.getElementById('microphoneList').value;
    const constraints = {
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined }
    };

    // Initialize the RTCPeerConnection
    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pc.getStats().then(stats => console.log(stats));


    //********************************************** */

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const canvas = document.getElementById('audioMeter');
    const canvasContext = canvas.getContext('2d');

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    draw();

    function draw() {
        requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasContext.fillStyle = 'rgb(0, 0, 0)';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);

        var barWidth = (canvas.width / bufferLength) * 2.5;
        var barHeight;
        var x = 0;

        for(var i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];

            canvasContext.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
            canvasContext.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }
    }

    //********************************************** */


    // Get media from the user's microphone
    try {
        // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // stream.getTracks().forEach(track => pc.addTrack(track, stream));
        // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
            track.onmute = () => updateAudioIndicator(false);
            track.onunmute = () => updateAudioIndicator(true);

            console.log("Added track to the peer connection");
        });
    } catch (error) {
        console.error('Error accessing the microphone:', error);
        return;
    }

    // Set up WebSocket connection for signaling
    // ws = new WebSocket('wss://192.168.20.15:8081/ws/client123');  // Adjust URL/port as necessary
    // ws = new WebSocket('ws://localhost:8081/ws/client123');  // Adjust URL/port as necessary

    const clientId = generateUniqueId();
    const wsUrl = `wss://192.168.20.15:8081/ws/${clientId}`;
    console.log("Generated Client ID:", clientId);
    ws = new WebSocket(wsUrl);  // Adjust URL/port as necessary

    // Wait for the WebSocket connection to open before continuing
    ws.onopen = async () => {
        // WebSocket is now open
        console.log("WebSocket connection established");

        // Create an offer and set local description
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Now it's safe to send messages
        ws.send(JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type }));
    };

    // ws.onmessage = async (event) => {
    //     const data = JSON.parse(event.data);
    //     if (data.sdp) {
    //         const description = new RTCSessionDescription(data);
    //         console.log(`Received ${description.type}, setting remote description...`);
    
    //         try {
    //             await pc.setRemoteDescription(description);  // Wait for this to complete before creating answer
    //             if (description.type === 'offer') {
    //                 const answer = await pc.createAnswer();
    //                 console.log('Creating answer...');
    //                 await pc.setLocalDescription(answer);
    //                 ws.send(JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type }));
    //             }
    //         } catch (error) {
    //             console.error('Failed to set remote description:', error);
    //         }
    //     } else if (data.candidate) {
    //         try {
    //             console.log('Adding ice candidate...');
    //             await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    //         } catch (e) {
    //             console.error('Error adding received ice candidate:', e);
    //         }
    //     }
    // };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);
    
        if (data.sdp) {
            const description = new RTCSessionDescription(data);
            console.log(`Received ${description.type}, setting remote description...`);
    
            try {
                // Check the current signaling state before setting the remote description
                if ((description.type === 'offer' && pc.signalingState === 'stable') ||
                    (description.type === 'answer' && pc.signalingState === 'have-local-offer')) {
                    await pc.setRemoteDescription(description);
                    console.log('Remote description set successfully');
    
                    if (description.type === 'offer') {
                        console.log('Received offer, creating answer...');
                        const answer = await pc.createAnswer();
                        console.log(`Setting local description with answer`);
                        await pc.setLocalDescription(answer);
                        console.log('Local description set successfully');
                        ws.send(JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type }));
                        console.log('Answer sent');
                    }
                } else {
                    console.log(`Unexpected SDP type or signaling state. Type: ${description.type}, State: ${pc.signalingState}`);
                }
            } catch (error) {
                console.error('Failed to set remote description:', error);
            }
        } else if (data.candidate) {
            try {
                console.log('Adding ice candidate...');
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('Ice candidate added successfully');
            } catch (e) {
                console.error('Error adding received ice candidate:', e);
            }
        }
    };
    
    

    pc.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                candidate: {
                    type: 'candidate',
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                }
            }));
        }
    };
    

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE state: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') {
            console.error('ICE Connection Failed');
        }
    };

    // pc.ontrack = (event) => {
    //     console.log('Track received:', event.streams[0]);
    //     let audio = new Audio();
    //     audio.srcObject = event.streams[0];
    //     audio.onloadedmetadata = () => {
    //         audio.play().then(() => console.log("Audio is playing")).catch(e => console.error("Error playing the audio", e));
    //     };
    // };
    pc.ontrack = (event) => {
        console.log('Track received:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            if (track.kind === 'audio') {
                let audio = new Audio();
                audio.srcObject = new MediaStream([track]);
                audio.onloadedmetadata = () => {
                    audio.play().then(() => console.log("Audio is playing")).catch(e => console.error("Error playing the audio", e));
                };
            }
        });
    };
    
}

// Ensure this file is loaded before you try to call startCall from your HTML.

async function getMicrophones() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const micList = document.getElementById('microphoneList'); // Make sure you have a select element with this id in your HTML

    audioInputs.forEach((mic, index) => {
        const option = document.createElement('option');
        option.value = mic.deviceId;
        option.text = mic.label || `Microphone ${index + 1}`;
        micList.appendChild(option);
    });
}

function updateAudioIndicator(isActive) {
    const indicator = document.getElementById('audioIndicator');
    indicator.style.backgroundColor = isActive ? 'green' : 'red';
}

window.onload = getMicrophones;