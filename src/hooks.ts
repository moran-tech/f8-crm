import { useEffect, useEffectEvent, useState } from 'react'

export function useResource<T>(key: string, load: () => Promise<T>) {
  const fetchData = useEffectEvent(load)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    key: string; attempt: number; data?: T; error?: string
  }>({ key: '', attempt: -1 })
  useEffect(() => {
    let active = true
    fetchData().then(
      data => { if (active) setState({ key, attempt, data }) },
      error => { if (active) setState({ key, attempt, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' }) },
    )
    return () => { active = false }
  }, [key, attempt])
  const current = state.key === key && state.attempt === attempt
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    retry: () => setAttempt(value => value + 1),
  }
}

export function useDebounced<T>(value: T, delay = 250) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/overview')
  useEffect(() => {
    const update = () => setHash(window.location.hash || '#/overview')
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return hash
}
