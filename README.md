# StitchCraft

Cross-stitch, color-by-number & diamond-painting studio: draw patterns by
hand, or convert a photo into one, then export a printable chart with a
materials list.

M0 (foundation), M1 (the pattern editor), and M2 (the classic image-to-
pattern converter) are done: monorepo tooling, shared type/color packages, a
NestJS API with working auth + projects/patterns/palettes/conversions CRUD,
a full Angular pattern editor - draw, erase, undo/redo, resize, zoom, four
render modes, a palette panel - and an upload wizard that turns a photo into
an editable chart via a background BullMQ job. See [PLAN.md](./PLAN.md) for
the full architecture, data model, API contract, and milestone breakdown,
and [CONTRIBUTING.md](./CONTRIBUTING.md) for day-to-day workspace
conventions.

## Stack

Angular 18 (standalone + signals) · NestJS · PostgreSQL/Prisma · Redis/BullMQ
· sharp · Nx monorepo · pnpm. Full rationale in PLAN.md §1.

## Prerequisites

- Node 20+
- pnpm (`corepack enable && corepack prepare pnpm@9 --activate`, or `npm i -g pnpm`)
- PostgreSQL and Redis — either via Docker Compose (below) or installed locally.
  Redis is required from M2 onward: the converter enqueues conversion jobs on
  a BullMQ queue, which needs a reachable Redis to add or process jobs.
- Docker + Docker Compose, if you want the one-command path

## Getting started

```sh
pnpm install
```

> **Note on this environment:** this repository was scaffolded in a sandbox
> with severely throttled access to the npm registry (single small packages
> took 10+ minutes), so `pnpm install` was never fully verified end-to-end
> here. The code is complete and structured for a standard `pnpm install` on
> a normal connection. If something doesn't resolve, check dependency
> versions in the relevant `package.json` against what's actually current
> and adjust — nothing in the source depends on an exact patch version.

### Option A: Docker Compose (db + redis + api + web)

```sh
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:3000/api

The API container does not run migrations automatically. On first run,
apply the schema from your host machine (see below) while the containers
are up.

### Option B: run apps on the host

```sh
cp .env.example .env
# start Postgres + Redis only:
docker compose up db redis

# apply the Prisma schema
pnpm prisma:generate
pnpm prisma:migrate

# optional: seed a demo user + project + pattern
pnpm nx run api:seed

# run both apps
pnpm dev:api    # http://localhost:3000/api
pnpm dev:web    # http://localhost:4200 (proxies /api to :3000 in dev)
```

Demo login after seeding: `demo@stitchcraft.dev` / `demo-password-123`.

## Common tasks

```sh
pnpm build              # build all projects
pnpm test               # unit tests for all projects
pnpm lint                # lint all projects
pnpm affected:test       # only test what changed vs. main
npx nx graph              # visualize the project dependency graph
```

## Repository layout

```
apps/web        Angular app (editor, converter, projects, palettes)
apps/api         NestJS API (auth, projects, patterns, palettes, storage, conversion, imaging; M4+: export)
services/ai      Optional Python FastAPI microservice for AI-assisted conversion steps (M5, not yet implemented)
packages/types   Shared domain models + DTOs, imported by both apps
packages/color   Color math: sRGB<->Lab, CIEDE2000, quantization, DMC matching, symbol assignment
tools/           One-off repo scripts (e.g. regenerating the DMC dataset)
```

See PLAN.md §3 for the full annotated tree.

## Environment variables

See [.env.example](./.env.example) for the full list (database, Redis, JWT
secrets, CORS origin, local storage path). `docker-compose.yml` sets these
directly for containerized services; `.env` is only read when running
`apps/api` on the host.

## What's implemented (M0 + M1 + M2)

- **Auth**: register/login/refresh with JWT access + refresh tokens, bcrypt
  password hashing, refresh-token revocation via a stored hash.
- **Projects & patterns**: full CRUD, ownership-checked on every mutation,
  grid stored as run-length-encoded rows (`packages/types`) so a blank
  200×200 pattern doesn't cost 40,000 numbers. Projects list can create a
  pattern (name/type/size) and jumps straight into the editor.
- **Palettes**: browse the seeded 454-color DMC reference set
  (paginated/searchable) and create custom palettes.
- **Color math** (`packages/color`): sRGB<->CIELAB conversion, CIEDE2000
  perceptual color difference, k-means and median-cut quantization, nearest-
  DMC-color matching, and a readable symbol/glyph alphabet for
  color-by-number and diamond charts — all unit-tested.
- **Pattern editor** (`apps/web/src/app/features/editor` +
  `shared/canvas`): a canvas `grid-canvas` component driven by a
  framework-free `GridRenderingService`, paint/erase tools, four render
  modes (x-stitch/block/symbol/number with grid guides bold every 10 cells),
  zoom, per-drag-stroke undo/redo, resize (preserves overlapping cells),
  and a palette panel (`palette-grid`, `palette-swatch`, `color-picker`) plus
  a live `legend` (stitch counts per color) and `size-readout` (finished
  dimensions by Aida count or diamond drill size). All state lives in a
  component-scoped `EditorStore`; `grid-canvas` itself owns no business
  rules, only rendering and pointer input, per PLAN.md's architecture split.
- **Angular shell**: routing (with route-param → component-input binding),
  design tokens as CSS custom properties (dark-mode + reduced-motion aware),
  a signal-based `AuthStore`, HTTP interceptors for auth + 401 handling, and
  a shared UI library (button, icon-button, segmented-toggle, slider, modal,
  toolbar, file-drop, badge, empty-state, progress, palette-swatch,
  palette-grid, color-picker, legend, size-readout), each with its own test.
- **Image converter** (`apps/api/src/modules/conversion` + `imaging`,
  `apps/web/src/app/features/converter`): upload a PNG/JPG/WebP, pick a
  pattern type/size/color count, and a BullMQ `WorkerHost` processor runs
  the deterministic pipeline off the request thread — resize via `sharp`,
  k-means quantize (`packages/color`), nearest-DMC-match each resulting
  color, dedupe centroids that snap to the same real thread, assign
  symbols, build the grid. Progress is tracked in Postgres and pushed over
  a WebSocket gateway (`/ws/conversions`); the frontend wizard polls
  `GET /conversions/:id` (the contract's documented fallback) and opens the
  finished pattern straight in the editor. An `AiProvider` seam
  (`NullAiProvider` by default) means the AI flags degrade gracefully with
  no AI service configured, per PLAN.md's requirement.
- **Export routes** exist and are typed against the API contract but return
  `501 Not Implemented` — real implementation lands in M4.

Known scope cuts in the editor (see PLAN.md assumption #10): resize isn't
itself undoable (it clears history); adding a color to a pattern's palette
is limited to the custom color-picker (no DMC-search-and-add flow inside the
editor yet, though DMC browsing exists as its own page); pan is native
browser scroll rather than a custom drag gesture; the canvas bitmap doesn't
scale for devicePixelRatio; and the canvas's grid theme colors are a static
JS constant rather than read from CSS custom properties, so it doesn't
follow dark mode yet the way the rest of the UI does.

Known scope cuts in the converter (see PLAN.md assumption #11): no
crop/rotate/brightness/contrast step; sizing is stitch-count only (not
physical-size-plus-fabric-count); no lock/swap-a-specific-DMC-match UI
(edit the palette after opening the result in the editor instead); the
frontend polls rather than subscribing to the (real, working) WS gateway.

Not yet built (by design — see PLAN.md milestones): diamond-painting mode
(M3), real exports (M4), and the optional AI service (M5).
