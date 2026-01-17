import { useState } from "react"

import { api } from "~lib/api"
import "~style.css"

interface CapturedData {
  screenshot: string | null
  html: string | null
  url: string | null
  timestamp: number | null
}

function SidePanel() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [token, setToken] = useState("")
  const [logs, setLogs] = useState<string[]>([])
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [activeTab, setActiveTab] = useState<"api" | "capture">("capture")

  const addLog = (title: string, data: any) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [
      `[${timestamp}] ${title}: ${JSON.stringify(data, null, 2)}`,
      ...prev
    ])
  }

  const handleRegister = async () => {
    addLog("Registering...", { email })
    const res = await api.post("/api/v1/Auth/register", {
      email,
      password,
      username: email.split("@")[0] // Simple default
    })
    addLog("Register Result", res)
  }

  const handleLogin = async () => {
    addLog("Logging in...", { email })
    const res = await api.post("/api/v1/Auth/login", {
      email,
      password
    })
    addLog("Login Result", res)
    if (res.success && res.data?.token) {
      setToken(res.data.token)
      addLog("Token Saved", "Token stored for future requests")
    } else if (res.success && res.data?.accessToken) {
       // Handle common name variations
       setToken(res.data.accessToken)
       addLog("Token Saved", "Token stored for future requests")
    }
  }

  const handleGetMe = async () => {
    if (!token) {
      addLog("Error", "No token found. Login first.")
      return
    }
    
    addLog("Fetching Me...", { token: token.substring(0, 10) + "..." })
    const res = await api.get("/api/v1/Auth/me", {
      Authorization: `Bearer ${token}`
    })
    addLog("Get Me Result", res)
  }

  // Capture functions
  const captureScreenshot = async () => {
    addLog("Capturing Screenshot...", {})
    chrome.runtime.sendMessage({ action: "CAPTURE_SCREENSHOT" }, (response) => {
      if (response?.success) {
        setCapturedData((prev) => ({
          ...prev,
          screenshot: response.data.screenshot,
          url: response.data.url,
          timestamp: Date.now(),
          html: prev?.html || null
        }))
        addLog("Screenshot Captured", { url: response.data.url })
      } else {
        addLog("Screenshot Error", response?.error || "Unknown error")
      }
    })
  }

  const captureHtml = async () => {
    addLog("Extracting HTML...", {})
    chrome.runtime.sendMessage({ action: "GET_HTML" }, (response) => {
      if (response?.success) {
        setCapturedData((prev) => ({
          ...prev,
          html: response.data.html,
          url: response.data.url,
          timestamp: Date.now(),
          screenshot: prev?.screenshot || null
        }))
        addLog("HTML Extracted", {
          url: response.data.url,
          length: response.data.html?.length || 0
        })
      } else {
        addLog("HTML Error", response?.error || "Unknown error")
      }
    })
  }

  const captureAll = async () => {
    addLog("Capturing All...", {})
    chrome.runtime.sendMessage({ action: "CAPTURE_ALL" }, (response) => {
      if (response?.success) {
        setCapturedData(response.data)
        addLog("Capture Complete", {
          url: response.data.url,
          hasScreenshot: !!response.data.screenshot,
          htmlLength: response.data.html?.length || 0
        })
      } else {
        addLog("Capture Error", response?.error || "Unknown error")
      }
    })
  }

  const downloadJson = () => {
    if (!capturedData) return

    const jsonData = JSON.stringify(capturedData, null, 2)
    const blob = new Blob([jsonData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `capture-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    addLog("Downloaded JSON", { filename: a.download })
  }

  return (
    <div className="flex flex-col p-4 w-full h-screen bg-gray-50 overflow-hidden">
      <h1 className="text-xl font-bold mb-4 text-slate-800">Silver Surfer</h1>

      {/* Tab Switcher */}
      <div className="flex mb-4 border-b">
        <button
          onClick={() => setActiveTab("capture")}
          className={`px-4 py-2 ${activeTab === "capture" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
          Capture
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 ${activeTab === "api" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
          API Test
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "capture" && (
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={captureScreenshot}
                className="bg-orange-600 text-white p-2 rounded hover:bg-orange-700">
                📷 Screenshot
              </button>
              <button
                onClick={captureHtml}
                className="bg-teal-600 text-white p-2 rounded hover:bg-teal-700">
                📄 Extract HTML
              </button>
            </div>

            <button
              onClick={captureAll}
              className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700">
              🚀 Capture All
            </button>

            {capturedData && (
              <div className="space-y-2 p-3 bg-white rounded border">
                <div className="text-sm font-medium text-slate-700">Captured Data:</div>
                <div className="text-xs text-slate-500">
                  URL: {capturedData.url || "N/A"}
                </div>
                <div className="text-xs text-slate-500">
                  Screenshot: {capturedData.screenshot ? "✅ Captured" : "❌ None"}
                </div>
                <div className="text-xs text-slate-500">
                  HTML: {capturedData.html ? `✅ ${capturedData.html.length} chars` : "❌ None"}
                </div>
                <div className="text-xs text-slate-500">
                  Time: {capturedData.timestamp ? new Date(capturedData.timestamp).toLocaleString() : "N/A"}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex-1 bg-gray-200 text-slate-700 p-2 rounded text-sm hover:bg-gray-300">
                    {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>
                  <button
                    onClick={downloadJson}
                    className="flex-1 bg-green-600 text-white p-2 rounded text-sm hover:bg-green-700">
                    📥 Download JSON
                  </button>
                </div>

                {showPreview && capturedData.screenshot && (
                  <div className="mt-2">
                    <img
                      src={capturedData.screenshot}
                      alt="Screenshot"
                      className="w-full rounded border"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-3 mb-6">
            <input
              type="email"
              placeholder="Email"
              className="w-full p-2 border rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-2 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRegister}
                className="bg-green-600 text-white p-2 rounded hover:bg-green-700">
                Register
              </button>
              <button
                onClick={handleLogin}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                Login
              </button>
            </div>

            <button
              onClick={handleGetMe}
              className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 disabled:opacity-50"
              disabled={!token}>
              Get Current User (Me)
            </button>

            <div className="text-xs text-slate-500 break-all">
              Token: {token ? `${token.substring(0, 20)}...` : "None"}
            </div>
          </div>
        )}
      </div>

      <div className="h-48 bg-slate-900 text-green-400 p-2 rounded text-xs font-mono overflow-y-auto whitespace-pre-wrap">
        {logs.length === 0 ? "Logs will appear here..." : logs.join("\n\n")}
      </div>
    </div>
  )
}

export default SidePanel
