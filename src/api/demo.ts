import type {
  Answer, CrmApi, CrmEvent, EventStatus, PeopleFilters, PersonDetail,
  PersonSummary, PlatformStats, Sponsor, SponsorCreate, SponsorPatch, SponsorSummary,
} from './types.ts'
import { ApiError } from './client.ts'
import { plainDate, sponsorEffectiveAmount, sponsorEvent, sponsorLevels, sponsorStatuses } from '../sponsors.ts'

const events: CrmEvent[] = [
  { key: 'eoy-mixer', name: 'End of Year Mixer', date: '2026-12-05', venue: 'Studio Nazrana' },
  { key: 'coffee-social', name: 'Saturday Coffee Social', date: '2026-11-14', venue: 'Demo Café, Surrey' },
]
const names = [
  'Amber Acorn', 'Basil Balloon', 'Clover Cloud', 'Daisy Daydream', 'Ember Evergreen',
  'Fern Firefly', 'Ginger Gumdrop', 'Hazel Honeybee', 'Indigo Icicle', 'Juniper Jellybean',
  'Kiwi Kite', 'Lemon Lantern', 'Maple Moonbeam', 'Nova Noodle', 'Olive Origami',
  'Peach Pebble', 'Quinn Quasar', 'Robin Rainbow', 'Sage Stardust', 'Tulip Teacup',
  'Umber Umbrella', 'Violet Velvet', 'Willow Waffle', 'Wren Wonder', 'Zinnia Zigzag',
]
const platformKeys = [
  'linkedin_connection', 'linkedin_connection', 'linkedin_dm', 'linkedin_connection', 'whatsapp',
  'linkedin_connection', 'linkedin_dm', 'meetup', 'linkedin_dm', 'email',
  'linkedin_connection', 'linkedin_connection', 'linkedin_dm', 'linkedin_connection', 'meetup',
  'linkedin_connection', 'email', 'linkedin_dm', 'linkedin_connection', 'whatsapp',
  'linkedin_connection', 'email', 'instagram', 'phone', 'meetup',
]

function seedPeople(): PersonDetail[] {
  return names.map((name, index) => {
    const id = String(index + 1)
    const paid = [0, 4, 24].includes(index)
    const replied = index < 10 || index % 4 === 0
    const saidYes = [0, 1, 4, 8, 12, 16, 24].includes(index)
    const event = events[index === 21 ? 1 : 0]!
    const eventStatus: EventStatus = {
      event_key: event.key,
      event_name: event.name,
      replied: replied ? 'yes' : index === 23 ? 'unknown' : 'no',
      response: saidYes ? 'yes' : replied ? (index === 3 ? 'no' : 'maybe') : 'unknown',
      paid: paid ? 'yes' : 'no',
      amount_cents: paid ? 3755 : 0,
      signed_up: paid || index === 8 ? 'yes' : 'no',
      notes: paid ? 'Demo payment confirmed. All information on this screen is fictional.' : '',
    }
    const platforms = index < 23
      ? [...new Set([platformKeys[index]!, ...(index % 5 === 0 ? ['linkedin_dm'] : [])])]
      : index === 24 ? ['meetup'] : []
    const touches = index >= 23 ? [] : platforms.map((platform, touchIndex) => ({
      id: `demo-${id}-${touchIndex}`,
      platform,
      platform_label: '',
      event_key: event.key,
      event_label: event.name,
      date_text: `2026-10-${String(20 + index % 10 + touchIndex).padStart(2, '0')}`,
      message_summary: platform === 'linkedin_connection'
        ? 'Sent a connection request with a short invitation to meet the F8 community.'
        : 'Shared the event details, ticket link, and a friendly invitation to join us.',
      reply_summary: replied
        ? saidYes ? '“Sounds like a lovely evening. Count me in!” (fictional reply)'
          : index === 3 ? '“I can’t make this one, but thank you!” (fictional reply)'
            : '“Thanks for the invite! Let me check my calendar.” (fictional reply)'
        : '',
      replied: replied ? 'yes' as const : 'no' as const,
      outreach_status: replied ? 'Replied' : platform === 'linkedin_connection' ? 'Connection pending' : 'Sent',
      contacted: 'yes' as const,
      source: 'Fictional demo fixture',
      notes: '',
    }))
    const statuses = [eventStatus]
    if (index < 5) {
      statuses.push({
        ...eventStatus, event_key: events[1]!.key, event_name: events[1]!.name,
        paid: 'no', amount_cents: 0, signed_up: 'no', notes: '',
      })
    }
    return {
      person: {
        id, name: `Demo ${name}`, contact: `demo.${id}@example.invalid`,
        organization: `Fictional ${['Acorn Studio', 'Cloud Collective', 'Moonbeam Co.'][index % 3]}`,
        type: 'Individual', kind: index === 22 ? 'partner' : 'guest',
        platforms, events: statuses.map(status => status.event_key),
        replied: eventStatus.replied, response: eventStatus.response, paid: eventStatus.paid,
        signed_up: eventStatus.signed_up, amount_cents: eventStatus.amount_cents,
        last_touch_date: touches.at(-1)?.date_text ?? '',
        notes: index === 24 ? 'Fictional example: bought a ticket through Meetup without direct outreach.'
          : 'A made-up contact for previewing the CRM. Not a real person.',
      },
      events: statuses,
      touches: touches.reverse(),
    }
  })
}

function aggregateAnswer(values: Answer[]): Answer {
  return values.includes('yes') ? 'yes' : values.includes('no') ? 'no' : 'unknown'
}

function summary(detail: PersonDetail, eventKey?: string): PersonSummary {
  const statuses = detail.events.filter(event => !eventKey || event.event_key === eventKey)
  return {
    ...detail.person,
    platforms: eventKey
      ? [...new Set(detail.touches.filter(touch => touch.event_key === eventKey).map(touch => touch.platform))]
      : detail.person.platforms,
    replied: aggregateAnswer(statuses.map(event => event.replied)),
    response: statuses.find(event => event.response === 'yes') ? 'yes'
      : statuses.find(event => event.response === 'maybe') ? 'maybe'
        : statuses.find(event => event.response === 'no') ? 'no' : 'unknown',
    paid: aggregateAnswer(statuses.map(event => event.paid)),
    signed_up: aggregateAnswer(statuses.map(event => event.signed_up)),
    amount_cents: statuses.reduce((sum, event) => sum + event.amount_cents, 0),
  }
}

function matchesStatus(person: PersonSummary, detail: PersonDetail, filters: PeopleFilters) {
  switch (filters.status) {
    case 'replied': return person.replied === 'yes'
    case 'yes': return person.response === 'yes'
    case 'paid': return person.paid === 'yes'
    case 'signed_up': return person.signed_up === 'yes'
    case 'no_reply': return person.replied === 'no'
      && detail.touches.some(touch => touch.contacted === 'yes' && (!filters.event || touch.event_key === filters.event))
    case 'not_contacted': return !detail.touches.some(touch => touch.contacted === 'yes' && (!filters.event || touch.event_key === filters.event))
    default: return true
  }
}

function seedSponsors(): Sponsor[] {
  const businesses = [
    'Maple Leaf Fitness', 'Moonbeam Bakery', 'Cloudberry Studio', 'Acorn & Orbit',
    'Paper Lantern Café', 'Velvet Fern Florals', 'Daydream Dental', 'Starlight Cycles',
    'Honeybee Books', 'Pebble & Pine', 'Clover Cloud Spa', 'Marshmallow Media',
    'Origami Owl Designs', 'Jellybean Juice', 'Rainbow Room',
  ]
  return businesses.map((business, index) => ({
    id: `demo-sponsor-${index + 1}`, event_key: sponsorEvent, business_name: `${business} (demo)`,
    contact_name: `Demo ${names[index]}`, email: `sponsor.${index + 1}@example.com`,
    category: ['Fitness', 'Food & drink', 'Creative'][index % 3]!,
    area: ['Demo North', 'Demo Centre', 'Demo South'][index % 3]!,
    date_pitched: index % 6 === 0 ? null : '2026-10-28',
    status: sponsorStatuses[index % sponsorStatuses.length]!.value,
    level: index % 6 === 4 ? 'gold' : index % 6 === 3 ? 'silver' : null,
    amount_cents: index % 6 === 4 ? 50_000 : index % 6 === 3 ? 30_000 : null,
    follow_up_date: [1, 2, 3].includes(index % 6) ? '2026-10-30' : null,
    notes: 'Entirely fictional sponsor. Use this demo to try a pitch, a follow-up, or a package change.',
    source: 'Fictional demo fixture',
    created_at: '2026-10-25T18:00:00Z', updated_at: '2026-10-28T18:00:00Z',
  }))
}

function validateSponsor(sponsor: Sponsor) {
  const invalid = () => { throw new ApiError('Check the sponsor fields and try again.', 400, 'validation') }
  if (typeof sponsor.business_name !== 'string' || !sponsor.business_name.trim()
    || typeof sponsor.event_key !== 'string' || !sponsor.event_key.trim()) invalid()
  if (!sponsorStatuses.some(status => status.value === sponsor.status)) invalid()
  if (sponsor.level !== null && !sponsorLevels.some(level => level.value === sponsor.level)) invalid()
  if (sponsor.amount_cents !== null && (!Number.isSafeInteger(sponsor.amount_cents) || sponsor.amount_cents < 0)) invalid()
  for (const key of ['date_pitched', 'follow_up_date'] as const) {
    if (sponsor[key] !== null && !plainDate(sponsor[key])) invalid()
  }
  for (const key of ['contact_name', 'email', 'category', 'area', 'notes', 'source'] as const) {
    if (sponsor[key] !== null && typeof sponsor[key] !== 'string') invalid()
  }
}

/** A fresh, isolated fake database. Changes last until the page is reloaded. */
export function createDemoApi(latency = 180): CrmApi {
  const people = seedPeople()
  const sponsors = seedSponsors()
  let sponsorSequence = sponsors.length
  const resolve = async <T,>(value: T): Promise<T> => {
    if (latency) await new Promise(done => setTimeout(done, latency))
    return structuredClone(value)
  }
  const find = (id: string) => {
    const detail = people.find(item => item.person.id === id)
    if (!detail) throw new Error('This demo contact could not be found.')
    return detail
  }
  const findSponsor = (id: string) => {
    const sponsor = sponsors.find(item => item.id === id)
    if (!sponsor) throw new ApiError('This demo sponsor could not be found.', 404)
    return sponsor
  }
  const platinumHolder = (event: string, exceptId = '') => sponsors.find(item =>
    item.event_key === event && item.id !== exceptId && item.level === 'platinum' && item.status !== 'declined')
  function saveSponsor(input: SponsorCreate | SponsorPatch, existing?: Sponsor) {
    const now = new Date().toISOString()
    const base: Sponsor = existing ?? {
      id: `demo-sponsor-${sponsorSequence + 1}`, event_key: sponsorEvent, business_name: '',
      contact_name: null, email: null, category: null, area: null, date_pitched: null,
      status: 'not_contacted', level: null, amount_cents: null, follow_up_date: null,
      notes: null, source: null, created_at: now, updated_at: now,
    }
    const next = { ...base }
    // Only writable fields, and undefined is not a PATCH.
    for (const key of Object.keys(base) as (keyof Sponsor)[]) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue
      if (input[key] !== undefined) Object.assign(next, { [key]: input[key] })
    }
    validateSponsor(next)
    next.business_name = next.business_name.trim()
    next.email = next.email?.trim() || null
    next.amount_cents = sponsorEffectiveAmount(next)
    if (sponsors.some(item => item.id !== next.id && item.event_key === next.event_key
      && (item.business_name.toLowerCase() === next.business_name.toLowerCase()
        || (next.email !== null && item.email?.toLowerCase() === next.email.toLowerCase())))) {
      throw new ApiError('A sponsor with this business name or email already exists', 409, 'duplicate')
    }
    const holder = platinumHolder(next.event_key, next.id)
    if (next.level === 'platinum' && next.status !== 'declined' && holder) {
      throw new ApiError(`Platinum is already taken by ${holder.business_name}. Choose another level.`, 409, 'platinum_taken')
    }
    next.updated_at = now
    if (existing) Object.assign(existing, next)
    else { sponsors.push(next); sponsorSequence++ }
    return next
  }
  return {
    async login() {
      return resolve({ token: 'fake-demo-token', expiresAt: '2099-01-01T00:00:00Z' })
    },
    async events() { return resolve(events) },
    async people(filters) {
      const q = filters.q?.trim().toLowerCase() ?? ''
      return resolve(people.filter(detail => !filters.event || detail.events.some(event => event.event_key === filters.event))
        .map(detail => ({ detail, person: summary(detail, filters.event) }))
        .filter(({ detail, person }) =>
          (!q || `${person.name} ${person.organization} ${person.contact}`.toLowerCase().includes(q))
          && (!filters.platform || person.platforms.includes(filters.platform))
          && (!filters.kind || person.kind === filters.kind)
          && matchesStatus(person, detail, filters))
        .map(({ person }) => person))
    },
    async person(id) { return resolve(find(id)) },
    async updatePerson(id, patch) {
      const detail = find(id)
      for (const field of ['notes', 'contact', 'organization', 'kind'] as const) {
        if (patch[field] !== undefined) detail.person[field] = patch[field]
      }
      for (const update of patch.events ?? []) {
        const status = detail.events.find(event => event.event_key === update.event_key)
        if (status) Object.assign(status, update)
      }
      Object.assign(detail.person, summary(detail))
      return resolve(detail)
    },
    async sponsors(filters) {
      const query = filters.q?.trim().toLowerCase() ?? ''
      return resolve(sponsors.filter(item =>
        (!filters.event || item.event_key === filters.event) && (!filters.status || item.status === filters.status)
        && (!query || [item.business_name, item.contact_name, item.email, item.category, item.area].join(' ').toLowerCase().includes(query))))
    },
    async sponsor(id) { return resolve(findSponsor(id)) },
    async createSponsor(input) { return resolve(saveSponsor(input)) },
    async updateSponsor(id, patch) { return resolve(saveSponsor(patch, findSponsor(id))) },
    async sponsorSummary(event) {
      const list = sponsors.filter(item => item.event_key === event)
      const holder = platinumHolder(event)
      const today = new Date()
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const statusCount = (status: Sponsor['status']) => list.filter(item => item.status === status).length
      const total = (status: Sponsor['status']) => list.filter(item => item.status === status).reduce((sum, item) => sum + (sponsorEffectiveAmount(item) ?? 0), 0)
      const data: SponsorSummary = {
        event_key: event, total: list.length,
        by_status: {
          not_contacted: statusCount('not_contacted'), pitched: statusCount('pitched'),
          replied: statusCount('replied'), interested: statusCount('interested'),
          confirmed: statusCount('confirmed'), declined: statusCount('declined'),
        },
        committed_cents: total('confirmed'), pipeline_cents: total('interested'),
        platinum: { taken: !!holder, holder: holder ? { id: holder.id, business_name: holder.business_name, status: holder.status } : null },
        levels: {
          platinum: list.filter(item => item.level === 'platinum' && item.status !== 'declined').length,
          gold: list.filter(item => item.level === 'gold' && item.status !== 'declined').length,
          silver: list.filter(item => item.level === 'silver' && item.status !== 'declined').length,
        },
        follow_ups_due: list.filter(item => item.follow_up_date && item.follow_up_date <= date
          && item.status !== 'confirmed' && item.status !== 'declined').length,
      }
      return resolve(data)
    },
    async overview(key) {
      const event = events.find(item => item.key === key)
      if (!event) throw new Error('This demo event could not be found.')
      const associated = people.filter(detail => detail.events.some(status => status.event_key === key))
      const invited = associated.filter(detail => detail.touches.some(touch => touch.event_key === key && touch.contacted === 'yes'))
        .map(detail => summary(detail, key))
      const all = associated.map(detail => summary(detail, key))
      const totals = (list: PersonSummary[]) => ({
        invited: list.length,
        replied: list.filter(person => person.replied === 'yes').length,
        yes: list.filter(person => person.response === 'yes').length,
        paid: list.filter(person => person.paid === 'yes').length,
      })
      const platforms: PlatformStats[] = [...new Set(invited.flatMap(person => person.platforms))]
        .map(platform => ({ platform, ...totals(invited.filter(person => person.platforms.includes(platform))) }))
      return resolve({
        event, invited: { count: invited.length, people: invited }, funnel: totals(invited),
        paid_total: all.filter(person => person.paid === 'yes').length,
        signed_up_total: all.filter(person => person.signed_up === 'yes').length,
        revenue_cents: all.filter(person => person.paid === 'yes').reduce((total, person) => total + person.amount_cents, 0),
        platforms, partners: { count: associated.filter(detail => detail.person.kind === 'partner').length },
      })
    },
  }
}
