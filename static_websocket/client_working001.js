document.getElementById('createRoom').addEventListener('click', createRoom);
document.getElementById('joinRoom').addEventListener('click', joinRoom);

let websocket;
let mediaStream;
let audioContext;
let context;
let source;
let processor;
let roomId = '';
let mediaRecorder;
let audioChunks = [];
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
    websocket = new WebSocket(`ws://${window.location.host}/ws/${roomId}`);
    
    websocket.onopen = async () => {
        document.getElementById('status').innerText += `\nWebSocket connection established.`;
        console.log('Starting audio capture...');
        await startAudioCapture();
    };

    websocket.onmessage = (event) => {
        if (typeof event.data === 'object') {
            playAudio(event.data);
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
            sampleRate: 16000,//16000,  // Ensure 48kHz sample rate
            sampleSize: 16,     // Ensure 16-bit audio
            channelCount: 1,     // Mono audio
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
        processor.onaudioprocess = e => processAudio(e);
        input.connect(processor);
        processor.connect(context.destination);
        const analyser = context.createAnalyser();
        const canvas = document.getElementById('audioMeter');
        const canvasContext = canvas.getContext('2d');

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

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

        //sendAudioConfig();
    }).catch(error => console.error('Error accessing microphone', error));
        // source = audioContext.createMediaStreamSource(mediaStream);
        // const context = new AudioContext();
        // processor = context.createScriptProcessor(4096, 1, 1);
        // processor.onaudioprocess = e => processAudio(e);
        // const analyser = audioContext.createAnalyser();
        // const canvas = document.getElementById('audioMeter');
        // const canvasContext = canvas.getContext('2d');

        // analyser.fftSize = 256;
        // const bufferLength = analyser.frequencyBinCount;
        // const dataArray = new Uint8Array(bufferLength);

        // source.connect(analyser);
        // draw();

        // function draw() {
        //     requestAnimationFrame(draw);

        //     analyser.getByteFrequencyData(dataArray);

        //     canvasContext.fillStyle = 'rgb(0, 0, 0)';
        //     canvasContext.fillRect(0, 0, canvas.width, canvas.height);

        //     var barWidth = (canvas.width / bufferLength) * 2.5;
        //     var barHeight;
        //     var x = 0;

        //     for (var i = 0; i < bufferLength; i++) {
        //         barHeight = dataArray[i];

        //         canvasContext.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
        //         canvasContext.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

        //         x += barWidth + 1;
        //     }
        // }

        // mediaRecorder = new MediaRecorder(mediaStream, {
        //     mimeType: 'audio/webm'
        // });
        // mediaRecorder.ondataavailable = (event) => {
        //     if (event.data.size > 0) {
        //         audioChunks.push(event.data);

        //         // const outputSampleRate = 16000; // Target sample rate
        //         // const inputSampleRate = audioContext.sampleRate;
        //         //const downsampledBuffer = downsampleBuffer(event.data, inputSampleRate, outputSampleRate);
        //         //const audioData = convertFloat32ToInt16(downsampledBuffer);
            
        //         if (websocket.readyState === WebSocket.OPEN) {
        //             websocket.send(audioData);//event.data);
        //         }
        //     }
        // };
        // mediaRecorder.start(100); // Collect 100ms chunks of audio
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
        const inputSampleRate = context.sampleRate;
        const outputSampleRate = 16000; // Target sample rate
    
        const left = e.inputBuffer.getChannelData(0);
        const downsampledBuffer = downsampleBuffer(left, inputSampleRate, outputSampleRate);
        const audioData = convertFloat32ToInt16(downsampledBuffer);
        
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(audioData);
        }
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

function playAudio(data) {
    const audioBlob = new Blob([data], { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onloadedmetadata = () => {
        audio.play().then(() => console.log("Audio is playing")).catch(e => console.error("Error playing the audio", e));
    };
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

window.onload = getMicrophones;
