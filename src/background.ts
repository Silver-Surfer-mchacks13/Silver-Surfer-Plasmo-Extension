import { API_BASE_URL } from "~lib/constants"
import { getAuthState, login, logout } from "~lib/auth-service"

export {}

console.log("Silver Surfer Background Service Worker Loaded")

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
