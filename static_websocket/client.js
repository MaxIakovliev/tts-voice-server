document.getElementById('createRoom').addEventListener('click', createRoom);
document.getElementById('joinRoom').addEventListener('click', joinRoom);
document.getElementById('endCall').addEventListener('click', endCall);
document.getElementById('muteUnmute').addEventListener('click', muteUnmuteMicrophone);


let websocket;
let mediaStream;
let audioContext;
let context;
let source;
let processor;
let analyser;
let roomId = '';
// let mediaRecorder;
// let audioChunks = [];

let silenceThreshold = 0.005; // Adjust this value based on your needs
let silenceTimeout = 1000; // Time in ms to wait before considering it as silence
let silenceTimer = null;
let isSendingAudio = true;
let isMuted = false;
const bufferSize = 4096;

async function createRoom() {
    const response = await fetch('/create_room/', { method: 'POST' });
    if (response.ok) {
        const data = await response.json();
        roomId = data.room_id;
        document.getElementById('status').innerText = `Room created with ID: ${roomId}`;
        setupWebSocket(roomId);
    } else {
        document.getElementById('status').innerText = `Failed to create room: ${response.statusText}`;
    }
}

async function joinRoom() {
    roomId = document.getElementById('roomId').value;
    const response = await fetch(`/connect_room/${roomId}`, { method: 'POST' });
    if (response.ok) {
        const data = await response.json();
        if (data.room_id) {
            document.getElementById('status').innerText = `Joined room with ID: ${roomId}`;
            setupWebSocket(roomId);
        } else {
            document.getElementById('status').innerText = `Room not found.`;
        }
    } else {
        document.getElementById('status').innerText = `Failed to join room: ${response.statusText}`;
    }
}

function setupWebSocket(roomId) {
    //note: wss is required for secure connection
    // websocket = new WebSocket(`wss://${window.location.host}/ws/${roomId}`);

    //for regular http connection
    websocket = new WebSocket(`ws://${window.location.host}/ws/${roomId}`);

    websocket.onopen = async () => {
        document.getElementById('status').innerText += `\nWebSocket connection established.`;
        console.log('Starting audio capture...');
        await startAudioCapture();
    };

    websocket.onmessage = (event) => {
        console.log('Received audio data:', event.data);
        if (event.data instanceof Blob) {
            console.log('Received Blob:', event.data.size, 'bytes');
            playAudio(event.data);
        } else {
            console.error('Received data is not a Blob:', typeof event.data);
        }
    };

    websocket.onclose = () => {
        document.getElementById('status').innerText += `\nWebSocket connection closed.`;
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('status').innerText += `\nWebSocket error: ${error.message}`;
    };
}

async function startAudioCapture() {
    const selectedMic = document.getElementById('microphoneList').value;
    const constraints = {
        audio: {
            deviceId: selectedMic ? { exact: selectedMic } : undefined,
            sampleRate: 16000, // Ensure 16kHz sample rate
            sampleSize: 16,    // Ensure 16-bit audio
            channelCount: 1,   // Mono audio
            audio: true
        }
    };

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        context = new AudioContext();

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            globalStream = stream;
            const input = context.createMediaStreamSource(stream);
            
            processor = context.createScriptProcessor(bufferSize, 1, 1);
            analyser = context.createAnalyser();
            analyser.fftSize = 256;
            input.connect(analyser);
            analyser.connect(processor);
            processor.connect(context.destination);
            

            processor.onaudioprocess = e => processAudio(e);
            // input.connect(processor);
            // processor.connect(context.destination);
            // const analyser = context.createAnalyser();
            const canvas = document.getElementById('audioMeter');
            const canvasContext = canvas.getContext('2d');

            // analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // input.connect(analyser);
            draw();

            function draw() {
                requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                canvasContext.fillStyle = 'rgb(0, 0, 0)';
                canvasContext.fillRect(0, 0, canvas.width, canvas.height);

                var barWidth = (canvas.width / bufferLength) * 2.5;
                var barHeight;
                var x = 0;

                for (var i = 0; i < bufferLength; i++) {
                    barHeight = dataArray[i];

                    canvasContext.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
                    canvasContext.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

                    x += barWidth + 1;
                }
            }
        }).catch(error => console.error('Error accessing microphone', error));

    } catch (err) {
        console.error('Error capturing audio:', err);
        document.getElementById('status').innerText += `\nError capturing audio: ${err.message}`;
    }

    function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
        if (inputSampleRate === outputSampleRate) {
            return buffer;
        }
        var sampleRateRatio = inputSampleRate / outputSampleRate;
        var newLength = Math.round(buffer.length / sampleRateRatio);
        var result = new Float32Array(newLength);
        var offsetResult = 0;
        var offsetBuffer = 0;
        while (offsetResult < result.length) {
            var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            var accum = 0, count = 0;
            for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }


    function processAudio(e) {
        if (isMuted) return;

        const inputSampleRate = context.sampleRate;
        const outputSampleRate = 16000; // Target sample rate

        const left = e.inputBuffer.getChannelData(0);
        const downsampledBuffer = downsampleBuffer(left, inputSampleRate, outputSampleRate);
        const audioData = convertFloat32ToInt16(downsampledBuffer);

        // Voice Activity Detection
        const isSilent = detectSilence(downsampledBuffer);

        if (isSilent && isSendingAudio) {
            console.log('Silence detected, stopping audio transmission.');
            isSendingAudio = false;
        } else if (!isSilent && !isSendingAudio) {
            console.log('Voice detected, resuming audio transmission.');
            isSendingAudio = true;
        }

        if (websocket && websocket.readyState === WebSocket.OPEN && isSendingAudio) {
            websocket.send(audioData);
        }
    }

    function detectSilence(buffer) {
        const sum = buffer.reduce((acc, val) => acc + Math.abs(val), 0);
        const average = sum / buffer.length;
        return average < silenceThreshold;
    }

    function convertFloat32ToInt16(buffer) {
        let l = buffer.length;
        const buf = new Int16Array(l);
        while (l--) {
            buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
        }
        return buf.buffer;
    }


}

// function playAudio(blob) {
//     console.log('Playing audio...', blob);
//     if (!audioContext) {
//         audioContext = new (window.AudioContext || window.webkitAudioContext)();
//     }
//     const reader = new FileReader();
//     reader.onload = function (event) {
//         const arrayBuffer = event.target.result;
//         audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
//             const source = audioContext.createBufferSource();
//             source.buffer = audioBuffer;
//             source.connect(audioContext.destination);
//             source.start(0);
//         }, (e) => {
//             console.error('Error decoding audio data', e);
//         });
//     };
//     reader.onerror = (err) => {
//         console.error('FileReader error:', err);
//     };
//     reader.readAsArrayBuffer(blob);
// }


async function playAudio(blob) {
    console.log('Playing audio...', blob);
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const reader = new FileReader();
    reader.onload = function (event) {
        const arrayBuffer = event.target.result;
        audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
        }, (e) => {
            console.error('Error decoding audio data', e);
        });
    };
    reader.onerror = (err) => {
        console.error('FileReader error:', err);
    };
    reader.readAsArrayBuffer(blob);
}

async function getMicrophones() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const micList = document.getElementById('microphoneList');

    audioInputs.forEach((mic, index) => {
        const option = document.createElement('option');
        option.value = mic.deviceId;
        option.text = mic.label || `Microphone ${index + 1}`;
        micList.appendChild(option);
    });
}

    function endCall() {
        if (websocket) {
            websocket.close();
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        if (processor) {
            processor.disconnect();
        }
        if (analyser) {
            analyser.disconnect();
        }
        if (audioContext) {
            audioContext.close();
        }
        document.getElementById('status').innerText += `\nCall ended.`;
        console.log('Call ended.');
    }
    async function loadRooms() {
        const response = await fetch('/get-rooms');
        if (response.ok) {
            const data = await response.json();
            console.log('Rooms:', data);
            if (data.length === 0) {
                return; // Do nothing if data contains no elements
            }
            const roomList = document.getElementById('roomList');
            roomList.innerHTML = ''; // Clear the existing list
            data.forEach(room => {
                const option = document.createElement('option');
                option.value = room;
                option.text = room;
                roomList.appendChild(option);
            });
        } else {
            console.error('Failed to load rooms:', response.statusText);
        }
    }
    function muteUnmuteMicrophone() {
        isMuted = !isMuted;
        const muteUnmuteButton = document.getElementById('muteUnmute');
        muteUnmuteButton.innerText = isMuted ? 'Unmute' : 'Mute';
        console.log(isMuted ? 'Microphone muted.' : 'Microphone unmuted.');
    }

    loadRooms();

window.onload = getMicrophones;
