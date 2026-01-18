// src/components/TestTab.tsx  (repurposed to "History")
import { useEffect, useMemo, useState } from "react"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  ts: number
}

const STORAGE_KEY = "silver_chat_history"

async function loadHistory(): Promise<ChatMessage[]> {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY])
    return Array.isArray(res[STORAGE_KEY]) ? (res[STORAGE_KEY] as ChatMessage[]) : []
  } catch {
    return []
  }
}

async function clearHistory() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] })
  } catch {
    // ignore
  }
}

export default function TestTab() {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = async () => {
    setIsLoading(true)
    const data = await loadHistory()
    // newest at bottom (chat-like)
    setHistory(data.sort((a, b) => a.ts - b.ts))
    setIsLoading(false)
  }

  useEffect(() => {
    refresh()

    // live-ish updates when storage changes (helpful during demo)
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return
      if (changes[STORAGE_KEY]) refresh()
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = useMemo(() => {
    // optional: you can group by day later
    return history
  }, [history])

  return (
    <div className="comic-scroll bg-dots flex-1 overflow-y-auto border-t-4 border-ink bg-white bg-halftone-light p-4 dark:bg-slate-800 dark:bg-halftone-dark">
      {/* Header row (same card language as other pages) */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
        <div>
          <h3 className="font-display text-xl uppercase tracking-wider text-ink dark:text-white">
            Chat History
          </h3>
          <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
            Past conversations from the Chat tab
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-gray-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white"
          >
            <span className="material-icons-outlined text-lg">refresh</span>
            <span className="text-sm">Refresh</span>
          </button>

          <button
            onClick={async () => {
              await clearHistory()
              await refresh()
            }}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-red-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-red-900/40 dark:text-white"
          >
            <span className="material-icons-outlined text-lg">delete</span>
            <span className="text-sm">Clear</span>
          </button>
        </div>
      </div>

      {/* Empty / Loading */}
      {isLoading ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">Loading history…</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">
            No history yet — send a message in Chat!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((m) => {
            const isUser = m.role === "user"
            return (
              <div key={m.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                <div className="relative max-w-[95%]">
                  {/* tail */}
                  <div
                    className={[
                      "absolute top-6 z-10 h-5 w-5 border-b-2 border-ink",
                      isUser
                        ? "-right-2 -rotate-45 border-r-2 bg-blue-100 dark:bg-blue-900"
                        : "-left-2 rotate-45 border-l-2 bg-white dark:bg-slate-700"
                    ].join(" ")}
                  />

                  {/* bubble */}
                  <div
                    className={[
                      "relative z-20 rounded-xl border-2 border-ink p-4 shadow-comic",
                      isUser
                        ? "bg-blue-100 text-ink dark:bg-blue-900 dark:text-white"
                        : "bg-white text-ink dark:bg-slate-700 dark:text-white"
                    ].join(" ")}
                  >
                    <p className="font-body text-base font-bold leading-snug whitespace-pre-wrap">
                      {m.text}
                    </p>
                    <div className="mt-2 text-right text-[10px] font-bold text-gray-500 dark:text-gray-300">
                      {new Date(m.ts).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="h-6" />
    </div>
  )
}
