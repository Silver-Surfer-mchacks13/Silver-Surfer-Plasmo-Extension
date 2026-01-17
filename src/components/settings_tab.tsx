// src/components/SettingsTab.tsx
import { useEffect, useState } from "react"

type SettingsState = {
  highContrast: boolean
  voiceAssist: boolean
  largeTextBoost: boolean
}

const DEFAULTS: SettingsState = {
  highContrast: true,
  voiceAssist: false,
  largeTextBoost: false
}

async function loadSettings(): Promise<SettingsState> {
  try {
    const res = await chrome.storage.sync.get(["settings"])
    return { ...DEFAULTS, ...(res.settings ?? {}) }
  } catch {
    return DEFAULTS
  }
}

async function saveSettings(settings: SettingsState) {
  try {
    await chrome.storage.sync.set({ settings })
  } catch {
    // ignore for hackathon
  }
}

function LeverToggle({
  active,
  onToggle
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`toggle-lever-base relative h-8 w-14 cursor-pointer rounded-full ${
        active ? "toggle-active" : ""
      }`}
      onClick={onToggle}
      role="switch"
      aria-checked={active}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggle()
      }}>
      <div className="toggle-lever-handle absolute left-0.5 top-0.5 h-6 w-6 rounded-full transition-all duration-200" />
    </div>
  )
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS)

  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  return (
    <div className="comic-scroll bg-dots flex-1 space-y-6 overflow-y-auto border-t-4 border-ink bg-white bg-halftone-light p-6 dark:bg-slate-800 dark:bg-halftone-dark">
      {/* High Contrast */}
      <div className="group relative overflow-hidden rounded-lg border-4 border-ink bg-white p-5 shadow-comic dark:bg-slate-700">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h3 className="font-display mb-1 text-2xl uppercase tracking-wider text-ink dark:text-white">
              High Contrast Mode
            </h3>
            <p className="text-sm font-bold leading-tight text-gray-600 dark:text-gray-300">
              Makes text pop against the background for easier reading!
            </p>
          </div>
          <div className="shrink-0">
            <LeverToggle
              active={settings.highContrast}
              onToggle={() =>
                setSettings((s) => ({ ...s, highContrast: !s.highContrast }))
              }
            />
          </div>
        </div>
      </div>

      {/* Large Text */}
      <div className="group relative overflow-hidden rounded-lg border-4 border-ink bg-white p-5 shadow-comic dark:bg-slate-700">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h3 className="font-display mb-1 text-2xl uppercase tracking-wider text-ink dark:text-white">
              Large Text
            </h3>
            <p className="text-sm font-bold leading-tight text-gray-600 dark:text-gray-300">
              Supersize the words so you never have to squint again!
            </p>
          </div>

          <div className="relative shrink-0">
            <button
              className="group/btn flex h-14 w-14 items-center justify-center rounded-full border-4 border-ink bg-comic-yellow shadow-comic transition-transform hover:scale-105 active:scale-95"
              onClick={() =>
                setSettings((s) => ({ ...s, largeTextBoost: !s.largeTextBoost }))
              }
              aria-label="Toggle large text">
              <div className="h-8 w-8 rounded-full bg-white/40 blur-sm group-hover/btn:animate-pulse" />
              <span className="absolute font-bold text-ink material-icons-outlined">
                bolt
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Voice Assistance */}
      <div className="group relative overflow-hidden rounded-lg border-4 border-ink bg-white p-5 shadow-comic dark:bg-slate-700">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h3 className="font-display mb-1 text-2xl uppercase tracking-wider text-ink dark:text-white">
              Voice Assistance
            </h3>
            <p className="text-sm font-bold leading-tight text-gray-600 dark:text-gray-300">
              Our cosmic hero will read out instructions for you!
            </p>
          </div>
          <div className="shrink-0">
            <LeverToggle
              active={settings.voiceAssist}
              onToggle={() =>
                setSettings((s) => ({ ...s, voiceAssist: !s.voiceAssist }))
              }
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className="relative flex flex-col items-center pb-4 pt-8">
        <div className="group relative">
          <button
            className="relative z-10 border-4 border-ink bg-comic-red px-10 py-4 font-display text-3xl uppercase tracking-tighter text-white shadow-comic-lg transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-comic active:bg-red-700"
            onClick={() => setSettings(DEFAULTS)}>
            Reset to Default
          </button>
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          End of Issue #2 - More to Come!
        </p>
      </div>
    </div>
  )
}
