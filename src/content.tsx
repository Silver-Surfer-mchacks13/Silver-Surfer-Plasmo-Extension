import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import {
  highlightElement,
  removeHighlights,
  removeClutter,
  restoreClutter,
  magnifyText,
  resetMagnification,
  scrollToView,
  clickElement,
  fillFormField,
  selectDropdown
} from "~lib/page-actions"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

// Listen for messages from background script or sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_HTML") {
    const html = document.documentElement.outerHTML
    sendResponse({ html, url: window.location.href })
    return true
  }

  // Page action handlers
  if (request.action === "HIGHLIGHT_ELEMENT") {
    const result = highlightElement(request.selector)
    sendResponse(result)
    return true
  }

  if (request.action === "REMOVE_HIGHLIGHTS") {
    const result = removeHighlights()
    sendResponse(result)
    return true
  }

  if (request.action === "REMOVE_CLUTTER") {
    const result = removeClutter()
    sendResponse(result)
    return true
  }

  if (request.action === "RESTORE_CLUTTER") {
    const result = restoreClutter()
    sendResponse(result)
    return true
  }

  if (request.action === "MAGNIFY_TEXT") {
    const result = magnifyText(request.selector, request.scaleFactor)
    sendResponse(result)
    return true
  }

  if (request.action === "RESET_MAGNIFICATION") {
    const result = resetMagnification()
    sendResponse(result)
    return true
  }

  if (request.action === "SCROLL_TO_VIEW") {
    const result = scrollToView(request.selector)
    sendResponse(result)
    return true
  }

  if (request.action === "CLICK_ELEMENT") {
    const result = clickElement(request.selector)
    sendResponse(result)
    return true
  }

  if (request.action === "FILL_FORM_FIELD") {
    const result = fillFormField(request.selector, request.value)
    sendResponse(result)
    return true
  }

  if (request.action === "SELECT_DROPDOWN") {
    const result = selectDropdown(request.selector, request.value)
    sendResponse(result)
    return true
  }

  return true
})

/**
 * Generates a style element with adjusted CSS to work correctly within a Shadow DOM.
 *
 * Tailwind CSS relies on `rem` units, which are based on the root font size (typically defined on the <html>
 * or <body> element). However, in a Shadow DOM (as used by Plasmo), there is no native root element, so the
 * rem values would reference the actual page's root font size—often leading to sizing inconsistencies.
 *
 * To address this, we:
 * 1. Replace the `:root` selector with `:host(plasmo-csui)` to properly scope the styles within the Shadow DOM.
 * 2. Convert all `rem` units to pixel values using a fixed base font size, ensuring consistent styling
 *    regardless of the host page's font size.
 */
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize

    return `${pixelsValue}px`
  })

  const styleElement = document.createElement("style")

  styleElement.textContent = updatedCssText

  return styleElement
}

// Overlay component removed - no longer needed
// export default PlasmoOverlay
