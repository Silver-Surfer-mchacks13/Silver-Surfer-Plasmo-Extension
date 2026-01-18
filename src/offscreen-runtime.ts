let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let currentStream: MediaStream | null = null

const SILENCE_THRESHOLD = 0.08
const SILENCE_DURATION_MS = 1400

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let analyserData: Uint8Array | null = null
let silenceCheckId: number | null = null
let silenceStartTime: number | null = null
let autoStopRequested = false
let autoStopEnabled = true
let currentRecordingId: string | null = null
let initialized = false

function log(...args: unknown[]) {
  console.log("Offscreen:", ...args)
}

function cleanupStream() {
  mediaRecorder = null
  audioChunks = []
  stopSilenceDetection()
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop())
    currentStream = null
  }
  currentRecordingId = null
}

async function startRecording(autoStop = true, recordingId?: string) {
  if (mediaRecorder?.state === "recording") {
    console.warn("Offscreen: already recording")
    return
  }

  autoStopEnabled = autoStop
  currentRecordingId = typeof recordingId === "string" ? recordingId : null
  log("requesting microphone")
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  log("microphone granted")

  currentStream = stream
  audioChunks = []
  mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
  autoStopRequested = false
  if (autoStopEnabled) {
    startSilenceDetection(stream)
  } else {
    stopSilenceDetection()
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data)
    }
  }

  mediaRecorder.start()
  log("recorder started")
}

async function stopRecording(): Promise<string> {
  if (!mediaRecorder) {
    throw new Error("Recorder not initialized")
  }

  if (mediaRecorder.state !== "recording") {
    console.warn("Offscreen: recorder state", mediaRecorder.state)
  }

  stopSilenceDetection()

  return new Promise((resolve, reject) => {
    mediaRecorder!.onstop = async () => {
      try {
        log("recorder stopped, processing")
        const blob = new Blob(audioChunks, { type: "audio/webm" })
        const reader = new FileReader()
        const recordingIdSnapshot = currentRecordingId
        reader.onloadend = () => {
          const result = reader.result as string
          chrome.runtime.sendMessage({ type: "audio-data", audioData: result, recordingId: recordingIdSnapshot })
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

    mediaRecorder!.stop()
  })
}

function startSilenceDetection(stream: MediaStream) {
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
  if (silenceCheckId !== null) {
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

function checkSilence(timestamp: number) {
  if (!autoStopEnabled || !analyser || !analyserData || autoStopRequested) {
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
    if (silenceStartTime == null) {
      silenceStartTime = timestamp || performance.now()
    }
    const elapsed = (timestamp || performance.now()) - silenceStartTime
    if (elapsed >= SILENCE_DURATION_MS) {
      autoStopRequested = true
      log("silence detected, requesting stop", { rms, elapsed })
      stopSilenceDetection()
      chrome.runtime.sendMessage({ type: "auto-stop-recording-request", recordingId: currentRecordingId })
      return
    }
  } else {
    silenceStartTime = null
  }

  silenceCheckId = requestAnimationFrame(checkSilence)
}

function handleMessage(message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  if (message.type === "offscreen-ping") {
    sendResponse({ ready: true })
    return true
  }

  if (message.type === "offscreen-start-recording") {
    startRecording(Boolean(message.autoStop), message.recordingId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Offscreen: start error", error)
        sendResponse({ success: false, error: (error as Error).message })
      })
    return true
  }

  if (message.type === "offscreen-stop-recording") {
    stopRecording()
      .then((audioData) => sendResponse({ audioData }))
      .catch((error) => {
        console.error("Offscreen: stop error", error)
        sendResponse({ success: false, error: (error as Error).message })
      })
    return true
  }

  return false
}

export function initializeOffscreenRecorder() {
  if (initialized) {
    return
  }
  initialized = true
  log("runtime script loaded")
  chrome.runtime.onMessage.addListener(handleMessage)
}
