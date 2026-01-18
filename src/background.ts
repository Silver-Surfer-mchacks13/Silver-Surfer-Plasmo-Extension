import { API_BASE_URL } from "~lib/constants"
import { getAuthState, login, logout } from "~lib/auth-service"

export { }

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
const TTS_URL = "http://localhost:3000/api/v1/tts"
const STT_URL = "http://localhost:3000/api/v1/stt"

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
let recordingAutoStopEnabled = false
let currentRecordingId: string | null = null

async function requestAutoStopRecording(reason?: string, recordingId?: string) {
  if (!recordingAutoStopEnabled) {
    console.log('BG: Auto-stop ignored (disabled)', reason)
    return
  }
  if (autoStopInProgress) {
    console.log('BG: Auto-stop already in progress')
    return
  }
  if (recordingId && recordingId !== currentRecordingId) {
    console.log('BG: Auto-stop ignored for stale recording', { recordingId, currentRecordingId })
    return
  }

  autoStopInProgress = true
  try {
    console.log('BG: Triggering auto stop', reason)
    const response = await sendRuntimeMessage({ type: 'offscreen-stop-recording', recordingId })
    console.log('BG: Auto stop response:', response)
  } catch (error) {
    console.error('BG: Auto stop error:', error)
  } finally {
    autoStopInProgress = false
    recordingAutoStopEnabled = false
    if (!recordingId || recordingId === currentRecordingId) {
      currentRecordingId = null
    }
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

    const url = chrome.runtime.getURL('sidepanel.html?offscreen=1');
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
      const autoStopEnabled = Boolean(request.autoStop)
      const recordingId = typeof request.recordingId === 'string' ? request.recordingId : null
      try {
        console.log('BG: Creating offscreen document...');
        await createOffscreenDocument()
        console.log('BG: Waiting for offscreen readiness...')
        await waitForOffscreenReady()
        console.log('BG: Offscreen ready, sending start message...')
        const response = await sendRuntimeMessage({
          type: 'offscreen-start-recording',
          autoStop: autoStopEnabled,
          recordingId
        })
        console.log('BG: Offscreen response:', response);
        recordingAutoStopEnabled = autoStopEnabled
        currentRecordingId = recordingId
        sendResponse(response || { success: true })
      } catch (error) {
        console.error('BG: Start recording error:', error);
        recordingAutoStopEnabled = false
        currentRecordingId = null
        sendResponse({ success: false, error: String(error) })
      }
    })()
    return true
  }

  // STT Stop Recording
  if (request.type === 'stop-recording') {
    console.log('BG: Received stop-recording request');
    (async () => {
      const stopTargetId = typeof request.recordingId === 'string' ? request.recordingId : currentRecordingId
      try {
        console.log('BG: Sending offscreen-stop-recording message...');
        const response = await sendRuntimeMessage({
          type: 'offscreen-stop-recording',
          recordingId: stopTargetId
        })
        console.log('BG: Stop response:', response);
        recordingAutoStopEnabled = false
        if (!stopTargetId || currentRecordingId === stopTargetId) {
          currentRecordingId = null
        }
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
    requestAutoStopRecording('silence-detected', typeof request.recordingId === 'string' ? request.recordingId : currentRecordingId).catch((error) => {
      console.error('BG: Auto stop invocation failed:', error)
    })
    sendResponse({ success: true })
    return false
  }

  // Offscreen sends audio data
  if (request.type === 'audio-data') {
    console.log('BG: Received audio-data from offscreen');
    (async () => {
      const resolvedRecordingId = request.recordingId ?? currentRecordingId ?? null
      if (resolvedRecordingId && resolvedRecordingId === currentRecordingId) {
        currentRecordingId = null
      }
      try {
        console.log('BG: Converting base64 to blob...');
        // Convert base64 to blob
        const audioResponse = await fetch(request.audioData)
        const audioBlob = await audioResponse.blob()
        console.log('BG: Audio blob size:', audioBlob.size);

        chrome.runtime.sendMessage({
          type: 'recording-stopped',
          recordingId: resolvedRecordingId
        })

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
          raw: parsedResponse ?? responseText,
          recordingId: resolvedRecordingId
        })
      } catch (error) {
        console.error('BG: Audio processing error:', error);
        chrome.runtime.sendMessage({
          type: 'transcription-result',
          error: String(error),
          recordingId: resolvedRecordingId
        })
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

    // Check if URL allows content scripts (chrome://, about:, etc. don't)
    const url = tab.url || ""
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") ||
      url.startsWith("moz-extension://") || url.startsWith("about:") ||
      url.startsWith("edge://")) {
      console.warn("Content scripts not available on this page type:", url)
      return { success: true, data: { distilledDOM: null, url: tab.url } }
    }

    // Try to send message to content script
    let response
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "DISTILL_DOM"
      })
    } catch (sendError) {
      // If sendMessage throws, content script likely not loaded
      console.warn("Content script not loaded, returning null for distilledDOM:", sendError)
      return { success: true, data: { distilledDOM: null, url: tab.url } }
    }

    // Check for runtime errors (content script not available)
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message
      if (errorMsg?.includes("Receiving end does not exist") ||
        errorMsg?.includes("Could not establish connection")) {
        console.warn("Content script not available on this page, returning null for distilledDOM")
        return { success: true, data: { distilledDOM: null, url: tab.url } }
      }
      console.error("Error sending message to content script:", errorMsg)
      return { success: false, error: errorMsg || "Failed to communicate with content script" }
    }

    if (response?.success && response?.data) {
      capturedData.html = JSON.stringify(response.data) // Store as JSON string
      capturedData.url = tab.url || null
      capturedData.timestamp = Date.now()
      console.log("Successfully captured distilled DOM:", { elementCount: response.data?.elements?.length || 0 })
      return { success: true, data: { distilledDOM: response.data, url: tab.url } }
    }

    console.error("DOM distillation failed:", response?.message || "Unknown error", response)
    return { success: false, error: response?.message || "DOM distillation failed" }
  } catch (error) {
    console.error("Exception in handleGetHtml:", error)
    // Return success with null distilledDOM instead of failing completely
    // This allows the request to proceed without distilledDOM
    return { success: true, data: { distilledDOM: null, url: null } }
  }
}

async function handleCaptureAll() {
  const screenshotResult = await handleScreenshotCapture()
  const domResult = await handleGetHtml()

  console.log("handleCaptureAll results:", {
    screenshotSuccess: screenshotResult.success,
    domSuccess: domResult.success,
    hasDistilledDOM: !!domResult.data?.distilledDOM,
    distilledDOMType: typeof domResult.data?.distilledDOM
  })

  return {
    success: true,
    data: {
      screenshot: capturedData.screenshot,
      distilledDOM: domResult.success ? domResult.data?.distilledDOM : null,
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

  // Get backend access token from storage and add as Bearer token
  // Only add if Authorization header is not already provided
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers
  }

  // Add JWT Bearer token if not already provided and token exists
  if (!requestHeaders.Authorization && !requestHeaders.authorization) {
    try {
      const storage = await chrome.storage.local.get([
        "backend_access_token",
        "backend_access_token_expires_at"
      ])

      const backendAccessToken = storage.backend_access_token
      const expiresAt = storage.backend_access_token_expires_at

      // Only add token if it exists and is not expired
      if (backendAccessToken && expiresAt && Date.now() < expiresAt) {
        requestHeaders.Authorization = `Bearer ${backendAccessToken}`
      }
    } catch (e) {
      console.error("Failed to retrieve backend access token:", e)
    }
  }

  const options: RequestInit = {
    method,
    headers: requestHeaders
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
