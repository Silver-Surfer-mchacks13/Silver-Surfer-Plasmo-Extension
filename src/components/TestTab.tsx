// src/components/TestTab.tsx  (History / Past Chats)
import { useEffect, useMemo, useState } from "react"
import { getConversations } from "~lib/conversation-api"
import type { ConversationSummary } from "~types/conversation"

const PENDING_SESSION_KEY = "pending_session_id"
const START_NEW_CONVERSATION_KEY = "start_new_conversation"
const ACTIVE_CHAT_SESSION_KEY = "active_chat_session_id"

// Helper to save sessionId for Chat tab to load
async function savePendingSessionId(sessionId: string | null) {
  try {
    if (sessionId) {
      await chrome.storage.local.set({ [PENDING_SESSION_KEY]: sessionId })
    } else {
      await chrome.storage.local.remove([PENDING_SESSION_KEY])
    }
  } catch {
    // ignore
  }
}

// Helper to check if there's an active conversation in Chat tab
async function hasActiveChatConversation(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get([ACTIVE_CHAT_SESSION_KEY])
    return result[ACTIVE_CHAT_SESSION_KEY] !== undefined && result[ACTIVE_CHAT_SESSION_KEY] !== null
  } catch {
    return false
  }
}

// Helper to request a new conversation in Chat tab
async function requestNewConversation() {
  try {
    await chrome.storage.local.set({ [START_NEW_CONVERSATION_KEY]: true })
  } catch {
    // ignore
  }
}

/* ------------------ component ------------------ */
interface TestTabProps {
  onLoadInChat?: () => void
}

export default function TestTab({ onLoadInChat }: TestTabProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasActiveChat, setHasActiveChat] = useState(false)

  const refresh = async () => {
    setIsLoading(true)
    setError(null)

    const result = await getConversations()

    if (!result.success) {
      setError(result.error || "Failed to load conversations")
      setIsLoading(false)
      return
    }

    const sorted = (result.data || []).sort((a, b) => {
      return new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime()
    })

    setConversations(sorted)
    setIsLoading(false)
  }

  const handleConversationClick = async (sessionId: string) => {
    // Save sessionId for Chat tab to load
    await savePendingSessionId(sessionId)
    // Switch to Chat tab if callback provided
    if (onLoadInChat) {
      onLoadInChat()
    }
  }

  useEffect(() => {
    refresh()

    // Check if there's an active conversation in Chat tab
    const checkActiveChat = async () => {
      const hasActive = await hasActiveChatConversation()
      setHasActiveChat(hasActive)
    }
    checkActiveChat()

    // Listen for changes to active chat session
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "local" && changes[ACTIVE_CHAT_SESSION_KEY]) {
        const hasActive = changes[ACTIVE_CHAT_SESSION_KEY].newValue !== undefined &&
          changes[ACTIVE_CHAT_SESSION_KEY].newValue !== null
        setHasActiveChat(hasActive)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const handleNewConversation = async () => {
    if (!hasActiveChat) {
      return // Do nothing if there's no active conversation
    }
    await requestNewConversation()
    if (onLoadInChat) {
      onLoadInChat()
    }
  }

  const noConversations = !isLoading && conversations.length === 0

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  // Get preview text from conversation (last message or title)
  const getPreview = (conv: ConversationSummary) => {
    // We don't have message preview in summary, so use title
    return conv.Title
  }

  return (
    <div className="comic-scroll bg-dots flex-1 overflow-y-auto border-t-4 border-ink bg-white bg-halftone-light p-4 dark:bg-slate-800 dark:bg-halftone-dark">
      {/* Top controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
        <div>
          <h3 className="font-display text-xl uppercase tracking-wider text-ink dark:text-white">
            Chat History
          </h3>
          <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
            Click a conversation to continue it in Chat
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNewConversation}
            disabled={!hasActiveChat}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-green-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover disabled:opacity-50 disabled:cursor-not-allowed dark:bg-green-900 dark:text-white">
            <span className="material-icons-outlined text-lg">add_circle</span>
            <span className="text-sm">New Conversation</span>
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-gray-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-600 dark:text-white">
            <span className="material-icons-outlined text-lg">refresh</span>
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border-2 border-ink bg-red-100 p-3 shadow-comic dark:bg-red-900/40">
          <p className="font-bold text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading / empty / main */}
      {isLoading ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">Loading conversations…</p>
        </div>
      ) : noConversations ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">
            No history yet — send a message in Chat!
          </p>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
          <h4 className="mb-2 font-display text-lg uppercase tracking-wider text-ink dark:text-white">
            Conversations
          </h4>

          <div className="comic-scroll max-h-[600px] overflow-y-auto pr-1 space-y-2">
            {conversations.map((conv) => {
              const preview = getPreview(conv)
              const isCompleted = conv.CompletedAt !== null

              return (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv.id)}
                  className={[
                    "w-full rounded-lg border-2 border-ink p-3 text-left shadow-comic transition-all",
                    "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover",
                    "bg-gray-50 dark:bg-slate-600"
                  ].join(" ")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-lg">history</span>
                        <p className="truncate font-bold text-ink dark:text-white">{conv.Title}</p>
                        {isCompleted && (
                          <span className="shrink-0 rounded border border-ink bg-green-100 px-1 text-[10px] font-bold text-ink dark:bg-green-900/40 dark:text-white">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-gray-600 dark:text-gray-200">
                        {preview}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-gray-500 dark:text-gray-300">
                        Updated: {formatDate(conv.UpdatedAt)}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="h-6" />
    </div>
  )
}
