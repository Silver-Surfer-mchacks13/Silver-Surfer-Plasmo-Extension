// src/sidepanel.tsx
import { useEffect, useMemo, useState } from "react"
import LoginPage from "~components/LoginPage"
import type { AuthState, AuthUser } from "~lib/auth-service"
import "./style.css"
import SettingsTab from "./components/settings_tab"
import TestTab from "./components/TestTab"
import ChatTab from "./components/ChatTab"
import SimplifyTab from "./components/SimplifyTab"
import logo from "data-base64:~assets/final_logo.svg"

declare global {
  interface Window {
    __silverOffscreenBootstrapped?: boolean
  }
}

const isOffscreenDocument = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("offscreen") === "1"

if (isOffscreenDocument && typeof window !== "undefined" && !window.__silverOffscreenBootstrapped) {
  window.__silverOffscreenBootstrapped = true
  import("./offscreen-runtime")
    .then(({ initializeOffscreenRecorder }) => initializeOffscreenRecorder())
    .catch((error) => console.error("Failed to initialize offscreen recorder:", error))
}

export default function SidePanel() {
  if (isOffscreenDocument) {
    return null
  }

  const [dark, setDark] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    backendAccessToken: null,
    backendRefreshToken: null
  })

  // Check auth state and theme on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "AUTH_GET_STATE" }, (response) => {
      if (response?.success && response.data) {
        setAuthState(response.data)
      }
      setIsLoading(false)
    })

    // Load dark mode preference
    chrome.storage.local.get("darkMode", (res) => {
      if (res.darkMode !== undefined) {
        setDark(res.darkMode)
      }
    })
  }, [])

  const toggleDark = () => {
    setDark((prev) => {
      const newVal = !prev
      chrome.storage.local.set({ darkMode: newVal })
      return newVal
    })
  }

  const handleLogin = async () => {
    return new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "AUTH_LOGIN" }, (response) => {
        if (response?.success && response.data) {
          setAuthState(response.data)
          resolve()
        } else {
          reject(new Error(response?.error || "Login failed"))
        }
      })
    })
  }

  const handleLogout = () => {
    chrome.runtime.sendMessage({ action: "AUTH_LOGOUT" }, (response) => {
      if (response?.success) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          backendAccessToken: null,
          backendRefreshToken: null
        })
      }
    })
  }
  const [tab, setTab] = useState<"chat" | "simplify" | "settings" | "history">("chat")

  const rootClass = useMemo(
    () =>
      [
        dark ? "dark" : "",
        "min-h-screen w-full font-body transition-colors duration-300",
        "bg-gray-100 dark:bg-slate-900",
        "p-3"
      ].join(" "),
    [dark]
  )

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <span className="material-icons-outlined animate-spin text-5xl text-blue-500">
            autorenew
          </span>
          <p className="font-display text-xl text-gray-600 dark:text-gray-300">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!authState.isAuthenticated) {
    return <LoginPage onLogin={handleLogin} isDark={dark} toggleDark={toggleDark} />
  }

  // Show main app if authenticated
  return (
    <div className={rootClass}>
      <div className="mx-auto flex h-[calc(100vh-24px)] w-full max-w-md flex-col overflow-hidden rounded-lg border-4 border-ink bg-white shadow-comic-lg transition-colors duration-300 dark:bg-slate-800">
        {/* Header */}
        <div className="relative z-20 shrink-0 border-b-4 border-ink bg-white p-4 pb-0 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between px-2">
            <div className="flex items-center space-x-3">
              <div className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-white shadow-comic">
                <img
                  src={logo}
                  alt="Silver Surfer"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-col justify-center">
                <h1 className="font-display text-4xl leading-none tracking-wide text-transparent drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">
                  SILVER SURFER
                </h1>
                <div className="flex items-center gap-2">
                  <span className="inline-block -rotate-2 border border-black bg-yellow-300 px-1 text-xs font-bold text-black">
                    ISSUE #1
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {tab === "chat" ? "Assistant" : tab === "simplify" ? "Simplify" : tab === "settings" ? "Settings" : "Test Lab"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {authState.user?.name || authState.user?.email || "User"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-gray-200 text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-slate-700 dark:text-white"
                onClick={toggleDark}
                aria-label="Toggle dark mode">
                <span className="material-icons-outlined">brightness_4</span>
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-red-100 text-red-600 shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-red-900 dark:text-red-300"
                onClick={handleLogout}
                aria-label="Logout">
                <span className="material-icons-outlined">logout</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex space-x-0 px-1">
            <div className="relative flex-1">
              <button
                onClick={() => setTab("chat")}
                className={`w-full rounded-t-lg py-2 px-1 text-sm font-bold transition-colors ${tab === "chat"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-primary text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-wide">
                  <span className="material-icons-outlined text-base">
                    chat_bubble
                  </span>
                  CHAT
                </span>
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={() => setTab("simplify")}
                className={`w-full rounded-t-lg py-2 px-1 text-sm font-bold transition-colors ${tab === "simplify"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-purple-600 text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-wide">
                  <span className="material-icons-outlined text-base">
                    auto_fix_high
                  </span>
                  SIMPLIFY
                </span>
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={() => setTab("history")}
                className={`w-full rounded-t-lg py-2 px-1 text-sm font-bold transition-colors ${tab === "history"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-orange-600 text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-wide">
                  <span className="material-icons-outlined text-base">
                    science
                  </span>
                  HISTORY
                </span>
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={() => setTab("settings")}
                className={`mr-1 w-full rounded-t-lg py-2 px-1 text-sm font-bold transition-colors ${tab === "settings"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-blue-600 text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-wide">
                  <span className="material-icons-outlined text-base">
                    settings
                  </span>
                  SETTINGS
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        {tab === "settings" ? (
          <SettingsTab />
        ) : tab === "history" ? (
          <TestTab onLoadInChat={() => setTab("chat")} />
        ) : tab === "simplify" ? (
          <SimplifyTab />
        ) : (
          <ChatTab />
        )}
      </div>
    </div>
  )
}