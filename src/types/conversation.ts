// src/types/conversation.ts
// Types for the Conversations API

// Action types returned by the API
export type ActionType = "click" | "wait" | "message" | "complete"

interface BaseAction {
  timestamp: string
  reasoning?: string
}

export interface ClickAction extends BaseAction {
  action_type: "click"
  x_path: string
}

export interface WaitAction extends BaseAction {
  action_type: "wait"
  duration: number
}

export interface MessageAction extends BaseAction {
  action_type: "message"
  message: string
}

export interface CompleteAction extends BaseAction {
  action_type: "complete"
  message: string
}

export type ConversationAction = ClickAction | WaitAction | MessageAction | CompleteAction

// API Request/Response types
export interface PageState {
  url: string
  html: string
  screenshot: string
}

export interface ConversationRequest {
  session_id?: string
  title: string
  page_state: PageState
}

export interface ConversationResponse {
  session_id: string
  actions: ConversationAction[]
  complete: boolean
}

// Chat UI types
export type ChatMessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  timestamp: Date
  actions?: ConversationAction[]
  isLoading?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  sessionId: string | null
  isProcessing: boolean
  isComplete: boolean
}
