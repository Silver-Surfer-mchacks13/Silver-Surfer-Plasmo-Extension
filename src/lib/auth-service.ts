import { AUTH0_CLIENT_ID, AUTH0_DOMAIN, getRedirectUrl } from "./auth-config"

export interface AuthUser {
  sub: string
  email?: string
  name?: string
  picture?: string
  nickname?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  accessToken: string | null
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  USER: "auth_user",
  EXPIRES_AT: "auth_expires_at"
}

// Build Auth0 authorization URL
function buildAuthUrl(): string {
  const redirectUrl = getRedirectUrl()
  const params = new URLSearchParams({
    response_type: "token",
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: redirectUrl,
    scope: "openid profile email",
    prompt: "login"
  })
  
  return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`
}

// Parse the access token from the redirect URL
function parseTokenFromUrl(url: string): { accessToken: string; expiresIn: number } | null {
  try {
    const hashParams = new URLSearchParams(url.split("#")[1])
    const accessToken = hashParams.get("access_token")
    const expiresIn = parseInt(hashParams.get("expires_in") || "0", 10)
    
    if (accessToken) {
      return { accessToken, expiresIn }
    }
  } catch (e) {
    console.error("Failed to parse token from URL:", e)
  }
  return null
}

// Fetch user info from Auth0
async function fetchUserInfo(accessToken: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    
    if (response.ok) {
      return await response.json()
    }
  } catch (e) {
    console.error("Failed to fetch user info:", e)
  }
  return null
}

// Save auth state to chrome.storage
async function saveAuthState(accessToken: string, user: AuthUser, expiresIn: number): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000
  await chrome.storage.local.set({
    [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
    [STORAGE_KEYS.USER]: user,
    [STORAGE_KEYS.EXPIRES_AT]: expiresAt
  })
}

// Clear auth state from chrome.storage
async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.EXPIRES_AT
  ])
}

// Get current auth state from chrome.storage
export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.EXPIRES_AT
  ])
  
  const accessToken = result[STORAGE_KEYS.ACCESS_TOKEN]
  const user = result[STORAGE_KEYS.USER]
  const expiresAt = result[STORAGE_KEYS.EXPIRES_AT]
  
  // Check if token is expired
  if (accessToken && expiresAt && Date.now() < expiresAt) {
    return {
      isAuthenticated: true,
      user,
      accessToken
    }
  }
  
  // Token expired or not present
  return {
    isAuthenticated: false,
    user: null,
    accessToken: null
  }
}

// Login using Auth0 via chrome.identity.launchWebAuthFlow
export async function login(): Promise<AuthState> {
  return new Promise((resolve, reject) => {
    const authUrl = buildAuthUrl()
    
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error("Auth flow error:", chrome.runtime.lastError)
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        
        if (!redirectUrl) {
          reject(new Error("No redirect URL received"))
          return
        }
        
        const tokenData = parseTokenFromUrl(redirectUrl)
        if (!tokenData) {
          reject(new Error("Failed to parse access token"))
          return
        }
        
        const user = await fetchUserInfo(tokenData.accessToken)
        if (!user) {
          reject(new Error("Failed to fetch user info"))
          return
        }
        
        await saveAuthState(tokenData.accessToken, user, tokenData.expiresIn)
        
        resolve({
          isAuthenticated: true,
          user,
          accessToken: tokenData.accessToken
        })
      }
    )
  })
}

// Logout - clear stored tokens
export async function logout(): Promise<void> {
  await clearAuthState()
}

// Check if user is authenticated (can be called from any context)
export async function isAuthenticated(): Promise<boolean> {
  const state = await getAuthState()
  return state.isAuthenticated
}
