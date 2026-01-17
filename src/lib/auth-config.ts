// Auth0 Configuration
export const AUTH0_DOMAIN = "dev-02d7uzun0ohur5le.ca.auth0.com"
export const AUTH0_CLIENT_ID = "m35i5EPs4tYjPvfQQwuPvYN0PAUI6oU7"

// This will be set after you load the extension once to get the permanent ID
// The redirect URL format is: https://<extension-id>.chromiumapp.org/callback
export const getRedirectUrl = () => chrome.identity.getRedirectURL("callback")
