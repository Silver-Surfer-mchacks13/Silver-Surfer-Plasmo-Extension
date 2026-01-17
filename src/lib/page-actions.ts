// src/lib/page-actions.ts
// Page manipulation functions for content scripts

/**
 * Draws a thick, high-contrast comic-book style border around an element
 */
export function highlightElement(selector: string): { success: boolean; message: string } {
  const element = document.querySelector(selector) as HTMLElement
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` }
  }

  // Remove any existing highlights
  removeHighlights()

  // Create comic-style highlight
  element.setAttribute("data-silver-surfer-highlight", "true")
  element.style.setProperty("outline", "4px solid #1e40af", "important")
  element.style.setProperty("outline-offset", "4px", "important")
  element.style.setProperty("box-shadow", "0 0 0 8px #fbbf24, 6px 6px 0 8px #000", "important")
  element.style.setProperty("position", "relative", "important")
  element.style.setProperty("z-index", "9999", "important")

  // Add pulsing animation
  const style = document.createElement("style")
  style.id = "silver-surfer-highlight-style"
  style.textContent = `
    [data-silver-surfer-highlight="true"] {
      animation: silver-surfer-pulse 1.5s ease-in-out infinite;
    }
    @keyframes silver-surfer-pulse {
      0%, 100% { outline-color: #1e40af; box-shadow: 0 0 0 8px #fbbf24, 6px 6px 0 8px #000; }
      50% { outline-color: #3b82f6; box-shadow: 0 0 0 10px #fde047, 8px 8px 0 10px #000; }
    }
  `
  document.head.appendChild(style)

  return { success: true, message: `Highlighted element: ${selector}` }
}

/**
 * Removes all Silver Surfer highlights from the page
 */
export function removeHighlights(): { success: boolean; message: string } {
  const highlighted = document.querySelectorAll("[data-silver-surfer-highlight]")
  highlighted.forEach((el) => {
    const element = el as HTMLElement
    element.removeAttribute("data-silver-surfer-highlight")
    element.style.removeProperty("outline")
    element.style.removeProperty("outline-offset")
    element.style.removeProperty("box-shadow")
    element.style.removeProperty("z-index")
  })

  const style = document.getElementById("silver-surfer-highlight-style")
  if (style) style.remove()

  return { success: true, message: "Removed all highlights" }
}

/**
 * Hides distracting elements (ads, popups, auto-playing videos) to focus on main content
 */
export function removeClutter(): { success: boolean; message: string; hiddenCount: number } {
  const clutterSelectors = [
    // Common ad containers
    '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]', '[id*="ads-"]',
    '[class*="advertisement"]', '[id*="advertisement"]',
    '[class*="banner"]', '[id*="banner"]',
    '[class*="sponsored"]', '[id*="sponsored"]',
    // Popups and modals
    '[class*="popup"]', '[id*="popup"]',
    '[class*="modal"]', '[id*="modal"]',
    '[class*="overlay"]', '[id*="overlay"]',
    // Cookie notices
    '[class*="cookie"]', '[id*="cookie"]',
    '[class*="consent"]', '[id*="consent"]',
    '[class*="gdpr"]', '[id*="gdpr"]',
    // Auto-playing videos (pause them instead of hiding)
    'video[autoplay]',
    // Newsletter popups
    '[class*="newsletter"]', '[id*="newsletter"]',
    '[class*="subscribe"]', '[id*="subscribe"]',
    // Sticky elements that aren't navigation
    '[class*="sticky"]:not(nav):not([class*="nav"])',
    // Social share bars
    '[class*="share-bar"]', '[class*="social-bar"]',
  ]

  let hiddenCount = 0
  
  clutterSelectors.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector)
      elements.forEach((el) => {
        const element = el as HTMLElement
        
        // Skip if it's likely important content
        const isMainContent = element.closest("main, article, [role='main']")
        const isNavigation = element.closest("nav, header")
        
        if (!isMainContent && !isNavigation) {
          // For videos, pause instead of hiding
          if (element.tagName === "VIDEO") {
            (element as HTMLVideoElement).pause()
            ;(element as HTMLVideoElement).muted = true
          } else {
            element.setAttribute("data-silver-surfer-hidden", "true")
            element.style.setProperty("display", "none", "important")
          }
          hiddenCount++
        }
      })
    } catch (e) {
      // Invalid selector, skip
    }
  })

  return { success: true, message: `Hidden ${hiddenCount} distracting elements`, hiddenCount }
}

/**
 * Restores hidden clutter elements
 */
export function restoreClutter(): { success: boolean; message: string } {
  const hidden = document.querySelectorAll("[data-silver-surfer-hidden]")
  hidden.forEach((el) => {
    const element = el as HTMLElement
    element.removeAttribute("data-silver-surfer-hidden")
    element.style.removeProperty("display")
  })

  return { success: true, message: `Restored ${hidden.length} elements` }
}

/**
 * Increases font size and contrast of a specific element without breaking layout
 */
export function magnifyText(selector: string, scaleFactor: number = 1.3): { success: boolean; message: string } {
  const element = document.querySelector(selector) as HTMLElement
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` }
  }

  // Store original values
  const originalFontSize = window.getComputedStyle(element).fontSize
  const originalLineHeight = window.getComputedStyle(element).lineHeight

  element.setAttribute("data-silver-surfer-magnified", "true")
  element.setAttribute("data-original-font-size", originalFontSize)
  element.setAttribute("data-original-line-height", originalLineHeight)

  const currentSize = parseFloat(originalFontSize)
  const newSize = currentSize * scaleFactor

  element.style.setProperty("font-size", `${newSize}px`, "important")
  element.style.setProperty("line-height", "1.6", "important")
  element.style.setProperty("color", "#111827", "important")
  element.style.setProperty("font-weight", "500", "important")
  element.style.setProperty("letter-spacing", "0.025em", "important")

  return { success: true, message: `Magnified text from ${currentSize}px to ${newSize}px` }
}

/**
 * Resets magnified text to original state
 */
export function resetMagnification(): { success: boolean; message: string } {
  const magnified = document.querySelectorAll("[data-silver-surfer-magnified]")
  magnified.forEach((el) => {
    const element = el as HTMLElement
    const originalFontSize = element.getAttribute("data-original-font-size")
    const originalLineHeight = element.getAttribute("data-original-line-height")

    if (originalFontSize) element.style.fontSize = originalFontSize
    if (originalLineHeight) element.style.lineHeight = originalLineHeight
    
    element.style.removeProperty("color")
    element.style.removeProperty("font-weight")
    element.style.removeProperty("letter-spacing")
    element.removeAttribute("data-silver-surfer-magnified")
    element.removeAttribute("data-original-font-size")
    element.removeAttribute("data-original-line-height")
  })

  return { success: true, message: `Reset ${magnified.length} magnified elements` }
}

/**
 * Smoothly scrolls the page so the target element is perfectly centered
 */
export function scrollToView(selector: string): { success: boolean; message: string } {
  const element = document.querySelector(selector) as HTMLElement
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` }
  }

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center"
  })

  // Highlight briefly after scrolling
  setTimeout(() => {
    highlightElement(selector)
    setTimeout(() => removeHighlights(), 3000)
  }, 500)

  return { success: true, message: `Scrolled to element: ${selector}` }
}

/**
 * Clicks a button or link on behalf of the user
 * Only allows safe navigation actions, blocks payment/confirmation buttons
 */
export function clickElement(selector: string): { success: boolean; message: string } {
  const element = document.querySelector(selector) as HTMLElement
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` }
  }

  // Check for unsafe actions
  const unsafePatterns = [
    /pay/i, /purchase/i, /buy/i, /checkout/i, /order/i,
    /confirm/i, /submit.*order/i, /complete.*purchase/i,
    /delete/i, /remove/i, /cancel.*subscription/i,
    /sign.*out/i, /log.*out/i, /disconnect/i,
    /unsubscribe/i, /deactivate/i
  ]

  const elementText = element.textContent || ""
  const elementValue = (element as HTMLInputElement).value || ""
  const ariaLabel = element.getAttribute("aria-label") || ""
  const combinedText = `${elementText} ${elementValue} ${ariaLabel}`.toLowerCase()

  for (const pattern of unsafePatterns) {
    if (pattern.test(combinedText)) {
      return { 
        success: false, 
        message: `Blocked: This appears to be a sensitive action (${pattern.source}). Please click manually.` 
      }
    }
  }

  // Perform the click
  element.click()
  return { success: true, message: `Clicked element: ${selector}` }
}

/**
 * Types text into an input field
 */
export function fillFormField(selector: string, value: string): { success: boolean; message: string } {
  const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` }
  }

  if (!["INPUT", "TEXTAREA"].includes(element.tagName)) {
    return { success: false, message: `Element is not an input field: ${element.tagName}` }
  }

  // Check for sensitive fields we shouldn't auto-fill
  const sensitiveTypes = ["password", "credit-card", "cc-number", "cc-exp", "cc-csc", "cvv"]
  const inputType = (element as HTMLInputElement).type || ""
  const autoComplete = element.getAttribute("autocomplete") || ""

  if (sensitiveTypes.includes(inputType) || sensitiveTypes.some(t => autoComplete.includes(t))) {
    return { success: false, message: "Blocked: Cannot auto-fill sensitive fields (passwords, credit cards)" }
  }

  // Focus and fill
  element.focus()
  element.value = value

  // Dispatch events to trigger any listeners
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))

  return { success: true, message: `Filled field with: "${value.substring(0, 20)}${value.length > 20 ? "..." : ""}"` }
}

/**
 * Picks an option from a dropdown menu
 */
export function selectDropdown(selector: string, value: string): { success: boolean; message: string } {
  const element = document.querySelector(selector) as HTMLSelectElement
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` }
  }

  if (element.tagName !== "SELECT") {
    return { success: false, message: `Element is not a select dropdown: ${element.tagName}` }
  }

  // Find the option by value or text
  let optionFound = false
  for (const option of Array.from(element.options)) {
    if (option.value === value || option.textContent?.trim().toLowerCase() === value.toLowerCase()) {
      element.value = option.value
      optionFound = true
      break
    }
  }

  if (!optionFound) {
    const availableOptions = Array.from(element.options).map(o => o.textContent?.trim()).join(", ")
    return { success: false, message: `Option "${value}" not found. Available: ${availableOptions}` }
  }

  // Dispatch change event
  element.dispatchEvent(new Event("change", { bubbles: true }))

  return { success: true, message: `Selected option: "${value}"` }
}
