import { AUTH0_CLIENT_ID, AUTH0_DOMAIN, getRedirectUrl } from "./auth-config"
import { api } from "./api"

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
  idToken: string | null
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  ID_TOKEN: "auth_id_token",
  USER: "auth_user",
  EXPIRES_AT: "auth_expires_at"
}

// Build Auth0 authorization URL
function buildAuthUrl(): string {
  const redirectUrl = getRedirectUrl()
  const params = new URLSearchParams({
    response_type: "id_token token",
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: redirectUrl,
    scope: "openid profile email",
    prompt: "login"
  })

  return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`
}

// Parse the access token and id token from the redirect URL
function parseTokenFromUrl(url: string): { accessToken: string; idToken: string | null; expiresIn: number } | null {
  try {
    const hashParams = new URLSearchParams(url.split("#")[1])
    const accessToken = hashParams.get("access_token")
    const idToken = hashParams.get("id_token")
    const expiresIn = parseInt(hashParams.get("expires_in") || "0", 10)

    if (accessToken) {
      return { accessToken, idToken, expiresIn }
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

// Register/authenticate user with backend using id_token
async function registerWithBackend(idToken: string | null): Promise<void> {
  if (!idToken) {
    console.warn("No id_token available for backend registration")
    return
  }

  try {
    const response = await api.post("/api/auth/oauth", {
      provider: "Auth0",
      idToken: idToken
    })

    if (!response.success) {
      console.error("Backend registration failed:", response.error)
      // Don't throw - we still want to proceed with local auth state
      // The user is authenticated with Auth0 even if backend registration fails
    } else {
      console.log("Successfully registered/authenticated with backend")
    }
  } catch (e) {
    console.error("Error during backend registration:", e)
    // Don't throw - proceed with local auth state
  }
}

// Save auth state to chrome.storage
async function saveAuthState(accessToken: string, idToken: string | null, user: AuthUser, expiresIn: number): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000
  await chrome.storage.local.set({
    [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
    [STORAGE_KEYS.ID_TOKEN]: idToken,
    [STORAGE_KEYS.USER]: user,
    [STORAGE_KEYS.EXPIRES_AT]: expiresAt
  })
}

// Clear auth state from chrome.storage
async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.ID_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.EXPIRES_AT
  ])
}

// Get current auth state from chrome.storage
export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.ID_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.EXPIRES_AT
  ])

  const accessToken = result[STORAGE_KEYS.ACCESS_TOKEN]
  const idToken = result[STORAGE_KEYS.ID_TOKEN]
  const user = result[STORAGE_KEYS.USER]
  const expiresAt = result[STORAGE_KEYS.EXPIRES_AT]

  // Check if token is expired
  if (accessToken && expiresAt && Date.now() < expiresAt) {
    return {
      isAuthenticated: true,
      user,
      accessToken,
      idToken: idToken || null
    }
  }

  // Token expired or not present
  return {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    idToken: null
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

        // Register/authenticate with backend using id_token
        await registerWithBackend(tokenData.idToken)

        await saveAuthState(tokenData.accessToken, tokenData.idToken, user, tokenData.expiresIn)

        resolve({
          isAuthenticated: true,
          user,
          accessToken: tokenData.accessToken,
          idToken: tokenData.idToken
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
