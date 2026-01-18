// src/components/SimplifyTab.tsx
// Page Simplification feature - creates focused overlay views of web pages

import { useState } from "react"
import { api } from "~lib/api"
import { getCurrentPageState } from "~lib/conversation-api"

interface SimplificationPreset {
  id: string
  name: string
  icon: string
  description: string
  prompt: string
}

const PRESETS: SimplificationPreset[] = [
  {
    id: "products",
    name: "Products Only",
    icon: "shopping_bag",
    description: "Show only product listings with prices",
    prompt: "Show only product items with their names, images, prices, and add-to-cart buttons. Hide navigation, ads, banners, and other distractions."
  },
  {
    id: "article",
    name: "Article Focus",
    icon: "article",
    description: "Focus on main article content",
    prompt: "Show only the main article content - title, text, and relevant images. Hide navigation, sidebars, ads, comments, and related articles."
  },
  {
    id: "forms",
    name: "Forms Only",
    icon: "edit_note",
    description: "Highlight forms and input fields",
    prompt: "Show only forms and input fields with their labels. Hide everything else except submit buttons."
  },
  {
    id: "navigation",
    name: "Navigation",
    icon: "menu",
    description: "Show main navigation links",
    prompt: "Show only the main navigation menu and important links. Hide all other content."
  }
]

// New structured result from AI
interface SimplifiedItem {
  type: "text" | "link" | "button" | "image" | "input"
  content: string
  selector: string
  href?: string
  src?: string
  price?: string
}

interface SimplifiedSection {
  heading?: string
  items: SimplifiedItem[]
}

interface SimplificationResult {
  title: string
  sections: SimplifiedSection[]
  message: string
}

export default function SimplifyTab() {
  const [isSimplified, setIsSimplified] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [customPrompt, setCustomPrompt] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const applySimplification = async (prompt: string) => {
    setIsProcessing(true)
    setError("")
    setMessage("")

    try {
      // Get current page state
      const pageData = await getCurrentPageState()
      if (!pageData) {
        setError("Could not capture page state. Make sure you're on a webpage.")
        setIsProcessing(false)
        return
      }

      // Send simplification request to backend
      const response = await api.post("/api/simplify", {
        prompt,
        page_state: pageData.pageState
      })

      if (!response.success || !response.data) {
        setError(response.error || "Simplification failed")
        setIsProcessing(false)
        return
      }

      const result = response.data as SimplificationResult

      // Apply simplification overlay to the page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (!tabId) {
          setError("No active tab")
          setIsProcessing(false)
          return
        }

        chrome.tabs.sendMessage(tabId, {
          action: "APPLY_SIMPLIFICATION",
          content: {
            title: result.title,
            sections: result.sections,
            message: result.message
          }
        }, (res) => {
          if (chrome.runtime.lastError) {
            setError(chrome.runtime.lastError.message || "Failed to apply")
          } else {
            setMessage(result.message || "Page simplified!")
            setIsSimplified(true)
          }
          setIsProcessing(false)
        })
      })
    } catch (err) {
      setError("An error occurred")
      setIsProcessing(false)
    }
  }

  const removeSimplification = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId) return

      chrome.tabs.sendMessage(tabId, { action: "REMOVE_SIMPLIFICATION" }, () => {
        setIsSimplified(false)
        setMessage("")
      })
    })
  }

  const handlePresetClick = (preset: SimplificationPreset) => {
    applySimplification(preset.prompt)
  }

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      applySimplification(customPrompt.trim())
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Main content area */}
      <div className="comic-scroll flex-1 space-y-4 overflow-y-auto border-t-4 border-ink bg-white p-4 dark:bg-slate-800">

        {/* Header */}
        <div className="rounded-lg border-2 border-ink bg-gradient-to-r from-purple-100 to-pink-100 p-4 shadow-comic dark:from-purple-900 dark:to-pink-900">
          <h2 className="flex items-center gap-2 font-display text-xl text-ink dark:text-white">
            <span className="material-icons-outlined">auto_fix_high</span>
            Page Simplification
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Create a focused, clean view of any webpage by hiding distractions.
          </p>
        </div>

        {/* Status indicator */}
        {isSimplified && (
          <div className="flex items-center justify-between rounded-lg border-2 border-green-500 bg-green-100 p-3 dark:bg-green-900">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-green-600 dark:text-green-300">check_circle</span>
              <span className="font-bold text-green-700 dark:text-green-200">Simplified View Active</span>
            </div>
            <button
              onClick={removeSimplification}
              className="rounded-lg border-2 border-ink bg-white px-3 py-1 font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover dark:bg-slate-700 dark:text-white"
            >
              Restore
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-lg border-2 border-red-500 bg-red-100 p-3 dark:bg-red-900">
            <p className="text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Success message */}
        {message && !error && (
          <div className="rounded-lg border-2 border-blue-500 bg-blue-100 p-3 dark:bg-blue-900">
            <p className="text-blue-700 dark:text-blue-200">{message}</p>
          </div>
        )}

        {/* Quick presets */}
        <div>
          <h3 className="mb-3 font-display text-lg text-ink dark:text-white">Quick Presets</h3>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                disabled={isProcessing}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-ink bg-white p-4 shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover disabled:opacity-50 dark:bg-slate-700"
              >
                <span className="material-icons-outlined text-3xl text-purple-600 dark:text-purple-400">
                  {preset.icon}
                </span>
                <span className="font-bold text-ink dark:text-white">{preset.name}</span>
                <span className="text-center text-xs text-gray-500 dark:text-gray-400">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt */}
        <div>
          <h3 className="mb-3 font-display text-lg text-ink dark:text-white">Custom Focus</h3>
          <div className="space-y-3">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe what you want to see, e.g., 'Only show the main content and images' or 'Show only items under $50'"
              className="w-full rounded-lg border-2 border-ink p-3 font-body text-ink shadow-comic focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
              rows={3}
              disabled={isProcessing}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={isProcessing || !customPrompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-ink bg-purple-600 py-3 font-bold text-white shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <span className="material-icons-outlined animate-spin">autorenew</span>
                  Simplifying...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined">auto_fix_high</span>
                  Simplify Page
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-slate-700">
          <h4 className="mb-2 flex items-center gap-2 font-bold text-gray-700 dark:text-gray-200">
            <span className="material-icons-outlined text-yellow-500">lightbulb</span>
            Tips
          </h4>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <li>• Use presets for common scenarios</li>
            <li>• Be specific about what you want to see</li>
            <li>• Click "Restore" to return to normal view</li>
            <li>• Works best on content-heavy pages</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
