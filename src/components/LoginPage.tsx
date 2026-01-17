// src/components/LoginPage.tsx
import { useState } from "react"
import logo from "data-base64:~assets/final_logo.png"

interface LoginPageProps {
  onLogin: () => Promise<void>
  isDark: boolean
  toggleDark: () => void
}

export default function LoginPage({ onLogin, isDark, toggleDark }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 p-4 ${isDark ? "dark" : ""} dark:bg-slate-900`}>
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-lg border-4 border-ink bg-white shadow-comic-lg dark:bg-slate-800">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-gray-200 text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-slate-700 dark:text-white"
          aria-label="Toggle dark mode">
          <span className="material-icons-outlined">brightness_4</span>
        </button>
        
        {/* Header */}
        <div className="border-b-4 border-ink bg-gradient-to-r from-blue-500 to-cyan-500 p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-lg">
              <img
                src={logo}
                alt="Silver Surfer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-center">
              <h1 className="font-display text-4xl tracking-wide text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
                SILVER SURFER
              </h1>
              <span className="inline-block -rotate-2 border border-black bg-yellow-300 px-2 text-xs font-bold text-black">
                WELCOME!
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Welcome message bubble */}
          <div className="relative mb-8">
            <div className="absolute -left-2 top-4 z-10 h-4 w-4 rotate-45 border-l-2 border-b-2 border-ink bg-white dark:bg-slate-700" />
            <div className="relative z-20 rounded-xl border-2 border-ink bg-white p-4 shadow-comic dark:bg-slate-700">
              <p className="font-body text-lg font-bold text-ink dark:text-white">
                Hey there, friend! 👋
              </p>
              <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
                Sign in to unlock your personal internet assistant. I'll help
                make browsing easier and more enjoyable!
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-100 p-3 text-center dark:bg-red-900/30">
              <p className="font-body text-sm font-bold text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="group w-full rounded-xl border-4 border-ink bg-gradient-to-r from-blue-500 to-cyan-500 py-4 px-6 text-xl font-bold text-white shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover disabled:cursor-not-allowed disabled:opacity-50">
            <span className="flex items-center justify-center gap-3">
              {isLoading ? (
                <>
                  <span className="material-icons-outlined animate-spin text-2xl">
                    autorenew
                  </span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined text-2xl transition-transform group-hover:scale-110">
                    login
                  </span>
                  Sign in with Auth0
                </>
              )}
            </span>
          </button>

          {/* Features list */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border-2 border-ink bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <span className="material-icons-outlined text-2xl text-yellow-600">
                text_increase
              </span>
              <span className="font-body font-bold text-ink dark:text-white">
                Make text bigger & easier to read
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border-2 border-ink bg-green-50 p-3 dark:bg-green-900/20">
              <span className="material-icons-outlined text-2xl text-green-600">
                record_voice_over
              </span>
              <span className="font-body font-bold text-ink dark:text-white">
                Read pages aloud to you
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border-2 border-ink bg-purple-50 p-3 dark:bg-purple-900/20">
              <span className="material-icons-outlined text-2xl text-purple-600">
                help
              </span>
              <span className="font-body font-bold text-ink dark:text-white">
                Get help navigating websites
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-ink bg-gray-50 p-4 text-center dark:bg-slate-900">
          <p className="font-display text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Secure • Private • Easy to Use
          </p>
        </div>
      </div>
    </div>
  )
}
