import type { Session } from './types.ts'

const key = 'f8-crm-session'
export const authExpiredEvent = 'f8:auth-expired'

export function isValidSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<Session>
  return typeof session.token === 'string' && session.token.length > 0
    && typeof session.expiresAt === 'string' && Date.parse(session.expiresAt) > Date.now()
}

export function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null')
    if (isValidSession(value)) return value
    localStorage.removeItem(key)
  } catch {
    // Private browsing may disable storage. The current session still works in memory.
    saveSession(null)
  }
  return null
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(key, JSON.stringify(session))
    else localStorage.removeItem(key)
  } catch {
    // Storage is optional, authentication is not.
  }
}
