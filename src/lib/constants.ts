// For local development, use the Next.js backend
// For production, update to your deployed backend URL
// Can be overridden via PLASMO_PUBLIC_API_URL environment variable
// export const API_BASE_URL = "https://personal-nextjs-backend-keemudndda-nn.a.run.app"
export const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:3000"