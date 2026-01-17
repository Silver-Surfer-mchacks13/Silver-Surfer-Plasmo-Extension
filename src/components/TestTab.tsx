// src/components/TestTab.tsx
import { useState } from "react"

interface TestResult {
  success: boolean
  message: string
  action: string
}

export default function TestTab() {
  const [selector, setSelector] = useState("")
  const [value, setValue] = useState("")
  const [scaleFactor, setScaleFactor] = useState("1.3")
  const [results, setResults] = useState<TestResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addResult = (action: string, result: { success: boolean; message: string }) => {
    setResults((prev) => [{ ...result, action }, ...prev].slice(0, 10))
  }

  const sendToContent = async (action: string, data: Record<string, unknown> = {}) => {
    setIsLoading(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        addResult(action, { success: false, message: "No active tab found" })
        return
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action, ...data })
      addResult(action, response || { success: false, message: "No response from content script" })
    } catch (error) {
      addResult(action, { success: false, message: error instanceof Error ? error.message : "Unknown error" })
    } finally {
      setIsLoading(false)
    }
  }

  const testActions = [
    {
      name: "Highlight Element",
      icon: "highlight",
      color: "bg-yellow-100 dark:bg-yellow-900",
      action: () => sendToContent("HIGHLIGHT_ELEMENT", { selector }),
      needsSelector: true
    },
    {
      name: "Remove Highlights",
      icon: "highlight_off",
      color: "bg-gray-100 dark:bg-gray-700",
      action: () => sendToContent("REMOVE_HIGHLIGHTS"),
      needsSelector: false
    },
    {
      name: "Remove Clutter",
      icon: "cleaning_services",
      color: "bg-green-100 dark:bg-green-900",
      action: () => sendToContent("REMOVE_CLUTTER"),
      needsSelector: false
    },
    {
      name: "Restore Clutter",
      icon: "restore",
      color: "bg-gray-100 dark:bg-gray-700",
      action: () => sendToContent("RESTORE_CLUTTER"),
      needsSelector: false
    },
    {
      name: "Magnify Text",
      icon: "text_increase",
      color: "bg-blue-100 dark:bg-blue-900",
      action: () => sendToContent("MAGNIFY_TEXT", { selector, scaleFactor: parseFloat(scaleFactor) }),
      needsSelector: true
    },
    {
      name: "Reset Magnification",
      icon: "text_decrease",
      color: "bg-gray-100 dark:bg-gray-700",
      action: () => sendToContent("RESET_MAGNIFICATION"),
      needsSelector: false
    },
    {
      name: "Scroll to View",
      icon: "center_focus_strong",
      color: "bg-purple-100 dark:bg-purple-900",
      action: () => sendToContent("SCROLL_TO_VIEW", { selector }),
      needsSelector: true
    },
    {
      name: "Click Element",
      icon: "touch_app",
      color: "bg-orange-100 dark:bg-orange-900",
      action: () => sendToContent("CLICK_ELEMENT", { selector }),
      needsSelector: true
    },
    {
      name: "Fill Form Field",
      icon: "edit_note",
      color: "bg-cyan-100 dark:bg-cyan-900",
      action: () => sendToContent("FILL_FORM_FIELD", { selector, value }),
      needsSelector: true,
      needsValue: true
    },
    {
      name: "Select Dropdown",
      icon: "arrow_drop_down_circle",
      color: "bg-pink-100 dark:bg-pink-900",
      action: () => sendToContent("SELECT_DROPDOWN", { selector, value }),
      needsSelector: true,
      needsValue: true
    }
  ]

  return (
    <div className="comic-scroll flex-1 space-y-4 overflow-y-auto border-t-4 border-ink bg-white p-4 dark:bg-slate-800">
      {/* Input Fields */}
      <div className="rounded-lg border-2 border-ink bg-gray-50 p-4 shadow-comic dark:bg-slate-700">
        <h3 className="mb-3 font-display text-lg font-bold text-ink dark:text-white">
          Test Parameters
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-600 dark:text-gray-300">
              CSS Selector
            </label>
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="e.g., h1, .class-name, #id"
              className="w-full rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-medium text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-600 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-gray-600 dark:text-gray-300">
              Value (for fill/select)
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g., John Doe, Option 1"
              className="w-full rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-medium text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-600 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-gray-600 dark:text-gray-300">
              Scale Factor (for magnify)
            </label>
            <input
              type="number"
              value={scaleFactor}
              onChange={(e) => setScaleFactor(e.target.value)}
              step="0.1"
              min="1"
              max="3"
              className="w-full rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-medium text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-600 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="rounded-lg border-2 border-ink bg-gray-50 p-4 shadow-comic dark:bg-slate-700">
        <h3 className="mb-3 font-display text-lg font-bold text-ink dark:text-white">
          Page Actions
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          {testActions.map((action) => (
            <button
              key={action.name}
              onClick={action.action}
              disabled={isLoading || (action.needsSelector && !selector) || (action.needsValue && !value)}
              className={`flex items-center gap-2 rounded-lg border-2 border-ink ${action.color} px-3 py-2 text-sm font-bold text-ink shadow-comic transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-hover disabled:cursor-not-allowed disabled:opacity-50 dark:text-white`}
            >
              <span className="material-icons-outlined text-lg">{action.icon}</span>
              <span className="truncate text-xs">{action.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Log */}
      <div className="rounded-lg border-2 border-ink bg-gray-50 p-4 shadow-comic dark:bg-slate-700">
        <h3 className="mb-3 font-display text-lg font-bold text-ink dark:text-white">
          Results
        </h3>
        
        {results.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            No results yet. Try an action above!
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`rounded-lg border-2 p-2 text-xs ${
                  result.success
                    ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                    : "border-red-500 bg-red-50 dark:bg-red-900/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-icons-outlined text-sm ${result.success ? "text-green-600" : "text-red-600"}`}>
                    {result.success ? "check_circle" : "error"}
                  </span>
                  <span className="font-bold text-ink dark:text-white">{result.action}</span>
                </div>
                <p className="mt-1 text-gray-600 dark:text-gray-300">{result.message}</p>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <button
            onClick={() => setResults([])}
            className="mt-3 w-full rounded-lg border-2 border-ink bg-gray-200 px-3 py-2 text-sm font-bold text-ink transition-all hover:bg-gray-300 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
          >
            Clear Results
          </button>
        )}
      </div>

      {/* Usage Tips */}
      <div className="rounded-lg border-2 border-ink bg-blue-50 p-4 shadow-comic dark:bg-blue-900/30">
        <h3 className="mb-2 font-display text-lg font-bold text-blue-800 dark:text-blue-300">
          💡 Quick Tips
        </h3>
        <ul className="list-inside list-disc space-y-1 text-xs text-blue-700 dark:text-blue-200">
          <li>Use <code className="bg-blue-100 px-1 rounded dark:bg-blue-800">h1</code> to select the first heading</li>
          <li>Use <code className="bg-blue-100 px-1 rounded dark:bg-blue-800">p</code> to select the first paragraph</li>
          <li>Use <code className="bg-blue-100 px-1 rounded dark:bg-blue-800">.classname</code> for class selectors</li>
          <li>Use <code className="bg-blue-100 px-1 rounded dark:bg-blue-800">#id</code> for ID selectors</li>
          <li>Use <code className="bg-blue-100 px-1 rounded dark:bg-blue-800">input[type="text"]</code> for specific inputs</li>
        </ul>
      </div>
    </div>
  )
}
