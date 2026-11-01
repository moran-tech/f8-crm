import type { ReactNode } from 'react'
import type { CrmEvent, PersonSummary, SponsorStatus } from '../api/types.ts'
import { platforms } from '../platforms.ts'
import { sponsorStatuses } from '../sponsors.ts'

const paths: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9.5" cy="7" r="4" /></>,
  arrow: <path d="m9 5 7 7-7 7" />,
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />,
  ticket: <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" /><path d="M15 5v3m0 3v2m0 3v3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  exit: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" /></>,
  sparkle: <><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 6 9 7 9-7" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.sparkle}</svg>
}

export function PlatformChip({ platform, compact = false }: { platform: string; compact?: boolean }) {
  const info = platforms[platform] ?? { ...platforms.other!, label: platform || 'Other' }
  return <span className={`platform-chip ${info.color} ${compact ? 'compact' : ''}`} title={info.label}>
    <span className="platform-symbol" aria-hidden="true">{info.short}</span>
    <span className={compact ? 'sr-only' : ''}>{info.label}</span>
  </span>
}

export function PlatformGroup({ values, compact = false }: { values: string[]; compact?: boolean }) {
  if (!values.length) return <span className="muted small">None yet</span>
  const visible = compact ? values.slice(0, 2) : values
  return <span className="platform-group">{visible.map(platform => <PlatformChip platform={platform} compact={compact} key={platform} />)}
    {compact && values.length > 2 && <span className="more-platforms" title={values.slice(2).map(key => platforms[key]?.label ?? key).join(', ')}>+{values.length - 2}<span className="sr-only"> more platforms: {values.slice(2).map(key => platforms[key]?.label ?? key).join(', ')}</span></span>}
  </span>
}

export function StatusPill({ person }: { person: Pick<PersonSummary, 'paid' | 'signed_up' | 'response' | 'replied'> }) {
  const status = person.paid === 'yes' ? ['Paid', 'green']
    : person.signed_up === 'yes' ? ['Signed up', 'green']
      : person.response === 'yes' ? ['Said yes', 'coral']
        : person.response === 'no' ? ['Declined', 'neutral']
          : person.response === 'maybe' ? ['Maybe', 'amber']
            : person.replied === 'yes' ? ['Replied', 'purple']
              : person.replied === 'no' ? ['No reply', 'neutral'] : ['Unknown', 'neutral']
  return <span className={`status-pill ${status[1]}`}>{status[0] === 'Paid' && <Icon name="check" size={12} />}{status[0]}</span>
}

export function SponsorStatusPill({ status }: { status: SponsorStatus }) {
  const info = sponsorStatuses.find(item => item.value === status) ?? sponsorStatuses[0]!
  return <span className={`status-pill ${info.color}`}>{info.label}</span>
}

export function EventPicker({ events, value, onChange, all = false, id = 'event-picker' }: {
  events: CrmEvent[]; value: string; onChange: (value: string) => void; all?: boolean; id?: string
}) {
  return <div className="event-picker"><Icon name="calendar" size={17} />
    <label className="sr-only" htmlFor={id}>Filter by event</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {all && <option value="">All events</option>}
      {!all && !events.length && <option value={value}>End of Year Mixer</option>}
      {events.map(event => <option value={event.key} key={event.key}>{event.name}</option>)}
    </select>
  </div>
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="state-card error-state" role="alert"><span className="state-icon"><Icon name="chat" size={26} /></span>
    <h2>A little connection hiccup</h2><p>{message}</p><button className="button secondary" onClick={retry}>Try again</button></div>
}

export function EmptyState({ title = 'No people here yet', children }: { title?: string; children?: ReactNode }) {
  return <div className="state-card"><span className="state-icon"><Icon name="people" size={28} /></span><h2>{title}</h2><p>{children ?? 'Your outreach will appear here once it has been added.'}</p></div>
}

export function Skeleton({ kind = 'overview' }: { kind?: 'overview' | 'people' | 'detail' }) {
  return <div className={`skeleton-layout ${kind}`} role="status" aria-label="Loading CRM data">
    <span className="sr-only">Loading…</span>
    <div className="skeleton skeleton-heading" />
    {kind === 'overview' && <div className="metric-grid">{[1, 2, 3, 4].map(item => <div className="skeleton skeleton-metric" key={item} />)}</div>}
    {[1, 2, 3, 4].map(item => <div className="skeleton skeleton-row" key={item} />)}
  </div>
}
