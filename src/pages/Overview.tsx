import type { CrmApi, CrmEvent } from '../api/types.ts'
import { useResource } from '../hooks.ts'
import {
  EmptyState, ErrorState, EventPicker, Icon,
  PlatformChip, PlatformGroup, Skeleton, StatusPill,
} from '../components/ui.tsx'
import { barWidth, eventDate, money, percent } from '../utils.ts'

export function OverviewPage({ api, events, selectedEvent, onEventChange, revision, onOpenPerson }: {
  api: CrmApi; events: CrmEvent[]; selectedEvent: string; onEventChange: (key: string) => void;
  revision: number; onOpenPerson: () => void
}) {
  const resource = useResource(`overview:${selectedEvent}:${revision}`, () => api.overview(selectedEvent))
  const overview = resource.data
  const event = overview?.event.key ? overview.event : events.find(event => event.key === selectedEvent)
  const funnel = overview?.funnel
  const platformRows = [...(overview?.platforms ?? [])].sort((a, b) => b.invited - a.invited)
  const bestRate = Math.max(0, ...platformRows.map(row => row.invited ? row.replied / row.invited : 0))
  const extraPaid = overview ? Math.max(0, overview.paid_total - overview.funnel.paid) : 0
  const steps = funnel ? [
    { label: 'Invited', value: funnel.invited, previous: funnel.invited, color: 'plum' },
    { label: 'Replied', value: funnel.replied, previous: funnel.invited, color: 'mauve' },
    { label: 'Said yes', value: funnel.yes, previous: funnel.replied, color: 'coral' },
    { label: 'Paid', value: funnel.paid, previous: funnel.yes, color: 'green' },
  ] : []

  return <>
    <div className="page-heading"><div><p className="eyebrow">A little outreach. A lot of possibility.</p><h1>Your room, coming together<span className="coral-text">.</span></h1></div>
      <EventPicker events={events} value={selectedEvent} onChange={onEventChange} />
    </div>
    {resource.loading && <Skeleton />}
    {resource.error && <ErrorState message={resource.error} retry={resource.retry} />}
    {overview && funnel && <>
      <section className="event-hero" aria-labelledby="event-title">
        <div className="event-hero-copy"><span className="hero-label"><span className="live-dot" /> THE NEXT GOOD CONNECTION</span>
          <h2 id="event-title">{event?.name || 'End of Year Mixer'}</h2>
          <div className="event-meta"><span><Icon name="calendar" size={16} />{eventDate(event?.date ?? '')}</span><span><Icon name="pin" size={16} />{event?.venue || 'Venue to be confirmed'}</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="art-star">✳</span><span className="art-caption">GOOD PEOPLE<br />GOOD ENERGY</span></div>
      </section>

      <section className="metric-grid" aria-label="Outreach numbers">
        {[
          { label: 'Invited', value: funnel.invited, icon: 'people', style: 'invited', foot: 'people reached out to' },
          { label: 'Replied', value: funnel.replied, icon: 'chat', style: 'replied', foot: `${percent(funnel.replied, funnel.invited)}% of invited` },
          { label: 'Said yes', value: funnel.yes, icon: 'check', style: 'yes', foot: `${percent(funnel.yes, funnel.invited)}% of invited` },
          { label: 'Paid', value: funnel.paid, icon: 'ticket', style: 'paid', foot: `${percent(funnel.paid, funnel.invited)}% of invited` },
        ].map(metric => <article className={`metric-card ${metric.style}`} key={metric.label}>
          <div className="metric-label">{metric.label}<span className="metric-icon"><Icon name={metric.icon} size={17} /></span></div>
          <strong className="metric-value">{metric.value}</strong>
          <span className="metric-foot">{metric.foot}</span>
          {metric.style === 'paid' && <span className="metric-revenue">{money(overview.revenue_cents)} total revenue</span>}
          {metric.style === 'invited' && <span className="metric-detail">{funnel.invited ? '100' : '0'}% of invited</span>}
        </article>)}
      </section>

      <div className="overview-columns">
        <section className="card funnel-card" aria-labelledby="funnel-title">
          <div className="section-heading"><div><p className="eyebrow">FROM HELLO TO SEE YOU THERE</p><h2 id="funnel-title">The outreach funnel</h2></div><span className="subtle-icon"><Icon name="sparkle" /></span></div>
          <div className="funnel">
            {steps.map((step, index) => <div className={`funnel-step ${step.color}`} key={step.label}>
              <div className="funnel-step-label"><span>{step.label}</span><span><strong>{step.value}</strong><small>{percent(step.value, funnel.invited)}%</small></span></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${barWidth(step.value, funnel.invited)}%` }} /></div>
              <p className="conversion">{index === 0 ? 'Your starting circle' : `${percent(step.value, step.previous)}% of ${steps[index - 1]!.label.toLowerCase()}`}</p>
            </div>)}
          </div>
          <div className="registration-note"><Icon name="ticket" size={18} /><span><strong>{overview.signed_up_total} signed up</strong> · {overview.paid_total} paid in total<span className="small muted">All registrations, including people outside outreach.</span></span></div>
          {extraPaid > 0 && <p className="outside-note">+{extraPaid} paid without outreach. <span>Total revenue includes these tickets.</span></p>}
        </section>

        <section className="card platforms-card" aria-labelledby="platforms-title">
          <div className="section-heading"><div><p className="eyebrow">FIND YOUR BEST HELLO</p><h2 id="platforms-title">Which platforms are working</h2></div></div>
          {!platformRows.length ? <EmptyState title="No platform activity yet">Platform results will appear when outreach is recorded.</EmptyState>
            : <div className="platform-table" role="table" aria-label="Outreach by platform">
              <div className="platform-table-header" role="row"><span role="columnheader">Platform</span><span role="columnheader" title="Invited">Inv.</span><span role="columnheader">Reply</span><span role="columnheader">Yes</span><span role="columnheader">Paid</span></div>
              {platformRows.map(row => {
                const best = row.invited > 0 && bestRate > 0 && row.replied / row.invited === bestRate
                return <div className={`platform-table-row ${best ? 'best-platform' : ''}`} role="rowgroup" key={row.platform}>
                  <div className="platform-stat-line" role="row"><div className="platform-name" role="cell"><PlatformChip platform={row.platform} /></div>
                    <span className="platform-number" role="cell">{row.invited}</span><span className="platform-number" role="cell">{row.replied}</span><span className="platform-number" role="cell">{row.yes}</span><span className="platform-number" role="cell">{row.paid}</span>
                  </div>
                  <div className="platform-rate-row" role="row"><div className="platform-rate" role="cell" aria-colspan={5}><div className="bar-track"><div className="bar-fill" style={{ width: `${barWidth(row.replied, row.invited)}%` }} /></div><span>{percent(row.replied, row.invited)}% reply rate{best && <strong> · Best</strong>}</span></div></div>
                </div>
              })}
            </div>}
          <p className="section-footnote">One person can be on several platforms. Rates show people who replied, not message attribution.</p>
        </section>
      </div>

      <details className="card invited-card">
        <summary><span><span className="eyebrow">THE PEOPLE BEHIND THE NUMBERS</span><span className="invited-title">Who we invited <span className="count-badge">{overview.invited.count}</span></span></span><span className="details-chevron"><Icon name="arrow" size={20} /></span></summary>
        {overview.invited.people.length ? <ul className="invited-list">{overview.invited.people.map(person => <li key={person.id}>
          <a href={`#/people/${encodeURIComponent(person.id)}`} onClick={onOpenPerson}>
            <span className="avatar" aria-hidden="true">{person.name.split(' ').filter(part => part !== 'Demo').slice(0, 2).map(part => part[0]).join('')}</span>
            <span className="invited-person"><strong>{person.name}</strong><PlatformGroup values={person.platforms} /></span><StatusPill person={person} /><Icon name="arrow" size={16} />
          </a></li>)}</ul> : <EmptyState title={overview.invited.count ? 'Names aren’t available yet' : 'Your next connection starts here'}>{overview.invited.count ? 'The API returned a count without a contact list.' : 'People you invite to this event will appear here.'}</EmptyState>}
      </details>
      <p className="page-endnote">A full room starts with a simple hello.</p>
    </>}
  </>
}
