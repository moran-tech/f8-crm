# F8 Social Club · Outreach CRM

A private, phone-first workspace for Faith’s event outreach in Surrey, BC. Built with React, TypeScript, and plain CSS. Overview, People, and Sponsors tabs with editable details and hash URLs that work on GitHub Pages.

**Site:** https://moran-tech.github.io/f8-crm/

**Default event:** End of Year Mixer (`eoy-mixer`), Saturday, December 5, 2026, Studio Nazrana.

## Develop

```sh
export PATH=~/.nvm/versions/node/v24.16.0/bin:$PATH
npm ci
npm run dev
# Open http://localhost:5173/f8-crm/
```

```sh
npm run lint
npm test
npm run build
npm run preview -- --host 127.0.0.1
# Open http://127.0.0.1:4173/f8-crm/
```

## Demo mode, no backend needed

Open `/f8-crm/?demo=1` (including in preview or on the deployed site). This bypasses login and switches **every CRM operation** to `src/api/demo.ts`. Alternatively set `VITE_DEMO=1` before starting Vite or building.

The in-memory demo has 25 explicitly fictional contacts, two events, overlapping platforms, full touch histories, a not-contacted person, and three $37.55 payments. One payment is outside direct outreach. Names start with “Demo,” organizations are fictional, and contact addresses use `example.invalid`. It also has 15 fictional sponsor businesses marked “(demo),” with `example.com` emails, all six statuses, confirmed Gold and interested Silver packages, and Platinum initially open. Search, filters, creates, edits, conflicts, and summary calculations work. Edits last only until refresh; the workspace menu can reset the demo. Demo mode never sends CRM requests to the backend and does not persist contact or sponsor data.

Examples:

- Overview: `/f8-crm/?demo=1#/overview`
- People: `/f8-crm/?demo=1#/people`
- Detail: `/f8-crm/?demo=1#/people/1`
- Sponsors: `/f8-crm/?demo=1#/sponsors`
- Sponsor detail: `/f8-crm/?demo=1#/sponsors/demo-sponsor-1`
- Add sponsor: `/f8-crm/?demo=1#/sponsors/new`

## Configuration and privacy

Copy `.env.example` to `.env.local` if needed:

```dotenv
VITE_API_BASE=https://fireplace-waitlist.onrender.com
VITE_DEMO=0
```

`src/config.ts` is the single configuration source. Vite configuration is public and baked into the build. **Never put a password, token, real contact, or import/export of CRM data in this repository or a `VITE_*` variable.** The app has no analytics. One Google font loads with a system-font fallback.

Login posts only the password to `/crm/login`. The returned bearer token and ISO expiry are kept in localStorage (`f8-crm-session`) and memory. If browser storage is unavailable, the session works until reload. Expiry and authenticated HTTP 401 responses clear the session and return to login. Sign out is in the workspace menu. Contact data is fetched on demand, kept only in memory, and requests use `cache: no-store`.

GitHub Pages serves a public frontend, not a security boundary. The API must authenticate every `/crm` route except login and allow CORS for `https://moran-tech.github.io` (and localhost during development), including `Authorization`, `Content-Type`, GET, POST, PATCH, and OPTIONS. No credentials belong in the frontend bundle.

## Structure

```text
src/
  config.ts              API base, demo switch, default event
  api/
    types.ts             JSON contract / normalized types
    auth.ts              Token storage and expiry validation
    client.ts            HTTP, 401 handling, defensive normalizers
    demo.ts              Isolated, fake in-memory API
  components/ui.tsx      Icons, platform chips, status pills, states
  pages/
    Overview.tsx         Event numbers, funnel, platform results, invitees
    People.tsx           Search, event/platform/kind/status filters, four-column list
    Person.tsx           Contact, event editor, save feedback, touch timeline
    Sponsors.tsx         Mixer summary, search/status filters, four-column list
    Sponsor.tsx          Create/edit form, availability, unsaved-change warning
  hooks.ts               Race-safe loading, debounced search, hash routing
  platforms.ts / utils.ts Labels, formatting, safe contact links
  sponsors.ts            Sponsor labels, package amounts, plain dates, cents
  App.tsx                Login, session lifecycle, navigation, shared filters
  index.css / App.css    Responsive, accessible styles
tests/                   API normalization, authentication, demo regression tests
public/.nojekyll         Copied into the Pages build
docs/deploy-pages.workflow.yml
```

## API assumptions

- Routes and PATCH fields follow the supplied `/crm` contract. IDs are normalized to strings; enum values remain distinct (`unknown` is never silently treated as `no`). Amounts are integer CAD cents; dates are ISO strings, and login `expiresAt` is an ISO timestamp.
- Events may be a bare array or `{events: [...]}`; people may be a bare array or `{people: [...]}`. Invitees accept `invited.people`, `invited.contacts`, `invited.list`, `invited_people`, or top-level `people`. Common key/name and touch-history aliases are accepted. Missing fields get safe defaults, extra fields are ignored, and booleans are accepted for yes/no answers.
- Event-filtered people and overview totals are calculated by the backend. With “All events,” the backend determines aggregate person status. The demo uses any-yes aggregation. Platform rows count distinct people on each platform, so rows may overlap. Reply rates do **not** prove which message caused a reply.
- The Paid card and funnel count paid **outreach invitees**. Revenue, paid total, and signed-up total cover all registrations. The “paid without outreach” difference is not attributed to Meetup or another platform because the contract does not establish its source.
- PATCH returns the full updated `{person, events, touches}` detail. Saves optimistically update displayed status, roll back on failure, retain edits for retry, and refresh summaries on return. Only existing event records can be edited. Touch history is displayed in the server’s supplied order.
- Contact notes and per-event fields are editable. Other profile facts are read-only. Navigation away from a detail page discards unsaved edits; browser refresh/close warns when possible.

### Sponsors

- Sponsors are scoped to `eoy-mixer`, independent of the Overview event picker. GET `/crm/sponsors?q=&status=&event=`, GET/POST `/crm/sponsors`, GET/PATCH `/crm/sponsors/:id`, and GET `/crm/sponsors/summary?event=eoy-mixer` use the same bearer auth and 401 logout flow. GET/POST/PATCH detail responses wrap the full record in `{sponsor}`; list responses use `{sponsors}`.
- POST sends the mixer event key and business name. PATCH sends only changed writable fields; empty optional fields send `null`. IDs and created/updated timestamps are read-only. Source is editable. Prices are CAD cents: Platinum 100000, Gold 50000, Silver 30000. Selecting a level fills only a blank amount; clearing a level does not erase a custom amount.
- Summary counts and availability come from the backend, not the filtered list. Committed means confirmed amounts; pipeline means interested amounts. `levels` is assumed to contain counts. A taken Platinum response without a holder still renders safely.
- The demo reserves Platinum for **any non-declined sponsor assigned Platinum**, once per event; declining or clearing the level releases it. This is an assumption pending backend confirmation. The backend remains authoritative on save, including races, via 409 `platinum_taken` (holder business name shown) or `duplicate`. Demo duplicates are case-insensitive business names per event. Demo follow-ups due are dates on/before the local day, excluding confirmed and declined sponsors.
- Sponsor date inputs and date-only normalization preserve calendar dates without UTC conversion. Email links accept only a plain, sane mailbox. Sponsor navigation (including hash links and browser Back), refresh/close, and sign-out warn about unsaved changes; edits remain after failed saves.

## Deploy to the existing `gh-pages` branch

Only run this when ready to publish:

```sh
npm run deploy
```

This builds the app, then uses the `gh-pages` devDependency to publish `dist/` to the `gh-pages` branch with `--dotfiles`, including `.nojekyll`. It **pushes to the remote**, so it requires appropriate repository credentials. Pages should use **Deploy from a branch → gh-pages → / (root)**. The Vite base stays `/f8-crm/`.

### Optional switch to Actions later

The ready-to-use workflow is deliberately at `docs/deploy-pages.workflow.yml`, **not** under `.github`, because the current token cannot push workflow files. With workflow permission:

1. Move it to `.github/workflows/deploy-pages.yml`.
2. Set Pages source to **GitHub Actions**.
3. Optionally configure the repository variable `VITE_API_BASE`.
4. Push to `main` or run the workflow manually.

The workflow installs dependencies, lints, tests, builds, uploads the Pages artifact, and deploys. No live CRM data or API password is needed to build.
