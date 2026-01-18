// src/components/TestTab.tsx  (History / Past Chats)
import { useEffect, useMemo, useState } from "react"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  ts: number
}

type ChatThread = {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

const STORAGE_KEY = "silver_chat_threads"
const ACTIVE_KEY = "silver_chat_active_thread"

async function loadThreads(): Promise<ChatThread[]> {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY])
    return Array.isArray(res[STORAGE_KEY]) ? (res[STORAGE_KEY] as ChatThread[]) : []
  } catch {
    return []
  }
}

async function saveThreads(threads: ChatThread[]) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: threads })
  } catch {
    // ignore
  }
}

async function loadActiveThreadId(): Promise<string | null> {
  try {
    const res = await chrome.storage.local.get([ACTIVE_KEY])
    return typeof res[ACTIVE_KEY] === "string" ? (res[ACTIVE_KEY] as string) : null
  } catch {
    return null
  }
}

async function saveActiveThreadId(id: string) {
  try {
    await chrome.storage.local.set({ [ACTIVE_KEY]: id })
  } catch {
    // ignore
  }
}

export default function TestTab() {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Clear UI state
  const [clearOpen, setClearOpen] = useState(false)
  const [selectedToClear, setSelectedToClear] = useState<Record<string, boolean>>({})

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  )

  const refresh = async () => {
    setIsLoading(true)

    const loaded = await loadThreads()
    const sorted = loaded.sort((a, b) => b.updatedAt - a.updatedAt)

    const savedActive = await loadActiveThreadId()
    const fallbackActive =
      savedActive && sorted.some((t) => t.id === savedActive) ? savedActive : null

    setThreads(sorted)
    setActiveId(fallbackActive)

    // Sync selection map with threads
    const map: Record<string, boolean> = {}
    for (const t of sorted) map[t.id] = false
    setSelectedToClear(map)

    setIsLoading(false)
  }

  const openClearDialog = () => {
    const map: Record<string, boolean> = {}
    for (const t of threads) map[t.id] = false
    setSelectedToClear(map)
    setClearOpen(true)
  }

  const selectAll = (val: boolean) => {
    const next: Record<string, boolean> = {}
    for (const t of threads) next[t.id] = val
    setSelectedToClear(next)
  }

  const confirmClearSelected = async () => {
    const ids = Object.entries(selectedToClear)
      .filter(([, v]) => v)
      .map(([k]) => k)

    // If nothing selected, don't clear; keep dialog open
    if (ids.length === 0) return

    const remaining = threads.filter((t) => !ids.includes(t.id))
    await saveThreads(remaining)

    const nextActive =
      remaining.some((t) => t.id === activeId) ? activeId : null

    await saveActiveThreadId(nextActive ?? "")
    setClearOpen(false)
    await refresh()
  }

  useEffect(() => {
    refresh()

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return
      if (changes[STORAGE_KEY] || changes[ACTIVE_KEY]) refresh()
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const noThreads = !isLoading && threads.length === 0
  const noSelection = !isLoading && threads.length > 0 && !activeThread

  return (
    <div className="comic-scroll bg-dots flex-1 overflow-y-auto border-t-4 border-ink bg-white bg-halftone-light p-4 dark:bg-slate-800 dark:bg-halftone-dark">
      {/* Top controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
        <div>
          <h3 className="font-display text-xl uppercase tracking-wider text-ink dark:text-white">
            Chat History
          </h3>
          <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
            Click a thread to view its messages
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-gray-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white">
            <span className="material-icons-outlined text-lg">refresh</span>
            <span className="text-sm">Refresh</span>
          </button>

          <button
            onClick={openClearDialog}
            disabled={threads.length === 0}
            className={[
              "flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink px-3 font-bold shadow-comic transition-all",
              "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover",
              "bg-red-100 text-ink dark:bg-red-900/40 dark:text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            ].join(" ")}>
            <span className="material-icons-outlined text-lg">delete</span>
            <span className="text-sm">Clear</span>
          </button>
        </div>
      </div>

      {/* Clear modal (checkbox selection) */}
      {clearOpen && (
        <div className="mb-4 rounded-lg border-2 border-ink bg-white p-4 shadow-comic dark:bg-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-display text-lg uppercase tracking-wider text-ink dark:text-white">
                Clear chats
              </h4>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                Select which threads to delete (or select all).
              </p>
            </div>

            <button
              onClick={() => setClearOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-gray-100 text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white"
              aria-label="Close clear dialog">
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => selectAll(true)}
              className="rounded-lg border-2 border-ink bg-blue-100 px-3 py-2 text-xs font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-blue-900/40 dark:text-white">
              Select all
            </button>
            <button
              onClick={() => selectAll(false)}
              className="rounded-lg border-2 border-ink bg-gray-100 px-3 py-2 text-xs font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white">
              Select none
            </button>
          </div>

          <div className="mt-4 max-h-48 overflow-y-auto pr-1 comic-scroll space-y-2">
            {threads.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-ink bg-gray-50 p-3 shadow-comic dark:bg-slate-600">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink dark:text-white">
                    {t.title}
                  </p>
                  <p className="line-clamp-2 text-xs font-bold text-gray-600 dark:text-gray-200">
                    {t.messages[t.messages.length - 1]?.text ?? ""}
                  </p>
                </div>

                <input
                  type="checkbox"
                  className="h-5 w-5 accent-blue-600"
                  checked={!!selectedToClear[t.id]}
                  onChange={(e) =>
                    setSelectedToClear((prev) => ({ ...prev, [t.id]: e.target.checked }))
                  }
                />
              </label>
            ))}
          </div>

          {/* Message when none selected */}
          {Object.values(selectedToClear).every((v) => !v) && (
            <p className="mt-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300">
              Please select a chat to clear.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setClearOpen(false)}
              className="flex-1 rounded-lg border-2 border-ink bg-gray-100 px-3 py-3 text-sm font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white">
              Cancel
            </button>

            <button
              onClick={confirmClearSelected}
              className="flex-1 rounded-lg border-2 border-ink bg-red-200 px-3 py-3 text-sm font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-red-900/40 dark:text-white">
              Clear selected
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">Loading…</p>
        </div>
      ) : noThreads ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">
            No history yet — send a message in Chat!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Thread list (scrollable) */}
          <div className="rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
            <h4 className="mb-2 font-display text-lg uppercase tracking-wider text-ink dark:text-white">
              Threads
            </h4>

            <div className="comic-scroll max-h-56 overflow-y-auto pr-1 space-y-2">
              {threads.map((t) => {
                const active = t.id === activeId
                const preview = t.messages[t.messages.length - 1]?.text ?? ""

                return (
                  <button
                    key={t.id}
                    onClick={async () => {
                      setActiveId(t.id)
                      await saveActiveThreadId(t.id)
                    }}
                    className={[
                      "w-full rounded-lg border-2 border-ink p-3 text-left shadow-comic transition-all",
                      "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover",
                      active ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-50 dark:bg-slate-600"
                    ].join(" ")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="material-icons-outlined text-lg">history</span>
                          <p className="truncate font-bold text-ink dark:text-white">{t.title}</p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-bold text-gray-600 dark:text-gray-200">
                          {preview}
                        </p>
                      </div>

                      <div className="shrink-0 text-[10px] font-bold text-gray-500 dark:text-gray-200">
                        {new Date(t.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Messages */}
          <div className="rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="font-display text-lg uppercase tracking-wider text-ink dark:text-white">
                {activeThread ? activeThread.title : "History"}
              </h4>
              <div className="text-xs font-bold text-gray-600 dark:text-gray-200">
                {activeThread ? `${activeThread.messages.length} messages` : ""}
              </div>
            </div>

            {noSelection ? (
              <div className="rounded-lg border-2 border-ink bg-gray-50 p-4 text-center dark:bg-slate-600">
                <p className="font-bold text-gray-600 dark:text-gray-200">
                  Please select a message to view past history messages.
                </p>
              </div>
            ) : (
              <div className="comic-scroll max-h-[420px] overflow-y-auto pr-1 space-y-4">
                {activeThread?.messages.map((m) => {
                  const isUser = m.role === "user"
                  return (
                    <div key={m.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className="relative max-w-[95%]">
                        <div
                          className={[
                            "absolute top-6 z-10 h-5 w-5 border-b-2 border-ink",
                            isUser
                              ? "-right-2 -rotate-45 border-r-2 bg-blue-100 dark:bg-blue-900"
                              : "-left-2 rotate-45 border-l-2 bg-white dark:bg-slate-700"
                          ].join(" ")}
                        />

                        <div
                          className={[
                            "relative z-20 rounded-xl border-2 border-ink p-4 shadow-comic",
                            isUser
                              ? "bg-blue-100 text-ink dark:bg-blue-900 dark:text-white"
                              : "bg-white text-ink dark:bg-slate-700 dark:text-white"
                          ].join(" ")}
                        >
                          <p className="whitespace-pre-wrap font-body text-base font-bold leading-snug">
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
          </div>
        </div>
      )}

      <div className="h-6" />
    </div>
  )
}
