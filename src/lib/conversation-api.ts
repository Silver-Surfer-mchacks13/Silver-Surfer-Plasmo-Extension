// src/lib/conversation-api.ts
// API client for the Conversations endpoint using existing api module

import { api } from "./api"
import type { ConversationRequest, ConversationResponse, PageState } from "~types/conversation"

const CONVERSATIONS_ENDPOINT = "/api/chat"

/**
 * Send a message to the conversations API
 * If sessionId is provided, continues existing conversation
 * If omitted, creates a new conversation session
 */
export async function sendConversationMessage(
  message: string,
  sessionId?: string | null,
  pageState?: PageState,
  pageTitle?: string
): Promise<{ success: boolean; data?: ConversationResponse; error?: string }> {
  const requestBody: ConversationRequest = {
    title: pageTitle || "Untitled Page",
    message: message,  // The actual user message
    page_state: pageState || { url: "", distilledDOM: null, screenshot: "" }
  }

  // Only include session_id if we have one (to continue existing conversation)
  if (sessionId) {
    requestBody.session_id = sessionId
  }

  const response = await api.post<ConversationResponse>(CONVERSATIONS_ENDPOINT, requestBody)

  if (!response.success) {
    // Handle error - could be string or object
    let errorMessage = "Failed to send message"
    if (response.error) {
      if (typeof response.error === "string") {
        errorMessage = response.error
      } else if (typeof response.error === "object") {
        // Try to extract a message from the error object
        const errObj = response.error as Record<string, unknown>
        errorMessage = (errObj.message || errObj.title || errObj.detail || JSON.stringify(response.error)) as string
      }
    }
    
    console.error("Conversation API error:", response.status, response.error)
    
    return {
      success: false,
      error: errorMessage
    }
  }

  return {
    success: true,
    data: response.data as ConversationResponse
  }
}

/**
 * Get the current page state from the active tab including distilled DOM and screenshot
 */
export async function getCurrentPageState(): Promise<{
  pageState: PageState
  title: string
} | null> {
  return new Promise((resolve) => {
    // Use CAPTURE_ALL to get both screenshot and distilled DOM
    chrome.runtime.sendMessage({ action: "CAPTURE_ALL" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to capture page state:", chrome.runtime.lastError)
        resolve(null)
        return
      }

      if (!response?.success || !response?.data) {
        console.error("Failed to capture page state:", response?.error)
        resolve(null)
        return
      }

      const { screenshot, distilledDOM, url } = response.data

      // Get the page title from the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]
        const title = tab?.title || "Untitled"

        resolve({
          pageState: {
            url: url || tab?.url || "",
            distilledDOM: distilledDOM || null,
            screenshot: screenshot || ""
          },
          title
        })
      })
    })
  })
}
