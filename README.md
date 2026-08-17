# StitchCraft

Cross-stitch, color-by-number & diamond-painting studio: draw patterns by
hand, or convert a photo into one, then export a printable chart with a
materials list.

All six milestones from [PLAN.md](./PLAN.md) are built: foundation, the
pattern editor, the classic image converter, diamond-painting mode,
exports, the optional AI microservice, and a polish pass. See PLAN.md for
the full architecture, data model, API contract, and a detailed
per-milestone account of what was built and why (including the scope cuts
made along the way - numbered assumptions #1-13). See
[CONTRIBUTING.md](./CONTRIBUTING.md) for day-to-day workspace conventions.

## Stack

Angular 18 (standalone + signals) · NestJS · PostgreSQL/Prisma ·
Redis/BullMQ · sharp · pdfkit · Python/FastAPI (optional AI service) · Nx
monorepo · pnpm. Full rationale in PLAN.md §1.

## Prerequisites

- Node 22 (via Corepack, which ships with it — no separate pnpm install needed)
- PostgreSQL and Redis — either via Docker Compose (below) or installed locally.
  Redis is required from the converter onward: it enqueues conversion jobs
  on a BullMQ queue, which needs a reachable Redis to add or process jobs.
  Everything else (auth, projects, patterns, palettes, editor, exports)
  works without Redis running.
- Docker + Docker Compose, if you want the one-command path (see the note
  below — this path hasn't been verified in every environment)
- Python 3.11+, only if you want to run the optional AI microservice
  (`services/ai`) outside Docker

## Getting started

```sh
pnpm install
```

### Option A: Docker Compose (db + redis + api + web)

```sh
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:3000/api

The API container does not run migrations automatically. On first run,
apply the schema from your host machine (see Option B below) while the
containers are up.

> This path hasn't been exercised with a real `docker build` in this
> environment (no Docker CLI available here) — the API's `Dockerfile` is
> correct as far as static review + the equivalent host-side build/run
> steps can confirm (see PLAN.md §7), but hasn't had an actual container
> boot to prove it. Option B below _has_ been run for real, end to end,
> including a live database.

To also run the optional AI microservice:

```sh
docker compose --profile ai up --build
```

...and uncomment `AI_SERVICE_URL` in the `api` service's environment in
`docker-compose.yml` so the API actually calls it. It's off by default -
`onnxruntime` makes for a large image, and the app works fully without it
(background removal/upscale just become no-ops).

### Option B: run apps on the host

```sh
cp .env.example .env
# edit .env with real DATABASE_URL / REDIS_URL for your machine, or:
docker compose up db redis   # start just Postgres + Redis

# apply the Prisma schema (creates apps/api/prisma/migrations on first run)
pnpm prisma:migrate

# optional: seed a demo user + project + pattern
pnpm nx run api:seed

# run both apps (two terminals)
pnpm dev:api    # http://localhost:3000/api
pnpm dev:web    # http://localhost:4200 (proxies /api to :3000 in dev)
```

Demo login after seeding: `demo@stitchcraft.dev` / `demo-password-123`.

To also run the AI service on the host (see `services/ai/README.md` for
details):

```sh
cd services/ai
python -m venv .venv && source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
# then set AI_SERVICE_URL=http://localhost:8000 in your .env
```

## Common tasks

```sh
pnpm build               # build all projects
pnpm test                # unit tests for all projects (281 tests)
pnpm lint                # lint all projects
pnpm affected:test       # only test what changed vs. main
npx nx graph             # visualize the project dependency graph

# e2e (needs pnpm dev:web running, or set E2E_BASE_URL to point elsewhere):
npx playwright test
```

## Repository layout

```
apps/web         Angular app: editor, converter, projects, palettes
apps/api          NestJS API: auth, projects, patterns, palettes, storage, conversion, imaging, export
services/ai       Optional Python FastAPI microservice for AI-assisted conversion steps
packages/types    Shared domain models + DTOs, imported by both apps
packages/color    Color math: sRGB<->Lab, CIEDE2000, quantization, DMC matching, symbol assignment, contrast
tools/            One-off repo scripts (e.g. regenerating the DMC dataset)
```

See PLAN.md §3 for the fuller annotated tree (as scaffolded in M0 - not
kept byte-for-byte current through every later milestone's new files, but
the module/feature layout it describes hasn't changed).

## Environment variables

See [.env.example](./.env.example) for the full list (database, Redis, JWT
secrets, CORS origin, local storage path, optional AI service URL).
`docker-compose.yml` sets these directly for containerized services;
`.env` is only read when running `apps/api` on the host.

## What's implemented

Everything in PLAN.md's milestone list (M0-M6) is built:

- **Auth**: register/login/refresh with JWT access + refresh tokens, bcrypt
  password hashing, refresh-token revocation via a stored hash.
- **Projects & patterns**: full CRUD, ownership-checked on every mutation,
  grid stored as run-length-encoded rows so a blank 200×200 pattern doesn't
  cost 40,000 numbers. The projects page creates patterns (name/type/size/
  fabric-count-or-drill-size) and jumps straight into the editor, or starts
  the image converter for a project.
- **Pattern editor**: a canvas `grid-canvas` component driven by a
  framework-free `GridRenderingService` - paint/erase, five render modes
  (x-stitch/block/diamond/symbol/number, grid guides bold every 10 cells),
  zoom, per-drag-stroke undo/redo, resize, a palette panel, a live legend
  (stitch/drill counts per color), and a size readout (finished dimensions
  by Aida count or diamond drill size in mm). All state lives in a
  component-scoped `EditorStore`; the canvas component itself owns no
  business rules.
- **Image converter**: upload a PNG/JPG/WebP, pick type/size/color count,
  and a BullMQ worker resizes it (`sharp`), k-means quantizes it, nearest-
  DMC-matches and dedupes the resulting colors, assigns symbols, and builds
  the pattern - opening straight in the editor when done. Progress is
  tracked in Postgres and pushed over a WebSocket gateway; the frontend
  wizard polls (the API contract's documented fallback).
- **Diamond painting mode**: a distinct "gem" render mode in the editor,
  settable drill size (mm) driving the size readout's physical-size math,
  a legend that reads "Drills" instead of "Stitches" for diamond patterns.
- **Exports**: `POST /exports/:patternId` generates a tiled, printable PDF
  (row/col rulers, grid guides, a legend/materials page), a standalone SVG
  chart, a PNG rasterized from it, and a CSV shopping list sorted by how
  much of each color you'll need - all downloadable from the editor.
- **Custom palettes**: a "My palettes" page to build a named palette from
  scratch with the color-picker, and browse/delete saved ones.
- **Color math** (`packages/color`): sRGB<->CIELAB conversion, CIEDE2000,
  k-means/median-cut quantization, nearest-DMC-color matching, a symbol
  alphabet, and a shared contrast-text-color helper - all unit-tested, and
  shared by both the frontend and the server-side chart renderer.
- **Optional AI service** (`services/ai`): FastAPI microservice for
  background removal (`rembg`) and upscale (Lanczos resampling - not a
  trained super-res model, see PLAN.md assumption #13). `apps/api` calls it
  through an `AiProvider` seam that resolves to a no-op `NullAiProvider`
  when `AI_SERVICE_URL` isn't set, so the app works fully with zero AI
  configuration either way.
- **Angular shell**: routing (with route-param → component-input binding),
  design tokens as CSS custom properties (dark-mode + reduced-motion
  aware), a signal-based `AuthStore`, HTTP interceptors, and a shared UI
  library (button, icon-button, segmented-toggle, slider, modal, toolbar,
  file-drop, badge, empty-state, progress, palette-swatch, palette-grid,
  color-picker, legend, size-readout), each with its own test.

**Known, documented scope cuts** (not bugs — deliberate boundaries, each
with a one-line reason): see PLAN.md assumptions #10-13. Briefly: pattern
resize isn't itself undoable; no DMC-search-inside-the-editor (only the
custom color-picker); pan is native scroll; no image crop/rotate/
brightness step in the converter; PDF chart cells show the palette number
rather than the actual symbol glyph (font coverage); AI upscale is
classical resampling, not a trained model.

**Verification status**: the whole stack has actually been run, not just
hand-traced — full details and the specific bugs each pass caught are in
PLAN.md §7. In brief: `pnpm install`, `lint`, `test` (281 tests), and
production builds all pass across every project; both Playwright e2e flows
pass in a real browser; and the compiled API has been run directly against
a real PostgreSQL database over real HTTP (register, login, create a
project, confirmed via `psql` that it persisted) — this last part is worth
calling out because two real bugs meant the _compiled_ API had never
actually been executable before that pass, in dev or in Docker (see PLAN.md
§7's build-fix writeup). The Python AI service was independently verified
the same way: real venv, real `pytest` (7/7 passing), a real HTTP
image-upload/upscale round-trip. The one thing genuinely not exercised in
this environment is a real `docker build`/`docker compose up` (no Docker
CLI available here) — Option A above should work but hasn't had an actual
container boot to prove it.
