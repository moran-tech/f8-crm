const env = import.meta.env

export const config = {
  apiBase: (env?.VITE_API_BASE || 'https://fireplace-waitlist.onrender.com').replace(/\/+$/, ''),
  demo: env?.VITE_DEMO === '1' || new URLSearchParams(globalThis.location?.search).get('demo') === '1',
  demoForced: env?.VITE_DEMO === '1',
  defaultEvent: 'eoy-mixer',
} as const
