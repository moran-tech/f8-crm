const indexKey = 'f8CrmRouteIndex'
const currentHash = () => window.location.hash || '#/overview'

/** Keep entry positions so a cancelled traversal returns without rewriting its destination. */
export function watchHashRoute(canNavigate: () => boolean, onChange: (hash: string) => void) {
  let acceptedHash = currentHash()
  let acceptedIndex: number = window.history.state?.[indexKey] ?? 0
  let restoring = false
  const markEntry = (index: number) => window.history.replaceState({ ...window.history.state, [indexKey]: index }, '')
  markEntry(acceptedIndex)
  const update = () => {
    const next = currentHash()
    const index: number = window.history.state?.[indexKey] ?? acceptedIndex + 1
    if (restoring) {
      if (index === acceptedIndex && next === acceptedHash) restoring = false
      return
    }
    // Native hash links create entries without state; traversals retain their index.
    if (window.history.state?.[indexKey] == null) markEntry(index)
    if (next !== acceptedHash && !canNavigate()) {
      restoring = true
      window.history.go(acceptedIndex - index)
      return
    }
    acceptedIndex = index
    if (next === acceptedHash) return
    acceptedHash = next
    onChange(next)
  }
  window.addEventListener('popstate', update)
  window.addEventListener('hashchange', update)
  return () => {
    window.removeEventListener('popstate', update)
    window.removeEventListener('hashchange', update)
  }
}

/** Replace a submitted form without losing this entry's routing index. */
export function replaceHashRoute(hash: string) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
