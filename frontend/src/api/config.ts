export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  authMode: import.meta.env.VITE_AUTH_MODE ?? "demo",
} as const;