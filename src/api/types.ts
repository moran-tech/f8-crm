export type Answer = 'yes' | 'no' | 'unknown' | 'n/a'
export type Response = 'yes' | 'maybe' | 'no' | 'unknown'
export type PeopleStatus = '' | 'replied' | 'yes' | 'paid' | 'signed_up' | 'no_reply' | 'not_contacted'

export interface CrmEvent {
  key: string
  name: string
  date: string
  venue: string
}

export interface PersonSummary {
  id: string
  name: string
  contact: string
  organization: string
  kind: string
  platforms: string[]
  events: string[]
  replied: Answer
  response: Response
  paid: Answer
  signed_up: Answer
  amount_cents: number
  last_touch_date: string
}

export interface EventStatus {
  event_key: string
  event_name: string
  replied: Answer
  response: Response
  paid: Answer
  amount_cents: number
  signed_up: Answer
  notes: string
}

export interface Touch {
  id: string
  platform: string
  platform_label: string
  event_key: string
  event_label: string
  date_text: string
  message_summary: string
  reply_summary: string
  replied: Answer
  outreach_status: string
  contacted: Answer
  source: string
  notes: string
}

export interface PersonDetail {
  person: PersonSummary & { type: string; notes: string }
  events: EventStatus[]
  touches: Touch[]
}

export interface PlatformStats {
  platform: string
  invited: number
  replied: number
  yes: number
  paid: number
}

export interface Overview {
  event: CrmEvent
  invited: { count: number; people: PersonSummary[] }
  funnel: { invited: number; replied: number; yes: number; paid: number }
  paid_total: number
  signed_up_total: number
  revenue_cents: number
  platforms: PlatformStats[]
  partners: { count: number }
}

export interface PeopleFilters {
  q?: string
  event?: string
  platform?: string
  status?: PeopleStatus
  kind?: string
}

export interface PersonPatch {
  notes?: string
  contact?: string
  organization?: string
  kind?: string
  events?: (Partial<Omit<EventStatus, 'event_name'>> & { event_key: string })[]
}

export interface Session {
  token: string
  expiresAt: string
}

export interface CrmApi {
  login(password: string): Promise<Session>
  events(): Promise<CrmEvent[]>
  people(filters: PeopleFilters): Promise<PersonSummary[]>
  person(id: string): Promise<PersonDetail>
  updatePerson(id: string, patch: PersonPatch): Promise<PersonDetail>
  overview(event: string): Promise<Overview>
}
