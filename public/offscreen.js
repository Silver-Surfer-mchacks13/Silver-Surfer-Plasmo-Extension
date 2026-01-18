console.log("Offscreen: script loaded")

let mediaRecorder = null
let audioChunks = []
let currentStream = null

const SILENCE_THRESHOLD = 0.08
const SILENCE_DURATION_MS = 1400

let audioContext = null
let analyser = null
let analyserData = null
let silenceCheckId = null
let silenceStartTime = null
let autoStopRequested = false

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Offscreen: received message", message.type)

  if (message.type === "offscreen-ping") {
    sendResponse({ ready: true })
    return true
  }

  if (message.type === "offscreen-start-recording") {
    startRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Offscreen: start error", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "offscreen-stop-recording") {
    stopRecording()
      .then((audioData) => sendResponse({ audioData }))
      .catch((error) => {
        console.error("Offscreen: stop error", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  return false
})

async function startRecording() {
  if (mediaRecorder?.state === "recording") {
    console.warn("Offscreen: already recording")
    return
  }

  console.log("Offscreen: requesting microphone")
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  console.log("Offscreen: microphone granted")

  currentStream = stream
  audioChunks = []
  mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
  autoStopRequested = false
  startSilenceDetection(stream)

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data)
    }
  }

  mediaRecorder.start()
  console.log("Offscreen: recorder started")
}

async function stopRecording() {
  if (!mediaRecorder) {
    throw new Error("Recorder not initialized")
  }

  if (mediaRecorder.state !== "recording") {
    console.warn("Offscreen: recorder state", mediaRecorder.state)
  }

  stopSilenceDetection()

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      try {
        console.log("Offscreen: recorder stopped, processing")
        const blob = new Blob(audioChunks, { type: "audio/webm" })
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result
          chrome.runtime.sendMessage({ type: "audio-data", audioData: result })
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      } catch (error) {
        reject(error)
      } finally {
        cleanupStream()
      }
    }

    mediaRecorder.stop()
  })
}

function cleanupStream() {
  mediaRecorder = null
  audioChunks = []
  stopSilenceDetection()
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop())
    currentStream = null
  }
}

function startSilenceDetection(stream) {
  stopSilenceDetection()
  try {
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    analyserData = new Uint8Array(analyser.fftSize)
    source.connect(analyser)
    silenceStartTime = null
    silenceCheckId = requestAnimationFrame(checkSilence)
  } catch (error) {
    console.error("Offscreen: failed to start silence detection", error)
  }
}

function stopSilenceDetection() {
  if (silenceCheckId) {
    cancelAnimationFrame(silenceCheckId)
    silenceCheckId = null
  }
  silenceStartTime = null
  analyserData = null
  analyser = null
  if (audioContext) {
    audioContext.close().catch((err) => console.warn("Offscreen: audio context close error", err))
    audioContext = null
  }
}

function checkSilence(timestamp) {
  if (!analyser || !analyserData || autoStopRequested) {
    return
  }

  analyser.getByteTimeDomainData(analyserData)
  let sumSquares = 0
  for (let i = 0; i < analyserData.length; i++) {
    const sample = (analyserData[i] - 128) / 128
    sumSquares += sample * sample
  }
  const rms = Math.sqrt(sumSquares / analyserData.length)
  const isSilent = rms < SILENCE_THRESHOLD

  if (isSilent) {
    if (!silenceStartTime) {
      silenceStartTime = timestamp || performance.now()
    }
    const elapsed = (timestamp || performance.now()) - silenceStartTime
    if (elapsed >= SILENCE_DURATION_MS) {
      autoStopRequested = true
      console.log("Offscreen: silence detected, requesting stop", { rms, elapsed })
      stopSilenceDetection()
      chrome.runtime.sendMessage({ type: "auto-stop-recording-request" })
      return
    }
  } else {
    silenceStartTime = null
  }

  silenceCheckId = requestAnimationFrame(checkSilence)
}
