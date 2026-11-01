import type { CrmApi, SponsorFilters } from '../api/types.ts'
import { EmptyState, ErrorState, Icon, Skeleton, SponsorStatusPill } from '../components/ui.tsx'
import { useDebounced, useResource } from '../hooks.ts'
import { sponsorEvent, sponsorLevels, sponsorStatuses } from '../sponsors.ts'
import { money } from '../utils.ts'

export function SponsorsPage({ api, filters, onFiltersChange, revision }: {
  api: CrmApi; filters: SponsorFilters; onFiltersChange: (filters: SponsorFilters) => void; revision: number
}) {
  const query = useDebounced(filters.q ?? '')
  const currentFilters = { ...filters, q: query, event: sponsorEvent }
  const summary = useResource(`sponsor-summary:${revision}`, () => api.sponsorSummary(sponsorEvent))
  const resource = useResource(`sponsors:${JSON.stringify(currentFilters)}:${revision}`, () => api.sponsors(currentFilters))
  const searching = query !== (filters.q ?? '')
  const update = (patch: SponsorFilters) => onFiltersChange({ ...filters, ...patch })
  const data = summary.data

  return <>
    <div className="page-heading sponsor-heading"><div><p className="eyebrow">GOOD PARTNERS. A GREAT EVENING.</p><h1>Your sponsors<span className="coral-text">.</span></h1><p className="page-subtitle">End of Year Mixer · Sat, Dec 5, 2026</p></div><a className="button primary" href="#/sponsors/new"><Icon name="plus" size={18} />Add sponsor</a></div>
    {summary.loading && <Skeleton kind="people" />}
    {summary.error && <ErrorState message={summary.error} retry={summary.retry} />}
    {data && <section className="sponsor-summary" aria-label="Sponsor summary for End of Year Mixer">
      <div className="sponsor-total-cards">
        <article className="card sponsor-money"><span className="eyebrow">COMMITTED · CONFIRMED</span><strong>{money(data.committed_cents)}</strong><span>Pipeline <b>{money(data.pipeline_cents)}</b><span className="sr-only"> from interested sponsors</span></span></article>
        <article className={`card platinum-card ${data.platinum.taken ? 'taken' : 'open'}`}><span className="eyebrow"><Icon name="sparkle" size={15} />PLATINUM · ONE SPOT</span><strong>{data.platinum.taken ? 'Taken' : 'Open'}</strong><span>{data.platinum.taken ? `By ${data.platinum.holder?.business_name ?? 'another sponsor'}` : '$1,000 · Make it theirs.'}</span></article>
      </div>
      <div className="sponsor-counts">{sponsorStatuses.map(status => <div key={status.value} className={`sponsor-count ${status.color}`}><strong>{data.by_status[status.value]}</strong><span>{status.label}</span></div>)}</div>
      {data.follow_ups_due > 0 && <p className="sponsor-followups"><Icon name="calendar" size={16} /><strong>{data.follow_ups_due} follow-up{data.follow_ups_due === 1 ? '' : 's'} due</strong><span>Keep the conversation going.</span></p>}
    </section>}
    <a className="text-button sponsor-packages" href="https://moran-tech.github.io/faithsocialclub/end-of-year-mixer-sponsors/" target="_blank" rel="noopener noreferrer">View sponsor packages ↗<span className="sr-only"> (opens in a new tab)</span></a>
    <section className="people-filters sponsor-filters" aria-label="Find sponsors">
      <div className="search-field"><Icon name="search" /><label className="sr-only" htmlFor="sponsor-search">Search business, contact, category, or area</label><input id="sponsor-search" type="search" autoComplete="off" placeholder="Find a business, contact, or area…" value={filters.q ?? ''} onChange={event => update({ q: event.target.value })} /></div>
      <div className="status-filters sponsor-status-filters" role="group" aria-label="Filter sponsors by status"><button className={!filters.status ? 'active' : ''} aria-pressed={!filters.status} onClick={() => update({ status: '' })}>All</button>{sponsorStatuses.map(status => <button key={status.value} className={filters.status === status.value ? 'active' : ''} aria-pressed={filters.status === status.value} onClick={() => update({ status: status.value })}>{status.label}</button>)}</div>
      <div className="results-heading" aria-live="polite"><span>{resource.data && !searching ? <><strong>{resource.data.length}</strong> {resource.data.length === 1 ? 'sponsor' : 'sponsors'}</> : 'Finding your sponsors…'}</span>{(filters.q || filters.status) && <button className="text-button" onClick={() => onFiltersChange({ q: '', status: '' })}>Clear filters</button>}</div>
    </section>
    {(resource.loading || searching) && <Skeleton kind="people" />}
    {resource.error && !searching && <ErrorState message={resource.error} retry={resource.retry} />}
    {resource.data && !searching && (resource.data.length ? <div className="card people-card sponsor-list-card">
      <div className="sponsor-row people-table-heading" aria-hidden="true"><span>Business</span><span>Category · Area</span><span>Status</span><span>Level / $</span></div>
      <ul className="people-list">{resource.data.map(sponsor => <li key={sponsor.id}><a className="sponsor-row" href={`#/sponsors/${encodeURIComponent(sponsor.id)}`}>
        <span className="person-name"><strong>{sponsor.business_name}</strong>{sponsor.contact_name && <small>{sponsor.contact_name}</small>}</span>
        <span className="sponsor-location"><span className="sr-only">Category and area: </span>{[sponsor.category, sponsor.area].filter(Boolean).join(' · ') || 'Not recorded'}</span>
        <span><span className="sr-only">Status: </span><SponsorStatusPill status={sponsor.status} /></span>
        <span className="sponsor-level"><span className="sr-only">Level and amount: </span><strong>{sponsorLevels.find(level => level.value === sponsor.level)?.label ?? 'None'}</strong><small>{sponsor.amount_cents === null ? 'Not set' : money(sponsor.amount_cents)}</small></span>
      </a></li>)}</ul>
    </div> : <EmptyState title={filters.q || filters.status ? 'No sponsors match, just yet' : 'Your next great partner starts here'}>{filters.q || filters.status ? 'Try another search or clear a filter.' : 'Use Add sponsor to start your first conversation.'}</EmptyState>)}
  </>
}
