import type {
  Answer, CrmApi, CrmEvent, EventStatus, PeopleFilters, PersonDetail,
  PersonSummary, PlatformStats,
} from './types.ts'

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

/** A fresh, isolated fake database. Changes last until the page is reloaded. */
export function createDemoApi(latency = 180): CrmApi {
  const people = seedPeople()
  const resolve = async <T,>(value: T): Promise<T> => {
    if (latency) await new Promise(done => setTimeout(done, latency))
    return structuredClone(value)
  }
  const find = (id: string) => {
    const detail = people.find(item => item.person.id === id)
    if (!detail) throw new Error('This demo contact could not be found.')
    return detail
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
