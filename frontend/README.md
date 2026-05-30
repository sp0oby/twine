# Twine — frontend

Splash page (`/`) and pre-launch app skeleton (`/app`). Pre-rendered, no client-side state yet —
the dashboard becomes live once a Twine pool is deployed and an indexer is wired.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS 3.4
- Inter + JetBrains Mono via `next/font`

No `shadcn/ui`, no animation libraries, no analytics. Intentional restraint — type and spacing
carry the page.

## Run

```bash
npm install
npm run dev    # localhost:3000
```

## Style guardrails

Black canvas (`#0a0a0a`), off-white text (`#ededed`), one accent (muted gray for dividers and
secondary text). Headlines in sans, all data and structural labels in mono. No gradients, no
glow, no fake stats — the status panel shows real build state and the app dashboard shows `—`
until live data is available.

## Routes

- `/` — splash. Explains the protocol and the flagship MSTRX/cbBTC pair.
- `/app` — pool dashboard placeholder. Layout is real; values are `—` until a pool is live.

## Linking out

The "Read" section on the splash uses placeholder `#` hrefs. Wire them to the GitHub repo and the
hosted spec once URLs exist.
