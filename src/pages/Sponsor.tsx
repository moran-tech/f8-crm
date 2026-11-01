import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CrmApi, Sponsor, SponsorLevel, SponsorPatch, SponsorStatus } from '../api/types.ts'
import { ApiError } from '../api/client.ts'
import { EmptyState, ErrorState, Icon, Skeleton, SponsorStatusPill } from '../components/ui.tsx'
import { useResource } from '../hooks.ts'
import { plainDate, sponsorAmount, sponsorEvent, sponsorLevels, sponsorStatuses } from '../sponsors.ts'
import { eventDate, money, safeEmailLink } from '../utils.ts'

function draftSponsor(sponsor?: Sponsor) {
  return {
    business_name: sponsor?.business_name ?? '', contact_name: sponsor?.contact_name ?? '',
    email: sponsor?.email ?? '', category: sponsor?.category ?? '', area: sponsor?.area ?? '',
    date_pitched: sponsor?.date_pitched ?? '', status: sponsor?.status ?? 'not_contacted' as SponsorStatus,
    level: sponsor?.level ?? '' as SponsorLevel | '', amount: sponsor?.amount_cents == null ? '' : (sponsor.amount_cents / 100).toFixed(2),
    follow_up_date: sponsor?.follow_up_date ?? '', notes: sponsor?.notes ?? '', source: sponsor?.source ?? '',
  }
}

function SponsorEditor({ initial, api, onSaved, setNavigationGuard }: {
  initial?: Sponsor; api: CrmApi; onSaved: () => void; setNavigationGuard: (guard: () => boolean) => void
}) {
  const [detail, setDetail] = useState(initial)
  const [draft, setDraft] = useState(() => draftSponsor(initial))
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftSponsor(initial)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const summary = useResource(`sponsor-availability:${detail?.updated_at ?? 'new'}`, () => api.sponsorSummary(detail?.event_key ?? sponsorEvent))
  const holder = summary.data?.platinum.holder
  const ownsPlatinum = !!detail && !!holder && holder.id === detail.id
  const platinumTaken = !!summary.data?.platinum.taken && !ownsPlatinum
  const dirty = JSON.stringify(draft) !== baseline
  const emailLink = safeEmailLink(draft.email)

  useEffect(() => {
    setNavigationGuard(() => !saving && (!dirty || window.confirm('You have unsaved sponsor changes. Discard them and leave?')))
    return () => setNavigationGuard(() => true)
  }, [dirty, saving, setNavigationGuard])
  useEffect(() => {
    if (!dirty && !saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])
  function update(patch: Partial<typeof draft>) { setDraft(current => ({ ...current, ...patch })); setSaved(false) }
  function changeLevel(level: SponsorLevel | '') {
    const preset = sponsorLevels.find(item => item.value === level)
    update({ level, ...(preset && !draft.amount.trim() ? { amount: (preset.cents / 100).toFixed(2) } : {}) })
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || (detail && !dirty)) return
    setError('')
    if (!draft.business_name.trim()) { setError('Enter a business name.'); return }
    const cents = sponsorAmount(draft.amount)
    if (cents === undefined) { setError('Enter a valid, non-negative amount with at most two decimal places.'); return }
    if ((draft.date_pitched && !plainDate(draft.date_pitched)) || (draft.follow_up_date && !plainDate(draft.follow_up_date))) {
      setError('Enter a valid date.'); return
    }
    const input = {
      business_name: draft.business_name.trim(),
      contact_name: draft.contact_name.trim() || null, email: draft.email.trim() || null,
      category: draft.category.trim() || null, area: draft.area.trim() || null,
      date_pitched: draft.date_pitched || null, status: draft.status,
      level: draft.level || null, amount_cents: cents, follow_up_date: draft.follow_up_date || null,
      notes: draft.notes.trim() || null, source: draft.source.trim() || null,
    }
    setSaving(true)
    setSaved(false)
    try {
      // PATCH only changed fields so unrelated concurrent edits are not overwritten.
      const before = draftSponsor(detail)
      const patch: SponsorPatch = Object.fromEntries(Object.entries(input).filter(([key]) =>
        key === 'amount_cents' ? draft.amount !== before.amount : draft[key as keyof typeof draft] !== before[key as keyof typeof draft]))
      const updated = detail ? await api.updateSponsor(detail.id, patch)
        : await api.createSponsor({ ...input, event_key: sponsorEvent })
      setDetail(updated)
      setDraft(draftSponsor(updated))
      setBaseline(JSON.stringify(draftSponsor(updated)))
      setSaved(true)
      summary.retry()
      onSaved()
      if (!detail) {
        setNavigationGuard(() => true)
        // Replace /new so browser Back never returns to a submitted form.
        window.location.replace(`${window.location.pathname}${window.location.search}#/sponsors/${encodeURIComponent(updated.id)}`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this sponsor. Try again.')
      if (cause instanceof ApiError && cause.code === 'platinum_taken') summary.retry()
    } finally {
      setSaving(false)
    }
  }
  return <>
    <section className="card person-profile sponsor-profile"><div className="section-heading"><p className="eyebrow">{detail ? 'YOUR NEXT GREAT PARTNER' : 'MAKE ROOM FOR A GOOD PARTNER'}</p><SponsorStatusPill status={detail?.status ?? 'not_contacted'} /></div><h1>{detail?.business_name ?? 'Add sponsor'}</h1><p className="small muted">End of Year Mixer · Sat, Dec 5, 2026</p></section>
    <form className="person-form sponsor-form" onSubmit={save}>
      <fieldset disabled={saving}><legend className="sr-only">Sponsor details</legend>
        <section className="card event-status-card"><div className="section-heading"><h2>The business</h2><Icon name="people" size={19} /></div>
          <div className="sponsor-edit-grid">
            <label className="field-label full-field">Business name <span className="sr-only">(required)</span><input required value={draft.business_name} onChange={event => update({ business_name: event.target.value })} autoComplete="organization" /></label>
            <label className="field-label">Contact name<input value={draft.contact_name} onChange={event => update({ contact_name: event.target.value })} autoComplete="name" /></label>
            <div className="sponsor-email"><label className="field-label">Email<input type="email" inputMode="email" value={draft.email} onChange={event => update({ email: event.target.value })} autoComplete="email" /></label>{emailLink && <a className="text-button" href={emailLink}><Icon name="mail" size={15} />Email contact</a>}</div>
            <label className="field-label">Category<input value={draft.category} onChange={event => update({ category: event.target.value })} placeholder="e.g. Fitness" /></label>
            <label className="field-label">Area<input value={draft.area} onChange={event => update({ area: event.target.value })} placeholder="Neighbourhood or city" /></label>
          </div>
        </section>
        <section className="card event-status-card"><div className="section-heading"><h2>The conversation</h2><Icon name="chat" size={19} /></div>
          <div className="sponsor-edit-grid"><label className="field-label">Status<select value={draft.status} onChange={event => update({ status: event.target.value as SponsorStatus })}>{sponsorStatuses.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}</select></label>
            <label className="field-label">Date pitched<input type="date" value={draft.date_pitched} onChange={event => update({ date_pitched: event.target.value })} /></label>
            <label className="field-label full-field">Follow-up date<input type="date" value={draft.follow_up_date} onChange={event => update({ follow_up_date: event.target.value })} /></label>
          </div>
        </section>
        <section className="card event-status-card"><div className="section-heading"><h2>The package</h2><Icon name="sparkle" size={19} /></div>
          {summary.loading && <p className="small muted" role="status">Checking Platinum availability…</p>}
          {summary.error && <div className="sponsor-availability-error" role="alert"><p className="small">Could not check Platinum availability. The CRM will check again when you save.</p><button className="text-button" type="button" onClick={summary.retry}>Retry availability</button></div>}
          {summary.data && <p id="platinum-availability" className={`sponsor-availability ${platinumTaken ? 'unavailable' : ''}`}>{summary.data.platinum.taken ? ownsPlatinum ? 'Platinum is reserved for this sponsor.' : `Platinum is already taken by ${holder?.business_name ?? 'another sponsor'}.` : 'Platinum is open. Just one $1,000 spot.'}</p>}
          <div className="sponsor-edit-grid"><label className="field-label">Level<select value={draft.level} aria-describedby={summary.data ? 'platinum-availability' : undefined} onChange={event => changeLevel(event.target.value as SponsorLevel | '')}><option value="">None</option>{sponsorLevels.map(level => <option key={level.value} value={level.value} disabled={level.value === 'platinum' && platinumTaken}>{level.label} {money(level.cents)}{level.value === 'platinum' && platinumTaken ? ' · taken' : ''}</option>)}</select></label>
            <label className="field-label">Amount (CAD)<span className="amount-input"><span aria-hidden="true">$</span><input type="text" inputMode="decimal" value={draft.amount} onChange={event => update({ amount: event.target.value })} placeholder="Not set" /></span></label>
          </div>
          <p className="small muted sponsor-field-help">Choosing a level fills the amount only when it’s blank.</p>
        </section>
        <section className="card event-status-card"><label className="field-label">Notes<textarea rows={4} value={draft.notes} onChange={event => update({ notes: event.target.value })} placeholder="The pitch, the next step, a little context…" /></label><label className="field-label sponsor-source">Source<input value={draft.source} onChange={event => update({ source: event.target.value })} placeholder="How you found this business" /></label></section>
      </fieldset>
      {error && <div className="inline-error save-error" role="alert">{error} Your edits have been kept.</div>}
      <div className="save-bar sponsor-save-bar"><div aria-live="polite"><strong>{saving ? 'Saving your sponsor…' : saved ? 'All changes saved' : dirty ? 'You have unsaved changes' : detail ? 'Everything is up to date' : 'Start with a business name'}</strong><span>Good partnerships start with a hello.</span></div><button className="button primary" type="submit" disabled={saving || (!!detail && !dirty)}>{saving ? 'Saving…' : <><Icon name="check" size={17} />{detail ? 'Save changes' : 'Add sponsor'}</>}</button></div>
    </form>
    {detail && <dl className="sponsor-record-meta"><div><dt>Source</dt><dd>{detail.source || 'Not recorded'}</dd></div><div><dt>Created</dt><dd>{detail.created_at ? eventDate(detail.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded'}</dd></div><div><dt>Updated</dt><dd>{detail.updated_at ? eventDate(detail.updated_at, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded'}</dd></div></dl>}
  </>
}

export function SponsorPage({ api, id, onBack, onSaved, setNavigationGuard }: {
  api: CrmApi; id: string; onBack: () => void; onSaved: () => void; setNavigationGuard: (guard: () => boolean) => void
}) {
  const isNew = id === 'new'
  const resource = useResource(`sponsor:${id}`, () => isNew ? Promise.resolve(null) : api.sponsor(id))
  return <div className="person-page"><div className="detail-navigation"><button className="text-button back-button" onClick={onBack}><Icon name="back" size={19} />Back</button><span className="small muted">{isNew ? 'New sponsor' : 'Sponsor details'}</span></div>
    {resource.loading && <Skeleton kind="detail" />}
    {resource.error && <ErrorState message={resource.error} retry={resource.retry} />}
    {!resource.loading && !resource.error && (isNew || resource.data ? <SponsorEditor key={id} initial={resource.data ?? undefined} api={api} onSaved={onSaved} setNavigationGuard={setNavigationGuard} /> : <EmptyState title="Sponsor not found">Go back to your sponsors and try again.</EmptyState>)}
  </div>
}
