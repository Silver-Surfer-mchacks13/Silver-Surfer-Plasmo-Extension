import { API_BASE_URL } from "~lib/constants"
import { getAuthState, login, logout } from "~lib/auth-service"

export {}

console.log("Silver Surfer Background Service Worker Loaded")

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function sendRuntimeMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

// ElevenLabs endpoints
const TTS_URL = "http://localhost:7265/api/v1/tts"
const STT_URL = "http://localhost:7265/api/v1/stt"

// Storage for captured data
let capturedData: {
  screenshot: string | null
  html: string | null
  url: string | null
  timestamp: number | null
} = {
  screenshot: null,
  html: null,
  url: null,
  timestamp: null
}

// Offscreen document for mic access
let offscreenCreated = false
let autoStopInProgress = false

async function requestAutoStopRecording(reason?: string) {
  if (autoStopInProgress) {
    console.log('BG: Auto-stop already in progress')
    return
  }

  autoStopInProgress = true
  try {
    console.log('BG: Triggering auto stop', reason)
    const response = await sendRuntimeMessage({ type: 'offscreen-stop-recording' })
    console.log('BG: Auto stop response:', response)
  } catch (error) {
    console.error('BG: Auto stop error:', error)
  } finally {
    autoStopInProgress = false
  }
}

async function createOffscreenDocument() {
  if (offscreenCreated) {
    console.log('BG: Offscreen already marked as created');
    return;
  }
  
  try {
    const existingContexts = await chrome.runtime.getContexts({})
    console.log('BG: Existing contexts:', existingContexts.map(c => ({ type: c.contextType, url: c.documentUrl })));
    const hasOffscreen = existingContexts.some(c => c.contextType === 'OFFSCREEN_DOCUMENT')
    
    if (hasOffscreen) {
      console.log('BG: Offscreen document already exists');
      offscreenCreated = true
      return
    }
    
    const url = chrome.runtime.getURL('offscreen.html');
    console.log('BG: Creating new offscreen document at URL:', url);
    
    await chrome.offscreen.createDocument({
      url: url,
      reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
      justification: 'Recording audio for speech-to-text'
    })
    
    console.log('BG: Offscreen document created successfully');
    offscreenCreated = true
    
    // Verify it was created
    const afterContexts = await chrome.runtime.getContexts({})
    console.log('BG: Contexts after creation:', afterContexts.map(c => ({ type: c.contextType, url: c.documentUrl })));
  } catch (error) {
    console.error('BG: Error in createOffscreenDocument:', error);
    throw error;
  }
}

async function waitForOffscreenReady() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await sendRuntimeMessage({ type: 'offscreen-ping' })
      if (response?.ready) {
        console.log('BG: Offscreen responded to ping')
        return
      }
    } catch (error) {
      console.warn('BG: Offscreen ping failed attempt', attempt + 1, error)
    }
    await delay(200)
  }
  throw new Error('Offscreen document did not respond to ping')
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ignore messages meant for offscreen document
  if (
    request.type === 'offscreen-start-recording' ||
    request.type === 'offscreen-stop-recording' ||
    request.type === 'offscreen-ping'
  ) {
    console.log('BG: Ignoring offscreen-specific message:', request.type);
    return false;
  }

  // TTS Handler
  if (request.type === 'tts-request') {
    (async () => {
      try {
        const response = await fetch(TTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: request.text })
        })
        
        if (!response.ok) throw new Error('TTS failed')
        
        const audioBlob = await response.blob()
        
        // Convert blob to base64 data URL for cross-context use
        const reader = new FileReader()
        reader.onloadend = () => {
          sendResponse({ success: true, audioDataUrl: reader.result })
        }
        reader.onerror = () => {
          sendResponse({ success: false, error: 'Failed to read audio' })
        }
        reader.readAsDataURL(audioBlob)
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
      }
    })()
    return true
  }

  // STT Start Recording
  if (request.type === 'start-recording') {
    console.log('BG: Received start-recording request');
    (async () => {
      try {
        console.log('BG: Creating offscreen document...');
        await createOffscreenDocument()
        console.log('BG: Waiting for offscreen readiness...')
        await waitForOffscreenReady()
        console.log('BG: Offscreen ready, sending start message...')
        const response = await sendRuntimeMessage({ type: 'offscreen-start-recording' })
        console.log('BG: Offscreen response:', response);
        sendResponse(response || { success: true })
      } catch (error) {
        console.error('BG: Start recording error:', error);
        sendResponse({ success: false, error: String(error) })
      }
    })()
    return true
  }

  // STT Stop Recording
  if (request.type === 'stop-recording') {
    console.log('BG: Received stop-recording request');
    (async () => {
      try {
        console.log('BG: Sending offscreen-stop-recording message...');
        const response = await sendRuntimeMessage({ type: 'offscreen-stop-recording' })
        console.log('BG: Stop response:', response);
        sendResponse(response)
      } catch (error) {
        console.error('BG: Stop recording error:', error);
        sendResponse({ success: false, error: String(error) })
      }
    })()
    return true
  }

  if (request.type === 'auto-stop-recording-request') {
    console.log('BG: Received auto-stop-recording-request')
    requestAutoStopRecording('silence-detected').catch((error) => {
      console.error('BG: Auto stop invocation failed:', error)
    })
    sendResponse({ success: true })
    return false
  }

  // Offscreen sends audio data
  if (request.type === 'audio-data') {
    console.log('BG: Received audio-data from offscreen');
    (async () => {
      try {
        console.log('BG: Converting base64 to blob...');
        // Convert base64 to blob
        const audioResponse = await fetch(request.audioData)
        const audioBlob = await audioResponse.blob()
        console.log('BG: Audio blob size:', audioBlob.size);
        
        // Send to STT API
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')
        
        console.log('BG: Sending to STT API...');
        const sttResponse = await fetch(STT_URL, {
          method: 'POST',
          body: formData
        })

        const responseText = await sttResponse.text()
        if (!sttResponse.ok) {
          console.error('BG: STT API error:', responseText)
          throw new Error('STT failed: ' + responseText)
        }

        let parsedResponse: any = null
        if (responseText) {
          try {
            parsedResponse = JSON.parse(responseText)
          } catch (parseError) {
            console.warn('BG: Failed to parse STT JSON response:', parseError)
          }
        }

        const resolvedText = parsedResponse?.text
          ?? parsedResponse?.transcript
          ?? parsedResponse?.agent_response
          ?? parsedResponse?.agent_response_event?.agent_response
          ?? parsedResponse?.result?.text
          ?? ''

        console.log('BG: STT raw response:', parsedResponse ?? responseText)
        console.log('BG: Transcription result:', resolvedText)
        
        // Send transcription to sidepanel with raw payload for debugging
        chrome.runtime.sendMessage({
          type: 'transcription-result',
          text: resolvedText,
          raw: parsedResponse ?? responseText
        })
      } catch (error) {
        console.error('BG: Audio processing error:', error);
        chrome.runtime.sendMessage({ type: 'transcription-result', error: String(error) })
      }
    })()
    return false
  }

  if (request.action === "API_REQUEST") {
    handleApiRequest(request)
      .then(sendResponse)
      .catch((err) => {
        console.error("API Request Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true // Keep the channel open for async response
  }

  if (request.action === "AUTH_LOGIN") {
    login()
      .then((authState) => sendResponse({ success: true, data: authState }))
      .catch((err) => {
        console.error("Auth Login Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true
  }

  if (request.action === "AUTH_LOGOUT") {
    logout()
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("Auth Logout Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true
  }

  if (request.action === "AUTH_GET_STATE") {
    getAuthState()
      .then((authState) => sendResponse({ success: true, data: authState }))
      .catch((err) => {
        console.error("Auth Get State Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true
  }

  if (request.action === "CAPTURE_SCREENSHOT") {
    handleScreenshotCapture()
      .then(sendResponse)
      .catch((err) => {
        console.error("Screenshot Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true
  }

  if (request.action === "GET_HTML") {
    // Forward request to content script in the active tab
    handleGetHtml()
      .then(sendResponse)
      .catch((err) => {
        console.error("HTML Extraction Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true
  }

  if (request.action === "SAVE_HTML") {
    // Received HTML from content script
    capturedData.html = request.html
    capturedData.url = request.url
    capturedData.timestamp = Date.now()
    sendResponse({ success: true })
    return true
  }

  if (request.action === "GET_CAPTURED_DATA") {
    sendResponse({ success: true, data: capturedData })
    return true
  }

  if (request.action === "CAPTURE_ALL") {
    handleCaptureAll()
      .then(sendResponse)
      .catch((err) => {
        console.error("Capture All Error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true
  }
})

async function handleScreenshotCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return { success: false, error: "No active tab found" }
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png"
    })

    capturedData.screenshot = dataUrl
    capturedData.url = tab.url || null
    capturedData.timestamp = Date.now()

    return { success: true, data: { screenshot: dataUrl, url: tab.url } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Screenshot failed"
    }
  }
}

async function handleGetHtml() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return { success: false, error: "No active tab found" }
    }

    // Send message to content script to extract HTML
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "EXTRACT_HTML"
    })

    if (response?.html) {
      capturedData.html = response.html
      capturedData.url = tab.url || null
      capturedData.timestamp = Date.now()
      return { success: true, data: { html: response.html, url: tab.url } }
    }

    return { success: false, error: "No HTML received" }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "HTML extraction failed"
    }
  }
}

async function handleCaptureAll() {
  const screenshotResult = await handleScreenshotCapture()
  const htmlResult = await handleGetHtml()

  return {
    success: true,
    data: {
      screenshot: capturedData.screenshot,
      html: capturedData.html,
      url: capturedData.url,
      timestamp: capturedData.timestamp
    }
  }
}

async function handleApiRequest(request: any) {
  const { endpoint, method = "GET", body, headers = {} } = request
  
  // Construct full URL
  // Ensure endpoint starts with / if not present, but avoid double //
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const url = `${API_BASE_URL}${cleanEndpoint}`

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    
    // Parse JSON if possible
    const contentType = response.headers.get("content-type")
    let data
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: data || response.statusText
      }
    }

    return {
      success: true,
      data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error"
    }
  }
}
