type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string | any
  status?: number
}

// Helper to send message to background
async function sendToBackground(
  endpoint: string,
  method: ApiMethod,
  body?: any,
  headers?: Record<string, string>
): Promise<ApiResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "API_REQUEST",
        endpoint,
        method,
        body,
        headers
      },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          })
        } else {
          resolve(response)
        }
      }
    )
  })
}

// Exposed API client
export const api = {
  get: <T = any>(endpoint: string, headers?: Record<string, string>) => 
    sendToBackground(endpoint, "GET", undefined, headers),

  post: <T = any>(endpoint: string, body: any, headers?: Record<string, string>) =>
    sendToBackground(endpoint, "POST", body, headers),

  put: <T = any>(endpoint: string, body: any, headers?: Record<string, string>) =>
    sendToBackground(endpoint, "PUT", body, headers),

  delete: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    sendToBackground(endpoint, "DELETE", undefined, headers)
}
