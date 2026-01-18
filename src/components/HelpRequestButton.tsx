// src/components/HelpRequestButton.tsx
// "Call for Help" feature - allows elderly users to send help requests to loved ones

import { useState, useCallback } from "react"
import { getCurrentPageState } from "~lib/conversation-api"

interface HelpRequestPayload {
  page_url: string
  page_title: string
  issue_description: string
  screenshot_base64: string
  timestamp: string
}

export default function HelpRequestButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [issueDescription, setIssueDescription] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
    setStatus("idle")
    setStatusMessage("")
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setIssueDescription("")
    setStatus("idle")
    setStatusMessage("")
  }, [])

  const handleSendHelpRequest = useCallback(async () => {
    if (!issueDescription.trim()) {
      setStatus("error")
      setStatusMessage("Please describe the issue you're having.")
      return
    }

    setIsSending(true)
    setStatus("idle")

    try {
      // Get current page state including screenshot
      const pageData = await getCurrentPageState()

      if (!pageData) {
        throw new Error("Could not capture page information. Please try again.")
      }

      // Build the payload
      const payload: HelpRequestPayload = {
        page_url: pageData.pageState.url,
        page_title: pageData.title,
        issue_description: issueDescription.trim(),
        screenshot_base64: pageData.pageState.screenshot || "",
        timestamp: new Date().toISOString()
      }

      // Send via background script to avoid CORS issues
      const response = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          { action: "SEND_HELP_REQUEST", payload },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve(res)
            }
          }
        )
      })

      if (!response.success) {
        throw new Error(response.error || "Failed to send help request")
      }

      console.log("Help request sent successfully:", response.data)

      setStatus("success")
      setStatusMessage("Help request sent! Your loved one will be notified shortly.")
      setIssueDescription("")

      // Auto-close after success
      setTimeout(() => {
        handleCloseModal()
      }, 3000)

    } catch (error) {
      console.error("Error sending help request:", error)
      setStatus("error")
      setStatusMessage(error instanceof Error ? error.message : "Failed to send help request. Please try again.")
    } finally {
      setIsSending(false)
    }
  }, [issueDescription, handleCloseModal])

  return (
    <>
      {/* Help Button - Fixed at bottom of screen */}
      <button
        onClick={handleOpenModal}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-3 border-ink bg-red-500 text-white shadow-comic transition-all hover:scale-110 hover:bg-red-600"
        title="Call for Help"
      >
        <span className="material-icons-outlined text-3xl">sos</span>
      </button>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border-4 border-ink bg-white p-6 shadow-comic dark:bg-slate-800">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-black text-ink dark:text-white">
                <span className="material-icons-outlined mr-2 align-middle text-red-500">sos</span>
                Call for Help
              </h2>
              <button
                onClick={handleCloseModal}
                className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <span className="material-icons-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Description */}
            <p className="mb-4 text-lg text-gray-600 dark:text-gray-300">
              Describe what you're having trouble with. A screenshot of this page will be sent to your loved one.
            </p>

            {/* Issue Text Area */}
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Example: I can't find where to add this item to my cart..."
              className="mb-4 h-32 w-full resize-none rounded-xl border-3 border-ink bg-gray-50 p-4 text-lg font-bold text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-700 dark:text-white"
              disabled={isSending}
            />

            {/* Status Message */}
            {status !== "idle" && (
              <div
                className={`mb-4 rounded-xl border-2 p-3 text-center font-bold ${
                  status === "success"
                    ? "border-green-500 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "border-red-500 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}
              >
                <span className="material-icons-outlined mr-1 align-middle">
                  {status === "success" ? "check_circle" : "error"}
                </span>
                {statusMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 rounded-xl border-3 border-ink bg-gray-200 py-3 text-lg font-bold text-ink shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-hover dark:bg-slate-600 dark:text-white"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={handleSendHelpRequest}
                disabled={isSending || !issueDescription.trim()}
                className="flex-1 rounded-xl border-3 border-ink bg-red-500 py-3 text-lg font-bold text-white shadow-comic transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-red-600 hover:shadow-comic-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-icons-outlined animate-spin">autorenew</span>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-icons-outlined">send</span>
                    Send Help Request
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
