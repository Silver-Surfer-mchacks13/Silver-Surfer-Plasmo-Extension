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
  
  // Clean up any inline styles we might have set directly previously, relying on the injected stylesheet
  // We set these merely as fallback, but the stylesheet is the main driver
  element.style.setProperty("outline", "4px solid #000", "important")
  element.style.setProperty("outline-offset", "2px", "important")
  element.style.setProperty("box-shadow", "6px 6px 0 0 #3b82f6", "important") // Comic Blue shadow
  element.style.setProperty("position", "relative", "important")
  element.style.setProperty("z-index", "2147483647", "important")

  // Add flashing/pulsing comic animation style
  const style = document.createElement("style")
  style.id = "silver-surfer-highlight-style"
  style.textContent = `
    [data-silver-surfer-highlight="true"] {
      animation: silver-surfer-jiggle 2s ease-in-out infinite;
      outline: 4px solid #000 !important;
      box-shadow: 6px 6px 0 0 #3b82f6 !important;
    }
    
    /* Comic Action Badge */
    [data-silver-surfer-highlight="true"]::after {
      content: "ACTION!";
      position: absolute;
      top: -30px;
      left: -10px;
      background: #fbbf24; /* Comic Yellow */
      border: 3px solid #000;
      color: #000;
      padding: 0px 8px;
      font-family: "Comic Sans MS", "Chalkboard SE", sans-serif;
      font-weight: 900;
      font-size: 14px;
      box-shadow: 3px 3px 0px 0px #000;
      z-index: 2147483647;
      white-space: nowrap;
      pointer-events: none;
      animation: silver-surfer-float 1s ease-in-out infinite alternate;
    }

    @keyframes silver-surfer-jiggle {
      0%, 100% { transform: rotate(-0.5deg) scale(1.0); }
      50% { transform: rotate(0.5deg) scale(1.01); }
    }
    
    @keyframes silver-surfer-float {
      from { transform: translateY(0); }
      to { transform: translateY(-5px); }
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

// ============================================
// DOM DISTILLER - LLM-friendly page structure
// ============================================

interface DOMElement {
  index: number // Position in document flow
  selector: string
  tag: string
  type?: string // For inputs/buttons
  role?: string
  text?: string
  placeholder?: string
  value?: string
  href?: string
  src?: string
  alt?: string
  ariaLabel?: string
  isVisible: boolean
  isInteractive: boolean
  options?: string[] // For select elements
}

interface DistilledDOM {
  url: string
  title: string
  metaDescription: string | null
  fullText: string // Full text content of the page
  timestamp: string
  viewport: { width: number; height: number }
  summary: {
    totalElements: number
    interactiveElements: number
    headings: number
    links: number
    buttons: number
    inputs: number
    images: number
  }
  elements: DOMElement[] // Flat list in document flow order
}

/**
 * Generates a unique CSS selector for an element
 */
function generateSelector(element: Element): string {
  // Try ID first (most reliable)
  if (element.id) {
    return `#${CSS.escape(element.id)}`
  }

  // Try unique class combination
  if (element.classList.length > 0) {
    const classes = Array.from(element.classList).slice(0, 3).map(c => `.${CSS.escape(c)}`).join("")
    const matches = document.querySelectorAll(classes)
    if (matches.length === 1) {
      return classes
    }
  }

  // Try data attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith("data-") && attr.value) {
      const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`
      const matches = document.querySelectorAll(selector)
      if (matches.length === 1) {
        return selector
      }
    }
  }

  // Build path-based selector
  const path: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()
    
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`
      path.unshift(selector)
      break
    }

    // Add nth-child if needed
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }

    path.unshift(selector)
    current = parent
  }

  return path.join(" > ")
}

/**
 * Checks if an element is visible in the viewport
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false
  }
  
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * Truncates text to a reasonable length for LLM context
 */
function truncateText(text: string | null | undefined, maxLength: number = 100): string | undefined {
  if (!text) return undefined
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.substring(0, maxLength) + "..."
}

/**
 * Extracts element information for LLM consumption
 */
function extractElementInfo(element: Element, index: number): DOMElement {
  const el = element as HTMLElement
  const inputEl = element as HTMLInputElement
  const selectEl = element as HTMLSelectElement

  const info: DOMElement = {
    index,
    selector: generateSelector(element),
    tag: element.tagName.toLowerCase(),
    isVisible: isElementVisible(element),
    isInteractive: ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) ||
                   el.getAttribute("role") === "button" ||
                   el.onclick !== null ||
                   el.hasAttribute("tabindex")
  }

  // Text content
  const directText = Array.from(element.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent?.trim())
    .filter(Boolean)
    .join(" ")
  
  info.text = truncateText(directText || element.textContent)

  // Type for inputs/buttons
  if (inputEl.type) info.type = inputEl.type
  
  // Role
  const role = el.getAttribute("role")
  if (role) info.role = role

  // Placeholder
  if (inputEl.placeholder) info.placeholder = inputEl.placeholder

  // Current value (not for passwords)
  if (inputEl.value && inputEl.type !== "password") {
    info.value = truncateText(inputEl.value, 50)
  }

  // Href for links
  const href = el.getAttribute("href")
  if (href && !href.startsWith("javascript:")) {
    info.href = href.startsWith("/") ? href : truncateText(href, 80)
  }

  // Src and alt for images
  const img = element as HTMLImageElement
  if (img.src) info.src = truncateText(img.src, 80)
  if (img.alt) info.alt = truncateText(img.alt, 80)

  // Aria label
  const ariaLabel = el.getAttribute("aria-label")
  if (ariaLabel) info.ariaLabel = truncateText(ariaLabel)

  // Options for select
  if (element.tagName === "SELECT") {
    info.options = Array.from(selectEl.options).map(o => o.textContent?.trim() || o.value).slice(0, 10)
    if (selectEl.options.length > 10) {
      info.options.push(`... and ${selectEl.options.length - 10} more`)
    }
  }

  return info
}

/**
 * Distills the DOM into a structured, LLM-friendly JSON format
 * Elements are returned in document flow order as a flat list
 */
export function distillDOM(): { success: boolean; message: string; data?: DistilledDOM } {
  try {
    // Ensure document is ready
    if (!document || !document.documentElement) {
      return {
        success: false,
        message: "Document not ready"
      }
    }

    // Get meta description
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement
    
    // Extract full text content from the body
    const extractFullText = (): string => {
      const body = document.body
      if (!body) return ""
      
      try {
        // Clone the body to avoid modifying the actual DOM
        const clone = body.cloneNode(true) as HTMLElement
        
        // Remove script, style, and other non-content elements
        const removeSelectors = ["script", "style", "noscript", "svg", "iframe", "template"]
        removeSelectors.forEach(sel => {
          clone.querySelectorAll(sel).forEach(el => el.remove())
        })
        
        // Get text content and clean it up
        const text = clone.textContent || ""
        return text
          .replace(/\s+/g, " ")  // Collapse whitespace
          .replace(/\n\s*\n/g, "\n")  // Remove empty lines
          .trim()
      } catch (error) {
        console.warn("Error extracting full text:", error)
        return body.textContent || ""
      }
    }
    
    const distilled: DistilledDOM = {
      url: window.location.href,
      title: document.title || "",
      metaDescription: metaDesc?.content || null,
      fullText: extractFullText(),
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0
      },
      summary: {
        totalElements: 0,
        interactiveElements: 0,
        headings: 0,
        links: 0,
        buttons: 0,
        inputs: 0,
        images: 0
      },
      elements: []
    }

    // Selector for all relevant elements we want to capture
    const relevantSelector = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p",
      "a[href]",
      "button", "[role='button']", "input[type='submit']", "input[type='button']",
      "input:not([type='hidden'])", "textarea", "select",
      "img[alt]", "img[src]",
      "nav", "[role='navigation']",
      "main", "article", "[role='main']",
      "form",
      "header", "footer", "aside",
      "[role='banner']", "[role='search']", "[role='contentinfo']",
      "label",
      "ul", "ol",
      "table"
    ].join(", ")

    // Query all relevant elements
    const allElements = document.querySelectorAll(relevantSelector)
    
    // Create a map to track which elements we've seen (to avoid duplicates)
    const seenElements = new Set<Element>()
    
    // Sort elements by document position (document flow order)
    const sortedElements = Array.from(allElements).sort((a, b) => {
      const position = a.compareDocumentPosition(b)
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
      return 0
    })

    let index = 0
    for (const element of sortedElements) {
      try {
        // Skip duplicates
        if (seenElements.has(element)) continue
        seenElements.add(element)

        // Skip hidden elements
        if (!isElementVisible(element)) continue

        // Extract element info
        const info = extractElementInfo(element, index)
        if (info) {
          distilled.elements.push(info)
          index++

          // Update summary counts
          const tag = element.tagName.toLowerCase()
          if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
            distilled.summary.headings++
          } else if (tag === "a") {
            distilled.summary.links++
          } else if (tag === "button" || element.getAttribute("role") === "button" || 
                     (tag === "input" && ["submit", "button"].includes((element as HTMLInputElement).type))) {
            distilled.summary.buttons++
          } else if (["input", "textarea", "select"].includes(tag)) {
            distilled.summary.inputs++
          } else if (tag === "img") {
            distilled.summary.images++
          }

          if (info.isInteractive) {
            distilled.summary.interactiveElements++
          }
        }
      } catch (elementError) {
        // Log but continue processing other elements
        console.warn("Error processing element:", elementError, element)
        continue
      }
    }

    distilled.summary.totalElements = distilled.elements.length

    // Ensure we always return a valid data object
    if (!distilled || typeof distilled !== 'object') {
      console.error("Invalid distilled object created:", distilled)
      return {
        success: false,
        message: "Failed to create distilled DOM object"
      }
    }

    // Ensure elements is always an array
    if (!Array.isArray(distilled.elements)) {
      console.error("Elements is not an array:", distilled.elements)
      distilled.elements = []
      distilled.summary.totalElements = 0
    }

    return { 
      success: true, 
      message: `Distilled ${distilled.summary.totalElements} elements in document flow order`,
      data: distilled 
    }
  } catch (error) {
    console.error("Error in distillDOM:", error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to distill DOM" 
    }
  }
}

// ============================================
// PAGE SIMPLIFICATION - Overlay-based focused views
// ============================================

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

interface SimplifiedContent {
  title: string
  sections: SimplifiedSection[]
  message: string
}

/**
 * Creates and displays an overlay with simplified page content
 * The overlay is styled in comic-book theme and allows interaction with original page elements
 */
export function applySimplification(
  content: SimplifiedContent
): { success: boolean; message: string } {
  try {
    // First, remove any existing overlay
    removeSimplification()

    // Create overlay container
    const overlay = document.createElement("div")
    overlay.id = "silver-surfer-simplify-overlay"
    overlay.innerHTML = `
      <div class="ss-overlay-backdrop"></div>
      <div class="ss-overlay-container">
        <div class="ss-overlay-header">
          <h1 class="ss-overlay-title">${escapeHtml(content.title)}</h1>
          <p class="ss-overlay-message">${escapeHtml(content.message)}</p>
          <button class="ss-overlay-close" aria-label="Close simplified view">
            <span>✕</span> Exit Simplified View
          </button>
        </div>
        <div class="ss-overlay-content">
          ${content.sections.map(section => `
            <div class="ss-section">
              ${section.heading ? `<h2 class="ss-section-heading">${escapeHtml(section.heading)}</h2>` : ''}
              <div class="ss-section-items">
                ${section.items.map(item => renderItem(item)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `

    // Add styles
    const style = document.createElement("style")
    style.id = "silver-surfer-simplify-style"
    style.textContent = `
      #silver-surfer-simplify-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .ss-overlay-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }
      
      .ss-overlay-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 900px;
        max-height: 85vh;
        background: #fff;
        border: 4px solid #000;
        border-radius: 16px;
        box-shadow: 8px 8px 0 0 #3b82f6;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .ss-overlay-header {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        padding: 20px 24px;
        border-bottom: 4px solid #000;
        position: relative;
      }
      
      .ss-overlay-title {
        color: #fff;
        font-size: 28px;
        font-weight: 900;
        margin: 0 0 8px 0;
        text-shadow: 2px 2px 0 #000;
        letter-spacing: 1px;
      }
      
      .ss-overlay-message {
        color: rgba(255,255,255,0.9);
        font-size: 14px;
        margin: 0;
      }
      
      .ss-overlay-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: #fbbf24;
        border: 3px solid #000;
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 3px 3px 0 0 #000;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .ss-overlay-close:hover {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0 0 #000;
      }
      
      .ss-overlay-content {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
        background: #f8fafc;
      }
      
      .ss-section {
        margin-bottom: 24px;
      }
      
      .ss-section-heading {
        font-size: 20px;
        font-weight: 800;
        color: #1e293b;
        margin: 0 0 16px 0;
        padding-bottom: 8px;
        border-bottom: 3px solid #3b82f6;
        display: inline-block;
      }
      
      .ss-section-items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }
      
      .ss-item {
        background: #fff;
        border: 3px solid #000;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 4px 4px 0 0 #e2e8f0;
        transition: all 0.15s ease;
        cursor: pointer;
      }
      
      .ss-item:hover {
        transform: translate(2px, 2px);
        box-shadow: 2px 2px 0 0 #e2e8f0;
        background: #f0f9ff;
      }
      
      .ss-item-text {
        font-size: 16px;
        line-height: 1.5;
        color: #334155;
      }
      
      .ss-item-link {
        color: #2563eb;
        text-decoration: none;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .ss-item-link::before {
        content: "→";
        font-weight: bold;
      }
      
      .ss-item-button {
        background: #10b981;
        color: #fff;
        border: 3px solid #000;
        padding: 12px 20px;
        font-size: 16px;
        font-weight: bold;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 3px 3px 0 0 #000;
        transition: all 0.15s ease;
        width: 100%;
        text-align: center;
      }
      
      .ss-item-button:hover {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0 0 #000;
      }
      
      .ss-item-image {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 8px;
        border: 2px solid #e2e8f0;
        margin-bottom: 12px;
      }
      
      .ss-item-price {
        font-size: 22px;
        font-weight: 900;
        color: #059669;
        margin-top: 8px;
      }
      
      .ss-item-content {
        font-size: 15px;
        color: #475569;
        margin-top: 4px;
      }

      /* Scrollbar styling */
      .ss-overlay-content::-webkit-scrollbar {
        width: 12px;
      }
      
      .ss-overlay-content::-webkit-scrollbar-track {
        background: #e2e8f0;
        border-radius: 6px;
      }
      
      .ss-overlay-content::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 6px;
        border: 2px solid #e2e8f0;
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(overlay)

    // Add close button handler
    const closeBtn = overlay.querySelector(".ss-overlay-close")
    if (closeBtn) {
      closeBtn.addEventListener("click", () => removeSimplification())
    }

    // Add click handlers for items to interact with original page
    overlay.querySelectorAll("[data-ss-selector]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const selector = (e.currentTarget as HTMLElement).getAttribute("data-ss-selector")
        if (selector) {
          const originalEl = document.querySelector(selector) as HTMLElement
          if (originalEl) {
            // For links, navigate
            if (originalEl.tagName === "A") {
              window.location.href = (originalEl as HTMLAnchorElement).href
            } else {
              // For buttons/other, click and close overlay
              originalEl.click()
              removeSimplification()
            }
          }
        }
      })
    })

    // Add escape key handler
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeSimplification()
        document.removeEventListener("keydown", escHandler)
      }
    }
    document.addEventListener("keydown", escHandler)

    return {
      success: true,
      message: `Simplified view created with ${content.sections.length} sections`
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to apply simplification"
    }
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function renderItem(item: SimplifiedItem): string {
  const selectorAttr = `data-ss-selector="${escapeHtml(item.selector)}"`
  
  switch (item.type) {
    case "image":
      return `
        <div class="ss-item" ${selectorAttr}>
          ${item.src ? `<img class="ss-item-image" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.content)}" />` : ''}
          <div class="ss-item-content">${escapeHtml(item.content)}</div>
          ${item.price ? `<div class="ss-item-price">${escapeHtml(item.price)}</div>` : ''}
        </div>
      `
    case "link":
      return `
        <div class="ss-item" ${selectorAttr}>
          <a class="ss-item-link" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.content)}</a>
        </div>
      `
    case "button":
      return `
        <button class="ss-item ss-item-button" ${selectorAttr}>${escapeHtml(item.content)}</button>
      `
    case "text":
    default:
      return `
        <div class="ss-item">
          <p class="ss-item-text">${escapeHtml(item.content)}</p>
        </div>
      `
  }
}

/**
 * Removes the simplification overlay and restores normal view
 */
export function removeSimplification(): { success: boolean; message: string } {
  try {
    // Remove overlay
    const overlay = document.getElementById("silver-surfer-simplify-overlay")
    if (overlay) overlay.remove()

    // Remove style
    const style = document.getElementById("silver-surfer-simplify-style")
    if (style) style.remove()

    return {
      success: true,
      message: "Simplified view closed"
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove simplification"
    }
  }
}

