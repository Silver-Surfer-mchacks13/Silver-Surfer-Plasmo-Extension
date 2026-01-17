import { useState } from "react"

import "~style.css"

function IndexPopup() {
  const openSidePanel = async () => {
    // Get the current active tab's window ID
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.windowId) {
      // Open the side panel for the current window
      // Note: This requires the "sidePanel" permission in manifest
      await chrome.sidePanel.open({ windowId: tab.windowId })
      // Close the popup
      window.close()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-40 w-64 bg-white p-4">
      <h1 className="text-xl font-bold mb-4 text-slate-800">Silver Surfer</h1>
      <button
        onClick={openSidePanel}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors duration-200">
        Open Side Panel
      </button>
    </div>
  )
}

export default IndexPopup
