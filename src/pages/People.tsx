import type { CrmApi, CrmEvent, PeopleFilters, PeopleStatus } from '../api/types.ts'
import { useDebounced, useResource } from '../hooks.ts'
import { EmptyState, ErrorState, EventPicker, Icon, PlatformGroup, Skeleton, StatusPill } from '../components/ui.tsx'
import { platforms } from '../platforms.ts'

const statuses: { label: string; value: PeopleStatus }[] = [
  { label: 'All', value: '' }, { label: 'Replied', value: 'replied' },
  { label: 'Said yes', value: 'yes' }, { label: 'Paid', value: 'paid' }, { label: 'No reply', value: 'no_reply' },
]

export function PeoplePage({ api, events, filters, onFiltersChange, revision, onOpenPerson }: {
  api: CrmApi; events: CrmEvent[]; filters: PeopleFilters; onFiltersChange: (filters: PeopleFilters) => void;
  revision: number; onOpenPerson: () => void
}) {
  const query = useDebounced(filters.q ?? '')
  const currentFilters = { ...filters, q: query }
  const resource = useResource(`people:${JSON.stringify(currentFilters)}:${revision}`, () => api.people(currentFilters))
  const update = (patch: PeopleFilters) => onFiltersChange({ ...filters, ...patch })
  const searching = query !== (filters.q ?? '')
  const hasFilters = filters.q || filters.status || filters.platform || filters.kind || filters.event

  return <>
    <div className="page-heading"><div><p className="eyebrow">LESS SPREADSHEET. MORE CONNECTION.</p><h1>Your people<span className="coral-text">.</span></h1><p className="page-subtitle">Every hello, follow-up, and “count me in.”</p></div></div>
    <section className="people-filters" aria-label="Find people">
      <div className="search-field"><Icon name="search" /><label className="sr-only" htmlFor="people-search">Search name, organization, or contact</label>
        <input id="people-search" type="search" placeholder="Find a name, company, or contact…" value={filters.q ?? ''} onChange={event => update({ q: event.target.value })} autoComplete="off" />
      </div>
      <div className="filter-second-row"><EventPicker events={events} value={filters.event ?? ''} onChange={event => update({ event })} all id="people-event" />
        <details className="more-filters"><summary>More filters{filters.platform || filters.kind ? ' •' : ''}</summary>
          <div className="extra-filter-fields"><label>Platform<select value={filters.platform ?? ''} onChange={event => update({ platform: event.target.value })}><option value="">All platforms</option>{Object.entries(platforms).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}</select></label>
            <label>Kind<input value={filters.kind ?? ''} onChange={event => update({ kind: event.target.value })} placeholder="e.g. partner" /></label></div>
        </details>
      </div>
      <div className="status-filters" role="group" aria-label="Filter by status">{statuses.map(status => <button key={status.value} className={filters.status === status.value || (!filters.status && !status.value) ? 'active' : ''} aria-pressed={(filters.status ?? '') === status.value} onClick={() => update({ status: status.value })}>{status.label}</button>)}</div>
    </section>
    <div className="results-heading" aria-live="polite"><span>{resource.data && !searching ? <><strong>{resource.data.length}</strong> {resource.data.length === 1 ? 'person' : 'people'}</> : 'Finding your people…'}</span>
      {hasFilters && <button className="text-button" onClick={() => onFiltersChange({ q: '', event: '', status: '', platform: '', kind: '' })}>Clear filters</button>}
    </div>
    {(resource.loading || searching) && <Skeleton kind="people" />}
    {resource.error && !searching && <ErrorState message={resource.error} retry={resource.retry} />}
    {resource.data && !searching && (resource.data.length ? <div className="card people-card">
      <div className="people-row people-table-heading" aria-hidden="true"><span>Name</span><span>Platforms</span><span>Replied</span><span>Paid / RSVP</span></div>
      <ul className="people-list">{resource.data.map(person => <li key={person.id}>
        <a className="people-row" href={`#/people/${encodeURIComponent(person.id)}`} onClick={onOpenPerson}>
          <span className="person-name"><strong>{person.name}</strong>{person.organization && <small>{person.organization}</small>}</span>
          <span><span className="sr-only">Platforms: </span><PlatformGroup values={person.platforms} compact /></span>
          <span className={`reply-indicator ${person.replied === 'yes' ? 'has-replied' : ''}`}><span className="sr-only">Replied: </span>{person.replied === 'yes' ? <><Icon name="check" size={14} />Yes</> : person.replied === 'no' ? 'No' : person.replied === 'n/a' ? 'N/A' : <><span aria-hidden="true">—</span><span className="sr-only">Unknown</span></>}</span>
          <span><span className="sr-only">Paid / RSVP: </span>{person.paid === 'yes' || person.signed_up === 'yes' || person.response !== 'unknown' ? <StatusPill person={person} /> : <span className="muted small">{person.paid === 'no' ? 'Unpaid' : 'Unknown'}</span>}</span>
        </a></li>)}</ul>
    </div> : <EmptyState title="No matches, just yet">Try a different name or clear a filter to widen your circle.</EmptyState>)}
  </>
}
