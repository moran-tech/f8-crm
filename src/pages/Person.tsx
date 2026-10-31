import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Answer, CrmApi, EventStatus, PersonDetail, PersonPatch, Response } from '../api/types.ts'
import { useResource } from '../hooks.ts'
import { EmptyState, ErrorState, Icon, PlatformChip, PlatformGroup, Skeleton, StatusPill } from '../components/ui.tsx'
import { eventDate, money, safeContactLink } from '../utils.ts'

type DraftEvent = EventStatus & { amount: string }
const draftEvents = (detail: PersonDetail): DraftEvent[] => detail.events.map(event => ({ ...event, amount: (event.amount_cents / 100).toFixed(2) }))

function AnswerSelect({ label, value, onChange }: { label: string; value: Answer; onChange: (value: Answer) => void }) {
  return <label className="field-label">{label}<select value={value} onChange={event => onChange(event.target.value as Answer)}>
    <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option><option value="n/a">Not applicable</option>
  </select></label>
}

function PersonEditor({ initial, api, onSaved }: { initial: PersonDetail; api: CrmApi; onSaved: () => void }) {
  const [detail, setDetail] = useState(initial)
  const [notes, setNotes] = useState(initial.person.notes)
  const [events, setEvents] = useState(() => draftEvents(initial))
  const [baseline, setBaseline] = useState(() => JSON.stringify({ notes: initial.person.notes, events: draftEvents(initial) }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify({ notes, events }) !== baseline
  const contactLink = safeContactLink(detail.person.contact)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function updateEvent(index: number, patch: Partial<DraftEvent>) {
    setSaved(false)
    setEvents(current => current.map((event, i) => i === index ? { ...event, ...patch } : event))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !dirty) return
    const invalidAmount = events.some(event => !/^\d+(?:\.\d{1,2})?$/.test(event.amount) || !Number.isSafeInteger(Math.round(Number(event.amount) * 100)))
    if (invalidAmount) { setError('Enter a valid, non-negative amount with at most two decimal places.'); return }
    const updates = events.map(({ amount, ...event }) => ({ ...event, amount_cents: Math.round(Number(amount) * 100) }))
    const patch: PersonPatch = {
      notes,
      events: updates.map(({ event_name: _name, ...event }) => event),
    }
    const before = detail
    setDetail({ ...detail, person: { ...detail.person, notes }, events: updates })
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const updated = await api.updatePerson(detail.person.id, patch)
      setDetail(updated)
      setNotes(updated.person.notes)
      setEvents(draftEvents(updated))
      setBaseline(JSON.stringify({ notes: updated.person.notes, events: draftEvents(updated) }))
      setSaved(true)
      onSaved()
    } catch (cause) {
      setDetail(before)
      setError(cause instanceof Error ? cause.message : 'Could not save. Your changes are still here. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <section className="card person-profile" aria-labelledby="person-name">
      <div className="profile-top"><span className="avatar large-avatar" aria-hidden="true">{detail.person.name.split(' ').filter(part => part !== 'Demo').slice(0, 2).map(part => part[0]).join('')}</span><PlatformGroup values={detail.person.platforms} /></div>
      <p className="eyebrow">YOUR CONNECTION</p><h1 id="person-name">{detail.person.name}</h1>
      <dl className="profile-facts">
        <div><dt>Contact</dt><dd>{contactLink ? <a href={contactLink} target={contactLink.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{detail.person.contact}<span className="sr-only">{contactLink.startsWith('http') ? ' (opens in a new tab)' : ''}</span></a> : detail.person.contact || 'Not recorded'}</dd></div>
        <div><dt>Organization</dt><dd>{detail.person.organization || 'Not recorded'}</dd></div>
        <div><dt>Type / kind</dt><dd>{[detail.person.type, detail.person.kind].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
      </dl>
    </section>

    <form onSubmit={save} className="person-form">
      <fieldset disabled={saving}>
        <legend className="sr-only">Update connection notes and event status</legend>
        <section className="card notes-card"><label className="field-label" htmlFor="person-notes"><span className="section-label">A little context</span><span className="muted small">Notes about this person, across all events.</span></label>
          <textarea id="person-notes" rows={3} value={notes} onChange={event => { setNotes(event.target.value); setSaved(false) }} placeholder="How you met, what to remember…" />
        </section>
        <div className="section-heading event-status-heading"><div><p className="eyebrow">KEEP THE CONVERSATION MOVING</p><h2>Event status</h2></div></div>
        {!events.length && <EmptyState title="No events linked yet">This person doesn’t have an event status to edit.</EmptyState>}
        {events.map((event, index) => <section className="card event-status-card" key={event.event_key} aria-labelledby={`status-${index}`}>
          <div className="section-heading"><h3 id={`status-${index}`}>{event.event_name || event.event_key}</h3><StatusPill person={detail.events.find(item => item.event_key === event.event_key) ?? event} /></div>
          <div className="status-edit-grid">
            <AnswerSelect label="Replied" value={event.replied} onChange={replied => updateEvent(index, { replied })} />
            <label className="field-label">Said yes<select value={event.response} onChange={change => updateEvent(index, { response: change.target.value as Response })}>
              <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option>
            </select></label>
            <AnswerSelect label="Paid" value={event.paid} onChange={paid => updateEvent(index, { paid })} />
            <label className="field-label">Amount (CAD)<span className="amount-input"><span aria-hidden="true">$</span><input type="number" inputMode="decimal" min="0" step="0.01" required value={event.amount} onChange={change => updateEvent(index, { amount: change.target.value })} /></span></label>
            <AnswerSelect label="Signed up" value={event.signed_up} onChange={signed_up => updateEvent(index, { signed_up })} />
          </div>
          <label className="field-label event-notes">Event notes<textarea rows={2} value={event.notes} onChange={change => updateEvent(index, { notes: change.target.value })} placeholder="A follow-up, a reminder, a little detail…" /></label>
          {event.paid === 'yes' && <p className="small muted">{money(Math.round((Number(event.amount) || 0) * 100))} recorded for this event.</p>}
        </section>)}
      </fieldset>
      <div className="save-bar">
        <div aria-live="polite"><strong>{saving ? 'Saving your changes…' : saved ? 'All changes saved' : dirty ? 'You have unsaved changes' : 'Everything is up to date'}</strong><span>{saving ? 'Updating this connection.' : 'Little details make good follow-ups.'}</span></div>
        <button className="button primary" type="submit" disabled={saving || !dirty}>{saving ? 'Saving…' : <><Icon name="check" size={17} />Save changes</>}</button>
      </div>
      {error && <div className="inline-error save-error" role="alert">{error} Your edits have been kept. Use Save changes to retry.</div>}
    </form>

    <section className="touch-history" aria-labelledby="history-title">
      <div className="section-heading"><div><p className="eyebrow">EVERY HELLO HAS A HISTORY</p><h2 id="history-title">The conversation so far</h2></div><span className="count-badge">{detail.touches.length}</span></div>
      {detail.touches.length ? <ol className="timeline">{detail.touches.map(touch => <li key={touch.id}>
        <span className="timeline-dot" aria-hidden="true"><Icon name={touch.replied === 'yes' ? 'chat' : 'mail'} size={15} /></span>
        <article className="card touch-card"><div className="touch-top"><PlatformChip platform={touch.platform} /><span className="small muted">{eventDate(touch.date_text, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
          {touch.event_label && <p className="touch-event">{touch.event_label}</p>}
          {touch.message_summary && <div className="touch-message"><span className="eyebrow">MESSAGE</span><p>{touch.message_summary}</p></div>}
          {touch.reply_summary && <div className="touch-reply"><span className="eyebrow">THEIR REPLY</span><p>{touch.reply_summary}</p></div>}
          {touch.notes && <p className="touch-notes">{touch.notes}</p>}
          <dl className="touch-facts"><div><dt>Status</dt><dd>{touch.outreach_status || 'Not recorded'}</dd></div><div><dt>Contacted</dt><dd>{touch.contacted === 'unknown' ? 'Unknown' : touch.contacted === 'n/a' ? 'N/A' : touch.contacted === 'yes' ? 'Yes' : 'No'}</dd></div><div><dt>Replied</dt><dd>{touch.replied === 'yes' ? 'Yes' : touch.replied === 'no' ? 'No' : touch.replied === 'n/a' ? 'N/A' : 'Unknown'}</dd></div><div><dt>Source</dt><dd>{touch.source || 'Not recorded'}</dd></div></dl>
        </article>
      </li>)}</ol> : <EmptyState title="No messages recorded">When outreach is added, the full history will live here.</EmptyState>}
    </section>
  </>
}

export function PersonPage({ api, id, onBack, onSaved }: { api: CrmApi; id: string; onBack: () => void; onSaved: () => void }) {
  const resource = useResource(`person:${id}`, () => api.person(id))
  return <div className="person-page"><div className="detail-navigation"><button className="text-button back-button" onClick={onBack}><Icon name="back" size={19} />Back</button><span className="small muted">Connection details</span></div>
    {resource.loading && <Skeleton kind="detail" />}
    {resource.error && <ErrorState message={resource.error} retry={resource.retry} />}
    {resource.data && <PersonEditor key={resource.data.person.id} initial={resource.data} api={api} onSaved={onSaved} />}
  </div>
}
