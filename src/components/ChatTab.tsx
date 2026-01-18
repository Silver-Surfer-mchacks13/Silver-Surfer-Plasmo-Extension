// src/components/ChatTab.tsx
// Chat interface component that integrates with the Conversations API

import { useState, useRef, useEffect, useCallback } from "react"
import { sendConversationMessage, getCurrentPageState } from "~lib/conversation-api"
import type { ChatMessage, ConversationAction, ChatState } from "~types/conversation"

const HANDS_FREE_SEGMENT_MS = 7000

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function ActionBadge({ action }: { action: ConversationAction }) {
  const getActionInfo = () => {
    switch (action.action_type) {
      case "click":
        return { icon: "touch_app", label: "Click", color: "bg-orange-100 dark:bg-orange-900" }
      case "wait":
        return { icon: "hourglass_empty", label: `Wait ${action.duration}s`, color: "bg-purple-100 dark:bg-purple-900" }
      case "message":
        return { icon: "chat", label: "Message", color: "bg-blue-100 dark:bg-blue-900" }
      case "complete":
        return { icon: "check_circle", label: "Complete", color: "bg-green-100 dark:bg-green-900" }
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
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isHandsFree, setIsHandsFree] = useState(false)
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)
  const [lastSpokenAssistantId, setLastSpokenAssistantId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const handsFreeStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        audio.onended = resolve
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

  const speakMessage = useCallback((text: string) => {
    handleTextToSpeech(text).catch((err) => console.error("Text-to-speech failed:", err))
  }, [handleTextToSpeech])

  const handleStartRecording = useCallback(async () => {
    if (isRecording || chatState.isProcessing) {
      return false
    }

    setIsRecording(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: "start-recording" })
      if (response?.success === false) {
        setIsRecording(false)
        return false
      }
      return true
    } catch (error) {
      console.error("Start recording error:", error)
      setIsRecording(false)
      return false
    }
  }, [chatState.isProcessing, isRecording])

  const handleStopRecording = useCallback(async () => {
    if (!isRecording) {
      return false
    }

    clearHandsFreeTimer()
    setIsRecording(false)
    try {
      await chrome.runtime.sendMessage({ type: "stop-recording" })
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
      isProcessing: true
    }))

    try {
      const pageData = await getCurrentPageState()

      const response = await sendConversationMessage(
        trimmedInput,
        chatState.sessionId,
        pageData?.pageState,
        pageData?.title
      )

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

      const { session_id, actions, complete } = response.data

      const messageActions = actions.filter(
        (a) => a.action_type === "message" || a.action_type === "complete"
      )

      const assistantMessages: ChatMessage[] = messageActions.map((action) => ({
        id: generateId(),
        role: "assistant" as const,
        content: action.action_type === "message" || action.action_type === "complete"
          ? action.message
          : "",
        timestamp: new Date(action.timestamp),
        actions: actions.filter((a) => a.action_type !== "message" && a.action_type !== "complete")
      }))

      if (assistantMessages.length === 0 && actions.length > 0) {
        assistantMessages.push({
          id: generateId(),
          role: "assistant",
          content: "I'm working on your request...",
          timestamp: new Date(),
          actions
        })
      }

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...assistantMessages],
        sessionId: session_id,
        isProcessing: false,
        isComplete: complete
      }))
    } catch (error) {
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
    setInputValue("")
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
      if (msg.type === "transcription-result") {
        clearHandsFreeTimer()
        setIsRecording(false)

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

  useEffect(() => {
    if (!isHandsFree || isRecording || chatState.isProcessing || isAssistantSpeaking) {
      return
    }

    let cancelled = false

    const startAsync = async () => {
      const started = await handleStartRecording()
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
            onClick={isRecording ? handleStopRecording : handleStartRecording}
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
