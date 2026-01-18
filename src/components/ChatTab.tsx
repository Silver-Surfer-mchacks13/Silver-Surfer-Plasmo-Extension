// src/components/ChatTab.tsx
// Chat interface component that integrates with the Conversations API

import { useState, useRef, useEffect, useCallback } from "react"
import { sendConversationMessage, getCurrentPageState, getConversation } from "~lib/conversation-api"
import type { ChatMessage, ConversationAction, ChatState, ConversationMessage } from "~types/conversation"

const PENDING_SESSION_KEY = "pending_session_id"
const START_NEW_CONVERSATION_KEY = "start_new_conversation"
const ACTIVE_CHAT_SESSION_KEY = "active_chat_session_id"

const HANDS_FREE_SEGMENT_MS = 7000

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateRecordingId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function ActionBadge({ action }: { action: ConversationAction }) {
  const getActionInfo = () => {
    switch (action.action_type) {
      case "click":
        return { icon: "touch_app", label: "Click", color: "bg-orange-100 dark:bg-orange-900" }
      case "wait":
        return { icon: "hourglass_empty", label: `Wait ${action.duration}ms`, color: "bg-purple-100 dark:bg-purple-900" }
      case "message":
        return { icon: "chat", label: "Message", color: "bg-blue-100 dark:bg-blue-900" }
      case "complete":
        return { icon: "check_circle", label: "Complete", color: "bg-green-100 dark:bg-green-900" }
      case "highlight":
        return { icon: "highlight", label: "Highlight", color: "bg-yellow-100 dark:bg-yellow-900" }
      case "remove_highlights":
        return { icon: "visibility_off", label: "Clear Highlights", color: "bg-gray-100 dark:bg-gray-700" }
      case "magnify":
        return { icon: "zoom_in", label: "Magnify", color: "bg-indigo-100 dark:bg-indigo-900" }
      case "reset_magnification":
        return { icon: "zoom_out", label: "Reset Zoom", color: "bg-gray-100 dark:bg-gray-700" }
      case "scroll":
        return { icon: "swap_vert", label: "Scroll", color: "bg-cyan-100 dark:bg-cyan-900" }
      case "fill_form":
        return { icon: "edit", label: "Fill Form", color: "bg-teal-100 dark:bg-teal-900" }
      case "select_dropdown":
        return { icon: "arrow_drop_down_circle", label: "Select", color: "bg-pink-100 dark:bg-pink-900" }
      case "remove_clutter":
        return { icon: "cleaning_services", label: "Clean Page", color: "bg-lime-100 dark:bg-lime-900" }
      case "restore_clutter":
        return { icon: "restore", label: "Restore", color: "bg-gray-100 dark:bg-gray-700" }
      default:
        return { icon: "help", label: "Unknown", color: "bg-gray-100 dark:bg-gray-700" }
    }
  }

  const { icon, label, color } = getActionInfo()

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${color} text-ink dark:text-white`}>
      <span className="material-icons-outlined text-sm">{icon}</span>
      {label}
    </span>
  )
}

// Execute an action on the current page via content script
async function executeAction(action: ConversationAction): Promise<{ success: boolean; message?: string }> {
  return new Promise(async (resolve) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (!tabId) {
      resolve({ success: false, message: "No active tab" })
      return
    }

    // Handle actions that don't need page execution
    if (action.action_type === "wait") {
      await new Promise((r) => setTimeout(r, action.duration))
      resolve({ success: true, message: `Waited ${action.duration}ms` })
      return
    }

    if (action.action_type === "message" || action.action_type === "complete") {
      resolve({ success: true })
      return
    }

    // Store action parameters for fallback
    const selector = action.x_path || action.selector
    const value = action.value
    const scaleFactor = action.scale_factor || 1.3

    // Try sendMessage first (if content script is ready)
    try {
      let messageAction: string
      let messagePayload: Record<string, unknown> = {}

      switch (action.action_type) {
        case "click":
          messageAction = "CLICK_ELEMENT"
          messagePayload = { selector: action.x_path }
          break
        case "highlight":
          messageAction = "HIGHLIGHT_ELEMENT"
          messagePayload = { selector: action.selector }
          break
        case "remove_highlights":
          messageAction = "REMOVE_HIGHLIGHTS"
          break
        case "magnify":
          messageAction = "MAGNIFY_TEXT"
          messagePayload = { selector: action.selector, scaleFactor: action.scale_factor || 1.3 }
          break
        case "reset_magnification":
          messageAction = "RESET_MAGNIFICATION"
          break
        case "scroll":
          messageAction = "SCROLL_TO_VIEW"
          messagePayload = { selector: action.selector }
          break
        case "fill_form":
          messageAction = "FILL_FORM_FIELD"
          messagePayload = { selector: action.selector, value: action.value }
          break
        case "select_dropdown":
          messageAction = "SELECT_DROPDOWN"
          messagePayload = { selector: action.selector, value: action.value }
          break
        case "remove_clutter":
          messageAction = "REMOVE_CLUTTER"
          break
        case "restore_clutter":
          messageAction = "RESTORE_CLUTTER"
          break
      }

      chrome.tabs.sendMessage(tabId, { action: messageAction, ...messagePayload }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message
          if (errorMsg?.includes("Receiving end does not exist") ||
              errorMsg?.includes("Could not establish connection")) {
            // Content script not ready, fall back to executeScript
            console.log("Content script not ready for action, using executeScript fallback")
            fallbackToExecuteScript()
          } else {
            resolve({ success: false, message: errorMsg || "Failed to execute action" })
          }
        } else {
          resolve(response || { success: true })
        }
      })
    } catch (sendError) {
      // Content script not loaded, fall back to executeScript
      console.log("Content script not loaded for action, using executeScript fallback:", sendError)
      fallbackToExecuteScript()
    }

    // Fallback function using executeScript (plain JavaScript only!)
    async function fallbackToExecuteScript() {
      try {
        // Create plain JavaScript function based on action type (NO TypeScript syntax!)
        let executeFunc: any
        let args: any[] = []
        
        switch (action.action_type) {
          case "click":
            executeFunc = function(sel) {
              const element = document.querySelector(sel)
              if (!element) return { success: false, message: "Element not found: " + sel }
              const el = element
              const unsafePatterns = [
                /pay/i, /purchase/i, /buy/i, /checkout/i, /order/i,
                /confirm/i, /submit.*order/i, /complete.*purchase/i,
                /delete/i, /remove/i, /cancel.*subscription/i,
                /sign.*out/i, /log.*out/i, /disconnect/i,
                /unsubscribe/i, /deactivate/i
              ]
              const text = ((el.textContent || "") + (el.value || "") + (el.getAttribute("aria-label") || "")).toLowerCase()
              for (let i = 0; i < unsafePatterns.length; i++) {
                if (unsafePatterns[i].test(text)) {
                  return { success: false, message: "Blocked: This appears to be a sensitive action. Please click manually." }
                }
              }
              el.click()
              return { success: true, message: "Clicked element: " + sel }
            }
            args = [selector]
            break
          case "highlight":
            executeFunc = function(sel) {
              const element = document.querySelector(sel)
              if (!element) return { success: false, message: "Element not found: " + sel }
              element.setAttribute("data-silver-surfer-highlight", "true")
              element.style.setProperty("outline", "4px solid #000", "important")
              element.style.setProperty("outline-offset", "2px", "important")
              element.style.setProperty("box-shadow", "6px 6px 0 0 #3b82f6", "important")
              return { success: true, message: "Highlighted element: " + sel }
            }
            args = [selector]
            break
          case "remove_highlights":
            executeFunc = function() {
              document.querySelectorAll("[data-silver-surfer-highlight]").forEach(function(el) {
                el.removeAttribute("data-silver-surfer-highlight")
                el.style.removeProperty("outline")
                el.style.removeProperty("outline-offset")
                el.style.removeProperty("box-shadow")
              })
              return { success: true, message: "Removed all highlights" }
            }
            break
          case "magnify":
            executeFunc = function(sel, scale) {
              const element = document.querySelector(sel)
              if (!element) return { success: false, message: "Element not found: " + sel }
              const scaleVal = scale || 1.3
              element.style.setProperty("font-size", (scaleVal * 100) + "%", "important")
              element.style.setProperty("transform", "scale(" + scaleVal + ")", "important")
              return { success: true, message: "Magnified element: " + sel }
            }
            args = [selector, scaleFactor]
            break
          case "reset_magnification":
            executeFunc = function() {
              document.querySelectorAll("[style*='font-size'], [style*='transform']").forEach(function(el) {
                el.style.removeProperty("font-size")
                el.style.removeProperty("transform")
              })
              return { success: true, message: "Reset magnification" }
            }
            break
          case "scroll":
            executeFunc = function(sel) {
              const element = document.querySelector(sel)
              if (!element) return { success: false, message: "Element not found: " + sel }
              element.scrollIntoView({ behavior: "smooth", block: "center" })
              return { success: true, message: "Scrolled to element: " + sel }
            }
            args = [selector]
            break
          case "fill_form":
            executeFunc = function(sel, val) {
              const element = document.querySelector(sel)
              if (!element) return { success: false, message: "Element not found: " + sel }
              if (["INPUT", "TEXTAREA"].indexOf(element.tagName) === -1) {
                return { success: false, message: "Element is not an input field: " + element.tagName }
              }
              const inputType = element.type || ""
              if (["password", "credit-card"].indexOf(inputType) !== -1) {
                return { success: false, message: "Blocked: Cannot auto-fill sensitive fields" }
              }
              element.focus()
              element.value = val || ""
              element.dispatchEvent(new Event("input", { bubbles: true }))
              element.dispatchEvent(new Event("change", { bubbles: true }))
              return { success: true, message: "Filled field: " + sel }
            }
            args = [selector, value]
            break
          case "select_dropdown":
            executeFunc = function(sel, val) {
              const element = document.querySelector(sel)
              if (!element || element.tagName !== "SELECT") {
                return { success: false, message: "Select element not found: " + sel }
              }
              element.value = val || ""
              element.dispatchEvent(new Event("change", { bubbles: true }))
              return { success: true, message: "Selected option: " + val }
            }
            args = [selector, value]
            break
          case "remove_clutter":
            executeFunc = function() {
              const clutterSelectors = ["aside", "nav", "footer", ".ad", ".advertisement", "[class*='ad-']"]
              clutterSelectors.forEach(function(sel) {
                document.querySelectorAll(sel).forEach(function(el) {
                  el.style.setProperty("display", "none", "important")
                })
              })
              return { success: true, message: "Removed clutter" }
            }
            break
          case "restore_clutter":
            executeFunc = function() {
              document.querySelectorAll("[style*='display: none']").forEach(function(el) {
                el.style.removeProperty("display")
              })
              return { success: true, message: "Restored clutter" }
            }
            break
          default:
            resolve({ success: false, message: "Unknown action type for fallback" })
            return
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: executeFunc,
          args: args
        })

        if (results && results[0]?.result) {
          resolve(results[0].result)
        } else {
          resolve({ success: false, message: "Action execution returned no result" })
        }
      } catch (scriptError) {
        console.error("executeScript failed for action:", scriptError)
        resolve({ success: false, message: scriptError instanceof Error ? scriptError.message : "Failed to execute action" })
      }
    }
  })
}

// Execute all actions sequentially
async function executeActions(actions: ConversationAction[]): Promise<void> {
  for (const action of actions) {
    await executeAction(action)
    // Small delay between actions for visual feedback
    if (action.action_type !== "wait") {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}

function AssistantMessage({ message, onSpeak }: { message: ChatMessage; onSpeak: (text: string) => void }) {
  return (
    <div className="flex w-full justify-start">
      <div className="relative max-w-[90%]">
        <div className="absolute -left-2 top-6 z-10 h-5 w-5 rotate-45 border-l-2 border-b-2 border-ink bg-white dark:bg-slate-700" />
        <div className="relative z-20 rounded-xl border-2 border-ink bg-white p-5 text-ink shadow-comic dark:bg-slate-700 dark:text-white">
          <div className="flex items-start gap-3">
            <p className="font-body text-lg font-bold leading-snug flex-1">
              {message.content}
            </p>
            <button
              onClick={() => onSpeak(message.content)}
              className="shrink-0 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-600"
              title="Read aloud"
            >
              <span className="material-icons-outlined text-xl">volume_up</span>
            </button>
          </div>
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actions.map((action, idx) => (
                <ActionBadge key={idx} action={action} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex w-full justify-end">
      <div className="relative max-w-[90%]">
        <div className="absolute -right-2 top-6 z-10 h-5 w-5 -rotate-45 border-r-2 border-b-2 border-ink bg-blue-100 dark:bg-blue-900" />
        <div className="relative z-20 rounded-xl border-2 border-ink bg-blue-100 p-5 text-ink shadow-comic dark:bg-blue-900 dark:text-white">
          <p className="font-body text-lg font-bold leading-snug">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingMessage() {
  return (
    <div className="flex w-full justify-start">
      <div className="relative max-w-[90%]">
        <div className="absolute -left-2 top-6 z-10 h-5 w-5 rotate-45 border-l-2 border-b-2 border-ink bg-white dark:bg-slate-700" />
        <div className="relative z-20 rounded-xl border-2 border-ink bg-white p-5 text-ink shadow-comic dark:bg-slate-700 dark:text-white">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined animate-spin text-xl text-blue-500">
              autorenew
            </span>
            <p className="font-body text-lg font-bold leading-snug text-gray-500 dark:text-gray-400">
              Thinking...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatTab() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    sessionId: null,
    isProcessing: false,
    isComplete: false
  })
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isHandsFree, setIsHandsFree] = useState(false)
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)
  const [lastSpokenAssistantId, setLastSpokenAssistantId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const handsFreeStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRecordingIdRef = useRef<string | null>(null)

  const clearHandsFreeTimer = useCallback(() => {
    if (handsFreeStopTimer.current) {
      clearTimeout(handsFreeStopTimer.current)
      handsFreeStopTimer.current = null
    }
  }, [])

  const handleTextToSpeech = useCallback(async (text: string) => {
    if (!text?.trim()) return
    const response = await chrome.runtime.sendMessage({ type: "tts-request", text })
    if (response?.success && response.audioDataUrl) {
      await new Promise<void>((resolve) => {
        const audio = new Audio(response.audioDataUrl)
        audio.onended = () => resolve()
        audio.onerror = (err) => {
          console.error("Audio playback error:", err)
          resolve()
        }
        audio.play().catch((err) => {
          console.error("Audio playback error:", err)
          resolve()
        })
      })
    } else if (response?.error) {
      console.error("TTS request failed:", response.error)
    }
  }, [])

  // Maximum number of agent loop iterations to prevent infinite loops
  const MAX_ITERATIONS = 10

  // Process a single API response and execute actions
  const processAgentResponse = async (
    response: { success: boolean; data?: any; error?: string },
    currentSessionId: string | null,
    originalMessage: string,
    iteration: number
  ): Promise<void> => {
    if (!response.success || !response.data) {
      const errorContent = typeof response.error === "string"
        ? response.error
        : "Sorry, something went wrong. Please try again."

      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date()
      }

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isProcessing: false
      }))
      return
    }

    const { session_id, actions, complete, needs_observation, title } = response.data

    // Update conversation title if provided
    if (title && typeof title === "string") {
      setConversationTitle(title)
    }

    // Extract messages from actions
    const messageActions = actions.filter(
      (a: ConversationAction) => a.action_type === "message" || a.action_type === "complete"
    )

    // Get non-message actions to execute on the page
    const executableActions = actions.filter(
      (a: ConversationAction) => a.action_type !== "message" && a.action_type !== "complete"
    )

    // Create assistant messages
    const assistantMessages: ChatMessage[] = messageActions.map((action: ConversationAction) => ({
      id: generateId(),
      role: "assistant" as const,
      content: action.action_type === "message" || action.action_type === "complete"
        ? (action as any).message
        : "",
      timestamp: new Date((action as any).timestamp),
      actions: executableActions.length > 0 ? executableActions : undefined
    }))

    // If no message actions but we have executable actions, create a status message
    if (assistantMessages.length === 0 && executableActions.length > 0) {
      assistantMessages.push({
        id: generateId(),
        role: "assistant",
        content: `Executing ${executableActions.length} action(s)...`,
        timestamp: new Date(),
        actions: executableActions
      })
    }

    // Update UI with messages
    if (assistantMessages.length > 0) {
      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...assistantMessages],
        sessionId: session_id
      }))
      // Update active session in storage for History tab to check
      if (session_id) {
        chrome.storage.local.set({ [ACTIVE_CHAT_SESSION_KEY]: session_id })
      }
    }

    // Execute page actions
    if (executableActions.length > 0) {
      await executeActions(executableActions)
    }

    // If task is not complete and we haven't hit max iterations, continue
    if (!complete && iteration < MAX_ITERATIONS) {
      if (needs_observation) {
        // Agent wants to observe the page after actions
        // Wait for page to update after actions
        await new Promise((r) => setTimeout(r, 1000))

        // Capture new page state
        const newPageData = await getCurrentPageState()

        if (newPageData) {
          // Add a thinking indicator
          setChatState((prev) => ({
            ...prev,
            messages: [...prev.messages, {
              id: generateId(),
              role: "assistant",
              content: "Observing the page...",
              timestamp: new Date()
            }]
          }))

          // Send observation to agent (use special message format)
          const observationResponse = await sendConversationMessage(
            `[OBSERVATION] Continuing task: ${originalMessage}`,
            session_id,
            newPageData.pageState,
            newPageData.title
          )

          // Recursively process the next response
          await processAgentResponse(
            observationResponse,
            session_id,
            originalMessage,
            iteration + 1
          )
        } else {
          // Couldn't capture page state, mark as done
          setChatState((prev) => ({
            ...prev,
            isProcessing: false,
            isComplete: true
          }))
        }
      } else {
        // Agent wants to continue without observation - send continuation request with current page state
        // Wait a bit for actions to complete
        await new Promise((r) => setTimeout(r, 500))

        // Add a thinking indicator
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, {
            id: generateId(),
            role: "assistant",
            content: "Continuing...",
            timestamp: new Date()
          }]
        }))

        // Get current page state (even though needs_observation is false, we still send it for context)
        const currentPageData = await getCurrentPageState()

        // Send continuation request to agent
        const continuationResponse = await sendConversationMessage(
          `[CONTINUE] Continuing task: ${originalMessage}`,
          session_id,
          currentPageData?.pageState || null,
          currentPageData?.title || null
        )

        // Recursively process the next response
        await processAgentResponse(
          continuationResponse,
          session_id,
          originalMessage,
          iteration + 1
        )
      }
    } else {
      // Task complete or max iterations reached
      setChatState((prev) => ({
        ...prev,
        isProcessing: false,
        isComplete: complete || iteration >= MAX_ITERATIONS
      }))

      if (iteration >= MAX_ITERATIONS) {
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, {
            id: generateId(),
            role: "assistant",
            content: "I've reached the maximum number of steps. Please review what's been done and let me know if you need further assistance.",
            timestamp: new Date()
          }]
        }))
      }
    }
  }

  const speakMessage = useCallback((text: string) => {
    handleTextToSpeech(text).catch((err) => console.error("Text-to-speech failed:", err))
  }, [handleTextToSpeech])

  const handleStartRecording = useCallback(async (autoStop = false) => {
    if (isRecording || chatState.isProcessing) {
      return false
    }

    const recordingId = generateRecordingId()
    activeRecordingIdRef.current = recordingId
    setIsRecording(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: "start-recording",
        autoStop,
        recordingId
      })
      if (response?.success === false) {
        setIsRecording(false)
        activeRecordingIdRef.current = null
        return false
      }
      return true
    } catch (error) {
      console.error("Start recording error:", error)
      setIsRecording(false)
      activeRecordingIdRef.current = null
      return false
    }
  }, [chatState.isProcessing, isRecording])

  const handleStopRecording = useCallback(async () => {
    if (!isRecording && !activeRecordingIdRef.current) {
      return false
    }

    const recordingId = activeRecordingIdRef.current
    clearHandsFreeTimer()
    setIsRecording(false)
    activeRecordingIdRef.current = null
    try {
      await chrome.runtime.sendMessage({ type: "stop-recording", recordingId })
      return true
    } catch (error) {
      console.error("Stop recording error:", error)
      return false
    }
  }, [clearHandsFreeTimer, isRecording])

  const handleSendMessage = useCallback(async (overrideText?: string | React.MouseEvent<HTMLButtonElement>) => {
    const normalizedOverride = typeof overrideText === "string" ? overrideText : undefined
    const sourceText = (normalizedOverride ?? inputValue) ?? ""
    const trimmedInput = sourceText.trim()
    if (!trimmedInput || chatState.isProcessing) return

    setInputValue("")

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmedInput,
      timestamp: new Date()
    }

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      isComplete: false
    }))

    try {
      const pageData = await getCurrentPageState()

      const response = await sendConversationMessage(
        trimmedInput,
        chatState.sessionId,
        pageData?.pageState,
        pageData?.title
      )

      // Process the response (may recurse for multi-step tasks)
      await processAgentResponse(response, chatState.sessionId, trimmedInput, 0)
    } catch (error) {
      console.error("Error in handleSendMessage:", error)
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Sorry, I couldn't connect to the server. Please check your connection and try again.",
        timestamp: new Date()
      }

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isProcessing: false
      }))
    }
  }, [chatState.isProcessing, chatState.sessionId, inputValue])

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleNewConversation = useCallback(() => {
    setChatState({
      messages: [],
      sessionId: null,
      isProcessing: false,
      isComplete: false
    })
    setConversationTitle(null)
    setInputValue("")
    // Clear active session in storage
    chrome.storage.local.remove([ACTIVE_CHAT_SESSION_KEY])
  }, [])

  const handleHandsFreeToggle = useCallback(() => {
    const next = !isHandsFree
    setIsHandsFree(next)

    if (next) {
      const lastAssistant = [...chatState.messages].reverse().find((m) => m.role === "assistant")
      setLastSpokenAssistantId(lastAssistant?.id ?? null)
    } else {
      clearHandsFreeTimer()
      setIsAssistantSpeaking(false)
      handleStopRecording()
    }
  }, [chatState.messages, clearHandsFreeTimer, handleStopRecording, isHandsFree])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === "recording-stopped") {
        if (
          (msg.recordingId && msg.recordingId === activeRecordingIdRef.current) ||
          (!msg.recordingId && !activeRecordingIdRef.current)
        ) {
          activeRecordingIdRef.current = null
          clearHandsFreeTimer()
          setIsRecording(false)
        }
        return
      }

      if (msg.type === "transcription-result") {
        const matchesActive = msg.recordingId
          ? msg.recordingId === activeRecordingIdRef.current
          : !activeRecordingIdRef.current

        if (matchesActive) {
          activeRecordingIdRef.current = null
          clearHandsFreeTimer()
          setIsRecording(false)
        }

        if (msg.error) {
          console.error("Transcription error:", msg.error)
          return
        }

        if (msg.text) {
          setInputValue(msg.text)
          if (isHandsFree) {
            handleSendMessage(msg.text)
          }
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [clearHandsFreeTimer, handleSendMessage, isHandsFree])

  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom, chatState.messages])

  // Load conversation from history if pending sessionId exists
  const loadPendingConversation = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get([PENDING_SESSION_KEY])
      const pendingSessionId = result[PENDING_SESSION_KEY]

      if (pendingSessionId && typeof pendingSessionId === "string") {
        // Only load if we don't already have messages or a sessionId (avoid overwriting active conversation)
        if (chatState.messages.length === 0 && chatState.sessionId === null) {
          // Clear the pending sessionId before loading to prevent race conditions
          await chrome.storage.local.remove([PENDING_SESSION_KEY])

          const conversationResult = await getConversation(pendingSessionId)

          if (conversationResult.success && conversationResult.data) {
            // Map API messages to ChatMessage format
            const loadedMessages: ChatMessage[] = conversationResult.data.messages.map((msg: ConversationMessage) => ({
              id: msg.id,
              role: msg.role as ChatMessage["role"],
              content: msg.content,
              timestamp: new Date(msg.CreatedAt),
              actions: undefined // API messages don't include actions, they're stored separately
            }))

            setChatState({
              messages: loadedMessages,
              sessionId: pendingSessionId,
              isProcessing: false,
              isComplete: conversationResult.data.CompletedAt !== null
            })
            setConversationTitle(conversationResult.data.Title || null)
            // Update active session in storage for History tab to check
            if (pendingSessionId) {
              chrome.storage.local.set({ [ACTIVE_CHAT_SESSION_KEY]: pendingSessionId })
            }
          }
        } else {
          // If we have an active conversation, just clear the pending sessionId
          await chrome.storage.local.remove([PENDING_SESSION_KEY])
        }
      }
    } catch (error) {
      console.error("Error loading pending conversation:", error)
    }
  }, [chatState.messages.length, chatState.sessionId])

  useEffect(() => {
    loadPendingConversation()
  }, [loadPendingConversation])

  // Also listen for storage changes (when History tab saves pending sessionId or requests new conversation)
  useEffect(() => {
    const handleStorageChange = async (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "local") {
        // Handle new conversation request
        if (changes[START_NEW_CONVERSATION_KEY]) {
          const shouldStartNew = changes[START_NEW_CONVERSATION_KEY].newValue
          if (shouldStartNew === true) {
            // Clear the flag
            await chrome.storage.local.remove([START_NEW_CONVERSATION_KEY])
            // Only start new if we have an active conversation
            if (chatState.messages.length > 0 || chatState.sessionId !== null) {
              handleNewConversation()
            }
          }
        }

        // Handle pending sessionId (load conversation from history)
        if (changes[PENDING_SESSION_KEY]) {
          // Only load if we don't have messages or a sessionId (avoid overwriting active conversation)
          if (chatState.messages.length === 0 && chatState.sessionId === null) {
            loadPendingConversation()
          }
        }
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [chatState.messages.length, chatState.sessionId, loadPendingConversation, handleNewConversation])

  useEffect(() => {
    if (!isHandsFree || isRecording || chatState.isProcessing || isAssistantSpeaking) {
      return
    }

    let cancelled = false

    const startAsync = async () => {
      const started = await handleStartRecording(true)
      if (!started || cancelled) return

      clearHandsFreeTimer()
      handsFreeStopTimer.current = setTimeout(() => {
        handleStopRecording()
      }, HANDS_FREE_SEGMENT_MS)
    }

    startAsync()

    return () => {
      cancelled = true
    }
  }, [
    chatState.isProcessing,
    clearHandsFreeTimer,
    handleStartRecording,
    handleStopRecording,
    isAssistantSpeaking,
    isHandsFree,
    isRecording
  ])

  useEffect(() => {
    if (!isHandsFree || chatState.isProcessing) {
      return
    }

    const lastAssistant = [...chatState.messages].reverse().find((m) => m.role === "assistant")
    if (!lastAssistant || lastAssistant.id === lastSpokenAssistantId) {
      return
    }

    let cancelled = false
    setLastSpokenAssistantId(lastAssistant.id)
    setIsAssistantSpeaking(true)

    const speakAsync = async () => {
      try {
        await handleTextToSpeech(lastAssistant.content)
      } catch (error) {
        console.error("Auto TTS error:", error)
      } finally {
        if (!cancelled) {
          setIsAssistantSpeaking(false)
        }
      }
    }

    speakAsync()

    return () => {
      cancelled = true
      setIsAssistantSpeaking(false)
    }
  }, [
    chatState.messages,
    chatState.isProcessing,
    handleTextToSpeech,
    isHandsFree,
    lastSpokenAssistantId
  ])

  return (
    <>
      {/* Chat messages area */}
      <div className="comic-scroll bg-dots flex-1 space-y-6 overflow-y-auto border-t-4 border-ink bg-white bg-halftone-light p-4 dark:bg-slate-800 dark:bg-halftone-dark">
        {/* Conversation title */}
        {conversationTitle && (
          <div className="mb-4 pb-3 border-b-2 border-ink dark:border-white">
            <h2 className="font-body text-lg font-bold text-ink dark:text-white">
              {conversationTitle}
            </h2>
          </div>
        )}
        {/* Welcome message if no messages */}
        {chatState.messages.length === 0 && (
          <div className="flex w-full justify-start">
            <div className="relative max-w-[90%]">
              <div className="absolute -left-2 top-6 z-10 h-5 w-5 rotate-45 border-l-2 border-b-2 border-ink bg-white dark:bg-slate-700" />
              <div className="relative z-20 rounded-xl border-2 border-ink bg-white p-5 text-ink shadow-comic dark:bg-slate-700 dark:text-white">
                <p className="font-body text-xl font-bold leading-snug">
                  Greetings, Traveler! I am your{" "}
                  <span className="text-blue-600 dark:text-blue-400">
                    Silver Assistant
                  </span>
                  . How can I help you navigate the cosmos of the internet today?
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {chatState.messages.map((message) => (
          message.role === "user" ? (
            <UserMessage key={message.id} message={message} />
          ) : (
            <AssistantMessage key={message.id} message={message} onSpeak={speakMessage} />
          )
        ))}

        {/* Loading indicator */}
        {chatState.isProcessing && <LoadingMessage />}

        {/* Conversation complete indicator */}
        {chatState.isComplete && chatState.messages.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={handleNewConversation}
              className="transform rounded-full border-2 border-ink bg-green-100 py-2 px-4 text-base font-bold text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-green-900 dark:text-white"
            >
              <span className="flex items-center gap-2">
                <span className="material-icons-outlined">add_circle</span>
                Start New Conversation
              </span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Footer input */}
      <div className="relative z-20 shrink-0 border-t-4 border-ink bg-gray-100 p-4 dark:bg-slate-900">
        <div className="flex items-end gap-3">
          <button
            onClick={handleHandsFreeToggle}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-ink shadow-comic transition-colors ${isHandsFree ? 'bg-yellow-300 text-ink animate-pulse' : 'bg-white text-ink dark:bg-slate-800 dark:text-white'}`}
            title={isHandsFree ? "Disable hands-free conversation" : "Enable hands-free conversation"}
          >
            <span className="material-icons-outlined text-2xl">
              {isHandsFree ? 'hearing' : 'hearing_disabled'}
            </span>
          </button>
          <button
            onClick={isRecording ? handleStopRecording : () => handleStartRecording(false)}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-ink shadow-comic ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white dark:bg-slate-800'}`}
            title={isRecording ? "Stop recording" : "Record voice"}
          >
            <span className="material-icons-outlined text-2xl">
              {isRecording ? 'stop' : 'mic'}
            </span>
          </button>
          <div className="flex h-14 flex-1 items-center rounded-xl border-2 border-ink bg-white shadow-comic transition-all focus-within:translate-x-[2px] focus-within:translate-y-[2px] focus-within:shadow-comic-hover dark:bg-slate-800">
            <input
              className="h-full w-full border-none bg-transparent p-4 text-lg font-bold text-ink placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-white"
              placeholder="Type your message..."
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={chatState.isProcessing}
            />
          </div>
          <button
            aria-label="Send message"
            onClick={handleSendMessage}
            disabled={chatState.isProcessing || !inputValue.trim()}
            className="group flex h-14 w-14 items-center justify-center rounded-xl border-2 border-ink bg-primary text-white shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons-outlined text-3xl transition-transform group-hover:scale-110">
              send
            </span>
          </button>
        </div>

        {isHandsFree && (
          <p className="mt-2 text-center text-sm font-bold text-ink dark:text-white">
            Hands-free mode active. Speak when the mic indicator glows.
          </p>
        )}

        <div className="mt-3 text-center">
          <p className="font-display text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Powered by Silver Surfer AI
          </p>
        </div>
      </div>
    </>
  )
}
