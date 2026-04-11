export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'https://api.reviseos.co.uk/api',
  appUrl: import.meta.env.VITE_APP_URL ?? 'https://app.reviseos.co.uk',
  loginUrl: import.meta.env.VITE_LOGIN_URL ?? 'https://login.reviseos.co.uk',
} as const
