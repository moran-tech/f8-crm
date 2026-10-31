import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createApi } from './api/client.ts'
import { createDemoApi } from './api/demo.ts'
import { authExpiredEvent, isValidSession, readSession, saveSession } from './api/auth.ts'
import type { CrmApi, CrmEvent, PeopleFilters, Session } from './api/types.ts'
import { config } from './config.ts'
import { useHashRoute, useResource } from './hooks.ts'
import { Icon } from './components/ui.tsx'
import { OverviewPage } from './pages/Overview.tsx'
import { PeoplePage } from './pages/People.tsx'
import { PersonPage } from './pages/Person.tsx'
import './App.css'

const noEvents: CrmEvent[] = []

function Brand({ light = false }: { light?: boolean }) {
  return <span className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark">f8<span>✳</span></span><span className="brand-name">SOCIAL<br />CLUB<span className="brand-location">SURREY, BC</span></span></span>
}

function Login({ api, onLogin, expired }: { api: CrmApi; onLogin: (session: Session) => void; expired: boolean }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { document.title = 'Sign in · F8 Social Club' }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const session = await api.login(password)
      setPassword('')
      onLogin(session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="login-layout">
    <section className="login-story"><Brand light /><div className="login-story-copy"><span className="hero-label">GOOD PEOPLE. REAL CONNECTIONS.</span><h2>A room full<br />of possibility<span>.</span></h2><p>Behind every great get-together,<br />there’s a thoughtful hello.</p><div className="login-art" aria-hidden="true"><span>✳</span><i /><i /></div></div><span className="login-location">MADE FOR CONNECTIONS IN SURREY, BC</span></section>
    <section className="login-form-side"><div className="login-mobile-brand"><Brand /></div><div className="login-form-card"><span className="login-lock"><Icon name="lock" size={23} /></span><p className="eyebrow">YOUR PRIVATE LITTLE CORNER</p><h1>Welcome back, Faith.</h1><p className="login-description">Let’s turn a few hellos into a full room.</p>
      {expired && <p className="session-notice" role="status">Your session ended. Sign in to pick up where you left off.</p>}
      <form onSubmit={submit}><label className="field-label" htmlFor="password">Password<input id="password" type="password" name="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby={error ? 'login-error' : undefined} autoFocus /></label>
        {error && <p className="inline-error" id="login-error" role="alert">{error}</p>}
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Signing in…' : <>Sign in<Icon name="arrow" size={18} /></>}</button>
      </form><p className="login-privacy"><Icon name="lock" size={13} />Just you. Your people. Your next great event.</p>
    </div><p className="login-footer">F8 SOCIAL CLUB · OUTREACH WORKSPACE</p></section>
  </main>
}

function Workspace({ api, onSignOut }: { api: CrmApi; onSignOut: () => void }) {
  const hash = useHashRoute()
  const personMatch = /^#\/people\/([^/]+)$/.exec(hash)
  let personId = ''
  try { personId = personMatch ? decodeURIComponent(personMatch[1]!) : '' } catch { /* Malformed links fall back to the overview. */ }
  const isPeople = hash === '#/people'
  const [selectedEvent, setSelectedEvent] = useState<string>(config.defaultEvent)
  const [filters, setFilters] = useState<PeopleFilters>({ q: '', event: config.defaultEvent, status: '' })
  const [revision, setRevision] = useState(0)
  const [toast, setToast] = useState('')
  const returnRoute = useRef('')
  const main = useRef<HTMLElement>(null)
  const eventResource = useResource('events', () => api.events())
  const events = eventResource.data ?? noEvents
  const eventKey = events.length && !events.some(event => event.key === selectedEvent) ? events[0]!.key : selectedEvent
  useEffect(() => {
    window.scrollTo({ top: 0 })
    main.current?.focus({ preventScroll: true })
    document.title = `${personId ? 'Connection' : isPeople ? 'People' : 'Overview'} · F8 Social Club`
  }, [hash, personId, isPeople])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  function back() {
    if (returnRoute.current) {
      returnRoute.current = ''
      window.history.back()
    } else {
      window.location.hash = '#/people'
    }
  }
  function saved() {
    setRevision(current => current + 1)
    setToast(config.demo ? 'Saved to your demo. Refresh to reset.' : 'Connection updated. Nice follow-through.')
  }
  function openPerson() { returnRoute.current = hash }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus() }}>Skip to content</a>
    <header className="app-header"><a className="brand-link" href="#/overview" aria-label="F8 Social Club overview"><Brand /></a><div className="header-right"><span className="workspace-label"><span className="live-dot" />FAITH’S WORKSPACE</span>
      <details className="account-menu"><summary aria-label="Workspace menu"><span className="account-avatar">F</span><span className="menu-chevron" aria-hidden="true"><Icon name="arrow" size={13} /></span></summary><div className="account-dropdown"><strong>F8 Social Club</strong><span>{config.demo ? 'Fictional demo workspace' : 'Private outreach CRM'}</span>{config.demo ? <button onClick={() => window.location.reload()}><Icon name="back" size={16} />Reset demo data</button> : <button onClick={onSignOut}><Icon name="exit" size={16} />Sign out</button>}</div></details>
    </div></header>
    {config.demo && <aside className="demo-banner" aria-label="Demo workspace notice"><span><strong>Demo mode</strong> · All people are fictional. Edits reset on refresh.</span>{!config.demoForced && <a href={window.location.pathname}>Exit demo<Icon name="arrow" size={12} /></a>}</aside>}
    {eventResource.error && <div className="event-load-error" role="alert">Could not load the event picker. <button className="text-button" onClick={eventResource.retry}>Retry events</button></div>}
    <main id="main-content" ref={main} tabIndex={-1} className={`main-content ${personId ? 'detail-main' : ''}`}>
      {personId ? <PersonPage key={personId} api={api} id={personId} onBack={back} onSaved={saved} />
        : isPeople ? <PeoplePage api={api} events={events} filters={filters} onFiltersChange={setFilters} revision={revision} onOpenPerson={openPerson} />
          : <OverviewPage api={api} events={events} selectedEvent={eventKey} onEventChange={setSelectedEvent} revision={revision} onOpenPerson={openPerson} />}
    </main>
    {!personId && <nav className="bottom-nav" aria-label="Main navigation"><a href="#/overview" className={!isPeople ? 'active' : ''} aria-current={!isPeople ? 'page' : undefined}><Icon name="grid" size={21} /><span>Overview</span></a><a href="#/people" className={isPeople ? 'active' : ''} aria-current={isPeople ? 'page' : undefined}><Icon name="people" size={21} /><span>People</span></a></nav>}
    <div className="toast-region" role="status" aria-live="polite">{toast && <div className="toast"><Icon name="check" size={17} />{toast}</div>}</div>
  </div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [expired, setExpired] = useState(false)
  const api = useMemo(() => config.demo ? createDemoApi() : createApi(() => session), [session])
  useEffect(() => {
    if (config.demo) return
    const expire = () => { saveSession(null); setSession(null); setExpired(true) }
    const checkExpiry = () => { if (session && !isValidSession(session)) expire() }
    const interval = setInterval(checkExpiry, 1000)
    window.addEventListener(authExpiredEvent, expire)
    window.addEventListener('focus', checkExpiry)
    const syncStorage = () => setSession(readSession())
    window.addEventListener('storage', syncStorage)
    return () => {
      clearInterval(interval)
      window.removeEventListener(authExpiredEvent, expire)
      window.removeEventListener('focus', checkExpiry)
      window.removeEventListener('storage', syncStorage)
    }
  }, [session])
  function login(next: Session) { saveSession(next); setSession(next); setExpired(false) }
  function signOut() { saveSession(null); setSession(null); setExpired(false); window.location.hash = '#/overview' }
  return session || config.demo ? <Workspace api={api} onSignOut={signOut} /> : <Login api={api} onLogin={login} expired={expired} />
}
