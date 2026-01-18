// src/components/TestTab.tsx  (now: History / Past Chats)
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

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function makeThread(title: string, baseTs: number, lines: Array<[ChatMessage["role"], string]>): ChatThread {
  const messages: ChatMessage[] = lines.map(([role, text], i) => ({
    id: uid("msg"),
    role,
    text,
    ts: baseTs + i * 60_000 // +1 minute each
  }))

  return {
    id: uid("thread"),
    title,
    updatedAt: messages[messages.length - 1]?.ts ?? baseTs,
    messages
  }
}

function buildDemoThreads(): ChatThread[] {
  const now = Date.now()

  const t1 = makeThread("Make this page readable", now - 1000 * 60 * 60 * 20, [
    ["assistant", "Greetings, Traveler! I’m your Silver Assistant. What do you want to do on this page?"],
    ["user", "The text is tiny. Can you make it bigger?"],
    ["assistant", "Absolutely. I can increase text size for the whole page or only headings. Which one?"],
    ["user", "Whole page please."],
    ["assistant", "Done — boosted text by 20%. Want even bigger or reset?"],
    ["user", "Even bigger, but don’t break layout."],
    ["assistant", "Okay — increasing carefully (line-height + spacing)."],
    ["assistant", "Applied +30% with safe line-height. If anything looks weird, hit Reset."],
    ["user", "Nice. Can you also highlight the main headline?"],
    ["assistant", "Sure — highlighting the first h1 on the page."],
    ["assistant", "Highlighted ✅  (Tip: use selector `h1` in the Test/History tools.)"],
    ["user", "Now remove clutter (ads / popups)."],
    ["assistant", "Removing common clutter: sticky banners, overlays, sidebars, ad containers."],
    ["assistant", "Clutter removed ✅. If something important disappeared, I can restore it."],
    ["user", "Cool. Read this page to me next."],
    ["assistant", "Voice mode coming up next — for now I can summarize sections and walk you through links."]
  ])

  const t2 = makeThread("Checkout help on shopping site", now - 1000 * 60 * 60 * 8, [
    ["assistant", "What are we trying to do?"],
    ["user", "I’m stuck at checkout. There’s a form and it won’t submit."],
    ["assistant", "I can help. First, I’ll scroll to the checkout form."],
    ["assistant", "Scrolled to `form` ✅. Do you see the red error message?"],
    ["user", "Yeah it says phone number required."],
    ["assistant", "Got it. I can fill it if you tell me the value or you can type it and I’ll click submit."],
    ["user", "Fill 5141234567 in the phone input."],
    ["assistant", "Filling `input[type='tel']` with that value."],
    ["assistant", "Filled ✅. Want me to click the Submit / Place Order button?"],
    ["user", "Yes click it."],
    ["assistant", "Clicking the primary submit button now."],
    ["assistant", "Clicked ✅. If nothing happens, we’ll check for disabled states or validation."]
  ])

  // A LONG thread for scrollbar testing
  const longLines: Array<[ChatMessage["role"], string]> = [
    ["assistant", "Welcome to the Test Lab — but in comic mode 😄"],
    ["user", "I want to learn how selectors work."],
    ["assistant", "Awesome. Selectors are like “targets” on the page. Example: `h1`, `.classname`, `#id`."],
    ["user", "Give me a few practice ones."],
    ["assistant", "Try these:\n1) `h1`\n2) `p`\n3) `a`\n4) `button`\n5) `input[type='text']`"],
    ["user", "What about selecting a nav bar?"],
    ["assistant", "Often it’s `nav` or something like `header nav`. You can also inspect the DOM."],
    ["user", "Can I highlight multiple things?"],
    ["assistant", "For now, we highlight the first match. Later we can support `querySelectorAll`."],
    ["user", "Okay. Can you scroll to the footer?"],
    ["assistant", "Yes — selectors like `footer` are perfect."],
    ["assistant", "If a selector doesn’t exist, I’ll return an error with a hint."],
    ["user", "How do I reset everything?"],
    ["assistant", "We’ll have reset actions for highlights, magnification, and clutter restore."],
    ["user", "This is great. Add more tips."],
    ["assistant", "More tips:\n- Use `.btn` to select class\n- Use `#main` for IDs\n- Use attribute selectors: `[role='dialog']`\n- Combine: `main article h2`"],
    ["user", "What if the page is dynamic?"],
    ["assistant", "Then we may need to wait for elements to load or use mutation observers."],
    ["user", "How do you avoid breaking the page when increasing text?"],
    ["assistant", "We scale font-size gradually and also tune line-height + spacing."],
    ["user", "Add more messages so I can test the scrollbar."],
    ["assistant", "Say less 😄 Here comes a scroll wall of messages…"],
  ]

  // Add many filler pairs
  for (let i = 1; i <= 22; i++) {
    longLines.push(["user", `Scroll test message #${i}: Can you keep the UI consistent across tabs?`])
    longLines.push(["assistant", `Yep. Using shared comic borders, shadows, and the same speech bubble structure. (#${i})`])
  }

  const t3 = makeThread("Selectors + Scrollbar Stress Test", now - 1000 * 60 * 60 * 2, longLines)

  return [t1, t2, t3].sort((a, b) => b.updatedAt - a.updatedAt)
}

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

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  )

  const refresh = async () => {
    setIsLoading(true)

    let loaded = await loadThreads()

    // If empty, auto-seed once so you can demo immediately
    if (loaded.length === 0) {
      loaded = buildDemoThreads()
      await saveThreads(loaded)
    }

    const savedActive = await loadActiveThreadId()
    const fallbackActive = savedActive && loaded.some((t) => t.id === savedActive)
      ? savedActive
      : loaded[0]?.id ?? null

    setThreads(loaded.sort((a, b) => b.updatedAt - a.updatedAt))
    setActiveId(fallbackActive)
    if (fallbackActive) await saveActiveThreadId(fallbackActive)

    setIsLoading(false)
  }

  const seedDemo = async () => {
    const demo = buildDemoThreads()
    await saveThreads(demo)
    await saveActiveThreadId(demo[0]?.id ?? "")
    await refresh()
  }

  const clearAll = async () => {
    await saveThreads([])
    await saveActiveThreadId("")
    await refresh()
  }

  useEffect(() => {
    refresh()

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return
      if (changes[STORAGE_KEY] || changes[ACTIVE_KEY]) refresh()
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-gray-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white"
          >
            <span className="material-icons-outlined text-lg">refresh</span>
            <span className="text-sm">Refresh</span>
          </button>

          <button
            onClick={seedDemo}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-yellow-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-yellow-900/40 dark:text-white"
          >
            <span className="material-icons-outlined text-lg">auto_fix_high</span>
            <span className="text-sm">Seed Demo</span>
          </button>

          <button
            onClick={clearAll}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-red-100 px-3 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-red-900/40 dark:text-white"
          >
            <span className="material-icons-outlined text-lg">delete</span>
            <span className="text-sm">Clear</span>
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="rounded-lg border-2 border-ink bg-white p-4 text-center shadow-comic dark:bg-slate-700">
          <p className="font-bold text-gray-600 dark:text-gray-300">Loading…</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Thread list */}
          <div className="rounded-lg border-2 border-ink bg-white p-3 shadow-comic dark:bg-slate-700">
            <h4 className="mb-2 font-display text-lg uppercase tracking-wider text-ink dark:text-white">
              Threads
            </h4>

            <div className="space-y-2">
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
                      active
                        ? "bg-blue-100 dark:bg-blue-900"
                        : "bg-gray-50 dark:bg-slate-600"
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="material-icons-outlined text-lg">
                            history
                          </span>
                          <p className="truncate font-bold text-ink dark:text-white">
                            {t.title}
                          </p>
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
                {activeThread ? activeThread.title : "No thread selected"}
              </h4>
              <div className="text-xs font-bold text-gray-600 dark:text-gray-200">
                {activeThread ? `${activeThread.messages.length} messages` : ""}
              </div>
            </div>

            {!activeThread ? (
              <div className="rounded-lg border-2 border-ink bg-gray-50 p-4 text-center dark:bg-slate-600">
                <p className="font-bold text-gray-600 dark:text-gray-200">
                  Pick a thread to view its chat history.
                </p>
              </div>
            ) : (
              <div className="comic-scroll max-h-[420px] overflow-y-auto pr-1 space-y-4">
                {activeThread.messages.map((m) => {
                  const isUser = m.role === "user"
                  return (
                    <div key={m.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className="relative max-w-[95%]">
                        {/* Tail */}
                        <div
                          className={[
                            "absolute top-6 z-10 h-5 w-5 border-b-2 border-ink",
                            isUser
                              ? "-right-2 -rotate-45 border-r-2 bg-blue-100 dark:bg-blue-900"
                              : "-left-2 rotate-45 border-l-2 bg-white dark:bg-slate-700"
                          ].join(" ")}
                        />

                        {/* Bubble */}
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
