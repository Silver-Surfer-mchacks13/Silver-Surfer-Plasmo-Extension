import { AUTH0_CLIENT_ID, AUTH0_DOMAIN, getRedirectUrl } from "./auth-config"
import { api } from "./api"
import { API_BASE_URL } from "./constants"

export interface AuthUser {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  nickname?: string
  updated_at?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  accessToken: string | null
  backendAccessToken: string | null
  backendRefreshToken: string | null
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  BACKEND_ACCESS_TOKEN: "backend_access_token",
  BACKEND_REFRESH_TOKEN: "backend_refresh_token",
  BACKEND_ACCESS_TOKEN_EXPIRES_AT: "backend_access_token_expires_at",
  BACKEND_REFRESH_TOKEN_EXPIRES_AT: "backend_refresh_token_expires_at",
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

// Register/authenticate user with backend using Auth0 profile
async function registerWithBackend(user: AuthUser): Promise<{
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
} | null> {
  console.log("registerWithBackend called with user:", user)

  // Validate required fields
  if (!user.email || !user.sub) {
    console.error("Missing required fields for backend registration:", { email: user.email, sub: user.sub })
    return null
  }

  try {
    const profileData = {
      email: user.email,
      email_verified: user.email_verified ?? true,
      sub: user.sub,
      name: user.name,
      given_name: user.given_name,
      family_name: user.family_name,
      nickname: user.nickname,
      picture: user.picture,
      updated_at: user.updated_at
    }

    console.log("Sending profile data to backend:", profileData)

    // Since login() is called from background script, make direct fetch call
    // instead of going through chrome.runtime.sendMessage
    const url = `${API_BASE_URL}/api/auth/auth0`
    const fetchResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profileData)
    })

    const data = await fetchResponse.json()
    const response = {
      success: fetchResponse.ok,
      data: fetchResponse.ok ? data : undefined,
      error: fetchResponse.ok ? undefined : data,
      status: fetchResponse.status
    }

    console.log("Backend registration response:", response)

    if (!response.success) {
      console.error("Backend registration failed:", response.error)
      // Don't throw - we still want to proceed with local auth state
      // The user is authenticated with Auth0 even if backend registration fails
      return null
    } else {
      console.log("Successfully registered/authenticated with backend")
      // Return tokens from response
      return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        accessTokenExpiresAt: response.data.accessTokenExpiresAt,
        refreshTokenExpiresAt: response.data.refreshTokenExpiresAt
      }
    }
  } catch (e) {
    console.error("Error during backend registration:", e)
    // Don't throw - proceed with local auth state
    return null
  }
}

// Save auth state to chrome.storage
async function saveAuthState(
  accessToken: string,
  user: AuthUser,
  expiresIn: number,
  backendTokens?: {
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: string
    refreshTokenExpiresAt: string
  }
): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000

  const storageData: Record<string, any> = {
    [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
    [STORAGE_KEYS.USER]: user,
    [STORAGE_KEYS.EXPIRES_AT]: expiresAt
  }

  // Save backend tokens if provided
  if (backendTokens) {
    storageData[STORAGE_KEYS.BACKEND_ACCESS_TOKEN] = backendTokens.accessToken
    storageData[STORAGE_KEYS.BACKEND_REFRESH_TOKEN] = backendTokens.refreshToken
    storageData[STORAGE_KEYS.BACKEND_ACCESS_TOKEN_EXPIRES_AT] = new Date(backendTokens.accessTokenExpiresAt).getTime()
    storageData[STORAGE_KEYS.BACKEND_REFRESH_TOKEN_EXPIRES_AT] = new Date(backendTokens.refreshTokenExpiresAt).getTime()
  }

  await chrome.storage.local.set(storageData)
}

// Clear auth state from chrome.storage
async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.BACKEND_ACCESS_TOKEN,
    STORAGE_KEYS.BACKEND_REFRESH_TOKEN,
    STORAGE_KEYS.BACKEND_ACCESS_TOKEN_EXPIRES_AT,
    STORAGE_KEYS.BACKEND_REFRESH_TOKEN_EXPIRES_AT,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.EXPIRES_AT
  ])
}

// Get current auth state from chrome.storage
export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.BACKEND_ACCESS_TOKEN,
    STORAGE_KEYS.BACKEND_REFRESH_TOKEN,
    STORAGE_KEYS.BACKEND_ACCESS_TOKEN_EXPIRES_AT,
    STORAGE_KEYS.BACKEND_REFRESH_TOKEN_EXPIRES_AT,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.EXPIRES_AT
  ])

  const accessToken = result[STORAGE_KEYS.ACCESS_TOKEN]
  const user = result[STORAGE_KEYS.USER]
  const expiresAt = result[STORAGE_KEYS.EXPIRES_AT]
  const backendAccessToken = result[STORAGE_KEYS.BACKEND_ACCESS_TOKEN]
  const backendRefreshToken = result[STORAGE_KEYS.BACKEND_REFRESH_TOKEN]

  // Check if token is expired
  if (accessToken && expiresAt && Date.now() < expiresAt) {
    return {
      isAuthenticated: true,
      user,
      accessToken,
      backendAccessToken: backendAccessToken || null,
      backendRefreshToken: backendRefreshToken || null
    }
  }

  // Token expired or not present
  return {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    backendAccessToken: null,
    backendRefreshToken: null
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

        // Register/authenticate with backend using Auth0 profile
        const backendTokens = await registerWithBackend(user)

        await saveAuthState(tokenData.accessToken, user, tokenData.expiresIn, backendTokens || undefined)

        resolve({
          isAuthenticated: true,
          user,
          accessToken: tokenData.accessToken,
          backendAccessToken: backendTokens?.accessToken || null,
          backendRefreshToken: backendTokens?.refreshToken || null
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
