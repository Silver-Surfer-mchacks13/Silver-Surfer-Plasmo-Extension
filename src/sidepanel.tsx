// src/sidepanel.tsx
import { useEffect, useMemo, useState } from "react"
import LoginPage from "~components/LoginPage"
import type { AuthState, AuthUser } from "~lib/auth-service"
import "./style.css"
import SettingsTab from "./components/settings_tab"
import TestTab from "./components/TestTab"
import logo from "data-base64:~assets/final_logo.svg"


export default function SidePanel() {
  const [dark, setDark] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null
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
          accessToken: null
        })
      }
    })
  }
  const [tab, setTab] = useState<"chat" | "settings" | "test">("chat")

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
                    {tab === "chat" ? "Assistant" : tab === "settings" ? "Settings" : "Test Lab"}
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
                className={`w-full rounded-t-lg py-2 px-2 text-base font-bold transition-colors ${
                  tab === "chat"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-primary text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-widest">
                  <span className="material-icons-outlined text-lg">
                    chat_bubble
                  </span>
                  CHAT
                </span>
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={() => setTab("test")}
                className={`w-full rounded-t-lg py-2 px-2 text-base font-bold transition-colors ${
                  tab === "test"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-purple-600 text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-widest">
                  <span className="material-icons-outlined text-lg">
                    science
                  </span>
                  TEST
                </span>
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={() => setTab("settings")}
                className={`mr-1 w-full rounded-t-lg py-2 px-2 text-base font-bold transition-colors ${
                  tab === "settings"
                    ? "relative top-[2px] border-t-2 border-l-2 border-r-2 border-ink bg-blue-600 text-white"
                    : "border-2 border-ink bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}>
                <span className="font-display flex items-center justify-center gap-1 tracking-widest">
                  <span className="material-icons-outlined text-lg">
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
        ) : tab === "test" ? (
          <TestTab />
        ) : (
          <div className="comic-scroll bg-dots flex-1 space-y-8 overflow-y-auto border-t-4 border-ink bg-white bg-halftone-light p-4 dark:bg-slate-800 dark:bg-halftone-dark">
            {/* Assistant message */}
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

            {/* User message */}
            <div className="flex w-full justify-end">
              <div className="relative max-w-[90%]">
                <div className="absolute -right-2 top-6 z-10 h-5 w-5 -rotate-45 border-r-2 border-b-2 border-ink bg-blue-100 dark:bg-blue-900" />
                <div className="relative z-20 rounded-xl border-2 border-ink bg-blue-100 p-5 text-ink shadow-comic dark:bg-blue-900 dark:text-white">
                  <p className="font-body text-xl font-bold leading-snug">
                    Can you make the text on this news site larger for me?
                  </p>
                </div>
              </div>
            </div>

            {/* Assistant action bubble */}
            <div className="flex w-full justify-start">
              <div className="relative max-w-[95%]">
                <div className="absolute -left-2 top-6 z-10 h-5 w-5 rotate-45 border-l-2 border-b-2 border-ink bg-white dark:bg-slate-700" />
                <div className="relative z-20 rounded-xl border-2 border-ink bg-white p-5 text-ink shadow-comic dark:bg-slate-700 dark:text-white">
                  <p className="mb-4 font-body text-xl font-bold leading-snug">
                    Certainly! I have increased the text size by{" "}
                    <span className="inline-block -rotate-1 border border-black bg-yellow-300 px-1 text-black dark:bg-yellow-600">
                      20%
                    </span>
                    .
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className="flex-1 min-w-[120px] rounded-lg border-2 border-ink bg-green-100 py-3 px-4 text-lg font-bold text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-green-900 dark:text-white dark:hover:bg-green-800">
                      <span className="material-icons-outlined text-3xl">
                        add_circle
                      </span>
                      Larger
                    </button>
                    <button className="flex-1 min-w-[120px] rounded-lg border-2 border-ink bg-red-100 py-3 px-4 text-lg font-bold text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-red-900 dark:text-white dark:hover:bg-red-800">
                      <span className="material-icons-outlined text-3xl">
                        restart_alt
                      </span>
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button className="transform rounded-full border-2 border-ink bg-yellow-100 py-2 px-4 text-base font-bold text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:rotate-1 hover:shadow-comic-hover dark:bg-slate-700 dark:text-white">
                Read this page to me
              </button>
              <button className="transform rounded-full border-2 border-ink bg-cyan-100 py-2 px-4 text-base font-bold text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:-rotate-1 hover:shadow-comic-hover dark:bg-slate-700 dark:text-white">
                Find recipe
              </button>
            </div>

            <div className="h-6" />
          </div>
        )}

        {/* Footer input (only for chat) */}
        {tab === "chat" ? (
          <div className="relative z-20 shrink-0 border-t-4 border-ink bg-gray-100 p-4 dark:bg-slate-900">
            <div className="flex items-end gap-3">
              <div className="flex h-16 flex-1 items-center rounded-xl border-2 border-ink bg-white shadow-comic transition-all focus-within:translate-x-[2px] focus-within:translate-y-[2px] focus-within:shadow-comic-hover dark:bg-slate-800">
                <input
                  className="h-full w-full border-none bg-transparent p-4 text-xl font-bold text-ink placeholder-gray-400 focus:ring-0 dark:text-white"
                  placeholder="Type here..."
                  type="text"
                />
              </div>
              <button
                aria-label="Speak"
                className="group flex h-16 w-16 items-center justify-center rounded-xl border-2 border-ink bg-comic-red text-white shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-red-600 hover:shadow-comic-hover">
                <span className="material-icons-outlined text-4xl transition-transform group-hover:scale-110">
                  mic
                </span>
              </button>
            </div>

            <div className="mt-3 text-center">
              <p className="font-display text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Powered by Silver Surfer AI
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}