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

- Node 20+
- pnpm (`corepack enable && corepack prepare pnpm@9 --activate`, or `npm i -g pnpm`)
- PostgreSQL and Redis — either via Docker Compose (below) or installed locally.
  Redis is required from the converter onward: it enqueues conversion jobs
  on a BullMQ queue, which needs a reachable Redis to add or process jobs.
- Docker + Docker Compose, if you want the one-command path
- Python 3.11+, only if you want to run the optional AI microservice
  (`services/ai`) outside Docker

## Getting started

```sh
pnpm install
```

> **Note on this environment:** this repository was built in a sandbox with
> severely throttled access to the npm registry (a single small package
> could take 10+ minutes, and the full toolchain never finished
> downloading despite several attempts), so `pnpm install` for the
> Node/Angular/Nest side was never run to completion here — everything
> there was written and hand-traced carefully, not executed. PyPI was not
> similarly throttled, so `services/ai` (the Python microservice) *was*
> actually installed into a real virtualenv, tested with pytest, and
> smoke-tested over real HTTP in this session — see PLAN.md's M5 section.
> If `pnpm install` doesn't resolve cleanly on a normal connection, check
> dependency versions in the relevant `package.json` against what's
> actually current; nothing in the source depends on an exact patch
> version.

### Option A: Docker Compose (db + redis + api + web)

```sh
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:3000/api

The API container does not run migrations automatically. On first run,
apply the schema from your host machine (see below) while the containers
are up.

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
pnpm build              # build all projects
pnpm test               # unit tests for all projects
pnpm lint                # lint all projects
pnpm affected:test       # only test what changed vs. main
npx nx graph              # visualize the project dependency graph
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

**Verification honesty**: everything on the Node/Angular/NestJS side was
written and carefully hand-traced, not executed — this sandbox's npm
registry access was too throttled to complete `pnpm install`. The Python
AI service *was* actually run: real venv, real `pytest` (7/7 passing),
real HTTP smoke test with an actual image upload/upscale round-trip. Please
run the real test suites yourself once dependencies install on a normal
connection before treating this as a verified green build.
