// For local development, use the Next.js backend
// For production, update to your deployed backend URL
// Can be overridden via PLASMO_PUBLIC_API_URL environment variable
export const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "http://100.111.130.40:3001"
