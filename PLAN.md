# StitchCraft — PLAN

Cross-stitch, color-by-number & diamond-painting studio: draw patterns by hand, or convert a
photo into one, then export a printable chart with a materials list.

This document is the source of truth for architecture decisions. It is written before any
feature code and will be kept current as milestones land.

---

## 1. Stack, and why

| Layer                    | Choice                                                                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo                 | **Nx (integrated monorepo, pnpm package manager)**                                                     | Nx has first-class generators for both Angular and NestJS in one workspace, a dependency graph that enforces module boundaries (`@nx/enforce-module-boundaries`), affected-only test/lint/build in CI, and a build cache. A bare pnpm workspace would need all of that hand-rolled.                                                                                                                                                                         |
| Frontend framework       | **Angular 18+, standalone components, signals, `@if`/`@for`**                                          | The spec's reference editor prototype is a canvas-driven, stateful single page — Angular's DI + RxJS/signals combo suits a tool with many interacting stateful panels (tools, palette, undo stack, zoom) better than a leaner framework would without extra structure. Standalone components remove NgModule boilerplate; signals give fine-grained reactivity for a canvas that repaints on every cell edit without the overhead of full change detection. |
| Frontend state           | **Signal-based `*Store` services per feature** (no NgRx)                                               | Editor state (grid, selected color, tool, undo stack) is local to one feature and doesn't need to be observed app-wide or replayed. A `computed()`-driven store service is less ceremony than NgRx actions/reducers/effects for this. Revisit only if cross-feature state sharing or time-travel debugging becomes a real requirement — not speculative in M0.                                                                                              |
| Rendering                | **HTML Canvas behind a `GridRenderingService`, dirty-rect redraw**                                     | Canvas is the only realistic choice for a paintable 200×200 grid at interactive frame rates; the DOM (one element per cell) falls over well before that size. Isolating drawing in a service (not the component) keeps the component a thin input/output adapter, and lets `packages/color`-driven glyph/symbol logic be unit-tested without a browser.                                                                                                     |
| Styling                  | **SCSS + CSS custom properties as design tokens, component-scoped styles, no UI kit**                  | The component list in the spec (button, swatch, segmented-toggle, grid-canvas...) is small and highly specific to pattern-craft UI (thread swatches, symbol legends) — a general-purpose kit (Material, PrimeNG) would fight the domain more than it'd save. Tokens as CSS custom properties (not just SCSS variables) so runtime theming (e.g. print stylesheet, high-contrast mode) doesn't require a rebuild.                                            |
| Backend                  | **NestJS (TypeScript)**                                                                                | One language across the stack; shared types package works without a codegen step. Nest's module system maps directly onto the feature boundaries in the spec (auth, projects, patterns, palettes, conversion, imaging, export, storage), and its DI makes the `StorageAdapter`/`AiProvider` interfaces (local disk vs S3, classic vs AI-backed) trivial to swap via provider tokens.                                                                        |
| Deterministic image work | **`sharp` + `packages/color` inside a NestJS `imaging` module**                                        | Resize, palette quantization, and DMC matching are pure/deterministic — they don't need a model runtime, so they stay in-process for lower latency and no extra service to run in dev.                                                                                                                                                                                                                                                                      |
| Optional AI work         | **Separate Python FastAPI service (`services/ai`), called over HTTP via an `AiProvider` interface**    | Background removal / super-resolution / segmentation are best served by the Python ML ecosystem (rembg, OpenCV, ONNX runtime). Keeping it a separate, optional HTTP service means the Node stack never depends on Python being installed, and `AiProvider` has a `NullAiProvider` fallback so the app is fully functional with zero AI configured — required by the spec, not optional.                                                                     |
| Persistence              | **PostgreSQL via Prisma**                                                                              | Prisma's schema-first models map cleanly onto the spec's data model, migrations are trackable in git, and its generated client is fully typed — consistent with "everything typed." Postgres (not SQLite) because `ConversionJob` status and pattern grids benefit from JSONB and because production deploys need a real server DB anyway; using it from day one avoids a later migration.                                                                  |
| Object storage           | **`StorageAdapter` interface; local-disk adapter in dev, S3-compatible adapter for prod**              | Spec requires source images and generated exports to be stored somewhere pluggable. Local disk means `docker-compose up` needs no cloud credentials to develop.                                                                                                                                                                                                                                                                                             |
| Job queue                | **BullMQ + Redis**                                                                                     | Conversions and exports are the two genuinely slow operations (image processing, PDF tiling). BullMQ gives retries, progress events, and a dashboard-friendly job model with minimal code; progress is pushed to the client over a NestJS WebSocket gateway that subscribes to job progress events.                                                                                                                                                         |
| Shared types             | **`packages/types`, plain TS, no runtime dependency**                                                  | Both apps import the same `Pattern`, `DmcColor`, DTO, etc. definitions so a shape change fails the build on both sides instead of silently drifting.                                                                                                                                                                                                                                                                                                        |
| Color math               | **`packages/color`, framework-free**                                                                   | sRGB↔Lab conversion, CIEDE2000, and quantization are pure math — isolating them lets them be unit-tested exhaustively (this is where correctness matters most: a wrong nearest-thread match ships a wrong shopping list to a paying user) and reused identically by the Nest `imaging` module and any future CLI/script.                                                                                                                                    |
| Lint/format              | **ESLint (`@nx/eslint`) + Prettier, strict TypeScript everywhere**                                     | Nx wires project-aware ESLint (module-boundary rules) out of the box; Prettier removes formatting bikeshedding. `strict: true` in the base `tsconfig` catches null-safety bugs before they reach the canvas renderer, where they're hardest to debug visually.                                                                                                                                                                                              |
| Testing                  | **Jest (unit, both apps + packages), Playwright (e2e)**                                                | Nx's default Jest setup needs no extra wiring versus Karma, runs faster, and is what `packages/types`/`packages/color` unit tests use too — one test runner for non-Angular-specific code. Playwright covers the two cross-cutting flows the spec calls out (draw-and-export, convert-and-save) at the browser level, which is the only level that actually exercises the canvas.                                                                           |
| Local dev / CI           | **Docker Compose (postgres, redis, api, web, optional ai) + GitHub Actions (lint, test, build on PR)** | Compose gives one-command dev per the spec. CI runs Nx's `affected` commands so PRs only rebuild/retest what changed.                                                                                                                                                                                                                                                                                                                                       |

---

## 2. Assumptions (stated, not blocking)

Proceeding with these; flag if any should change:

1. **Auth**: email + password with JWT (access + refresh token), bcrypt hashing. No social login in M0 — not mentioned in the spec, easy to add later behind the same `auth` module.
2. **DMC dataset source**: seeding `packages/color` from Adrian Jongenelen's `CrossStitchCreator` DMC RGB table (454 colors, MIT-style hobby project, the same dataset the well-known `sharlagelfand/dmc` R package is built from) — the most complete open, freely-redistributable DMC hex table found. Cited in `packages/color/src/dmc/README.md` with source URL. Anchor threads are **not** included in M0 (spec says "DMC/Anchor" but only requires "a known open DMC hex table," singular, to start) — flagged as a gap, addable as a second dataset file later.
3. **Diamond "drill" palette** reuses the same DMC color set in M3 (real diamond-painting kits are DMC-numbered) rather than a separate dataset — avoids inventing colors.
4. **No production deploy target chosen yet** (Vercel/Fly/Render/self-host) — Docker Compose + Dockerfiles are deploy-target-agnostic; picking a host is deferred until it's actually needed.
5. **GitHub repo**: public, named `stitchcraft`, created empty by the user; this session does all local git work (init, branches, commits) and pushes once the remote exists.
6. **Branch model**: `main` (always releasable) + `develop` (integration) + short-lived `feature/*` branches merged into `develop` via PR. M0 lands on `feature/m0-foundation` → `develop`; the first PR from `develop` → `main` happens once M0 is verified running.
7. **Node 22 / pnpm** (via Corepack, already bundled with Node 22) — no separate pnpm install needed. Nx 20.x targets Angular 18 and Nest 10, both current as of this workspace's creation.
8. **Package manager for the optional Python service**: `pip` + `requirements.txt` (not Poetry) — keeps `services/ai` approachable without a second Python tooling decision; revisit if the service grows.
9. M0-M3 are done, per the spec's "checkpoint after M0" instruction followed by the user's
   go-ahead to keep going each time (and, from M3 onward, an explicit instruction to proceed
   through all remaining milestones without stopping to ask). M4 (exports) onward follow in this
   same session.
10. **Editor scope cuts, to revisit in a later milestone**: resize clears undo/redo history rather
    than being itself undoable; there's no DMC-search-and-add-to-palette flow inside the editor yet
    (only the freeform color-picker) even though DMC browsing exists as its own page; pan is native
    browser scroll rather than a custom space-drag gesture; devicePixelRatio scaling isn't applied
    to the canvas bitmap; `grid-canvas`'s theme colors are a static JS constant rather than read
    from the CSS custom properties at render time, so the canvas doesn't follow dark mode the way
    the rest of the UI does yet. None of these block the milestone's stated scope.
11. **Converter scope cuts, to revisit in a later milestone**: no crop/rotate/brightness/contrast
    adjustment step (the spec lists these as optional; M2 is the "classic" deterministic pipeline
    per PLAN.md's own M2 description); target sizing is stitch-count only, not physical
    size+fabric-count (a unit-conversion nicety, not new capability - `size-readout`'s math already
    supports the reverse conversion); no lock/swap-specific-DMC-match UI after conversion (the
    result opens in the full editor, where palette entries can be edited, just not swapped
    in-place with grid cells re-pointed at the new entry); the frontend uses polling rather than
    the WS gateway it could subscribe to (the gateway is real and running - wiring a
    socket.io-client subscription instead of polling is a drop-in enhancement, not a rebuild).
12. **Export scope cuts, to revisit in a later milestone**: PDF cells are individual vector+text
    objects with no run-length merging of same-color neighbors, so a large pattern (e.g. 200x200)
    produces a large, slow-to-generate multi-page PDF - fine at typical/demo sizes, worth
    revisiting if large patterns turn out to be common; PDF cell glyphs are always the 1-based
    palette number rather than the pattern's actual symbol (pdfkit's bundled standard fonts don't
    reliably cover the Unicode shape glyphs in `assignSymbols`' extended alphabet), though the
    legend page does spell out each entry's real symbol character; exports regenerate from scratch
    on every request rather than being cached/invalidated against the pattern's last-modified time.
13. **AI service scope cuts, to revisit in a later milestone**: `/upscale` is classical Lanczos
    resampling (Pillow), not a trained super-resolution model - no pretrained weights are bundled
    or downloaded anywhere in this repo, since that would mean either committing a large binary or
    depending on a download at build/run time. Swapping in a real model (e.g. `cv2.dnn_superres`
    with ESRGAN/EDSR weights) only touches the `upscale` function in `services/ai/app/main.py`;
    the route contract and the Nest-side `AiProvider` interface stay the same either way.
    `/background-removal` is real (rembg), but its actual model-download-and-remove path is not
    exercised by the test suite (only its error-handling paths are) - see services/ai/README.md.

---

## 3. Folder tree (M0 state — feature subfolders under `apps/web/src/app/features/*` are stubs until M1+)

```
stitchcraft/
├── apps/
│   ├── web/                          # Angular 18 standalone app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/             # singletons: api client, auth, interceptors, error handling
│   │   │   │   ├── shared/
│   │   │   │   │   ├── ui/           # ui-button, ui-icon-button, ui-modal, ui-toolbar, ...
│   │   │   │   │   ├── canvas/       # grid-canvas + GridRenderingService (M1)
│   │   │   │   │   ├── models/       # FE-only view models
│   │   │   │   │   └── tokens/       # design tokens (SCSS + CSS custom properties)
│   │   │   │   ├── features/
│   │   │   │   │   ├── editor/       # stub route (M1)
│   │   │   │   │   ├── converter/    # stub route (M2)
│   │   │   │   │   ├── projects/     # list/create/open (M0: list + create wired to API)
│   │   │   │   │   ├── pattern-view/ # stub route (M1)
│   │   │   │   │   └── palettes/     # stub route, DMC browse (M0: read-only list)
│   │   │   │   ├── app.routes.ts
│   │   │   │   └── app.ts
│   │   │   ├── styles/                # global SCSS entry, token imports
│   │   │   └── main.ts
│   │   ├── Dockerfile
│   │   └── project.json
│   │
│   └── api/                          # NestJS
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/             # register/login, JWT strategy, guards
│       │   │   ├── users/
│       │   │   ├── projects/
│       │   │   ├── patterns/
│       │   │   ├── palettes/         # seeded DMC read, custom palette CRUD
│       │   │   ├── conversion/       # stub module + BullMQ queue registration (M2 fills in)
│       │   │   ├── imaging/          # stub module (M2)
│       │   │   ├── export/           # stub module (M4)
│       │   │   └── storage/          # StorageAdapter interface + LocalStorageAdapter
│       │   ├── prisma/               # PrismaService, schema.prisma, migrations, seed.ts
│       │   ├── common/               # filters, pipes, decorators, guards shared across modules
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── Dockerfile
│       └── project.json
│
├── services/
│   └── ai/                           # Python FastAPI — placeholder only in M0 (M5 implements)
│       ├── app/main.py               # health check + not-implemented stubs
│       ├── requirements.txt
│       └── Dockerfile
│
├── packages/
│   ├── types/                        # shared DTOs + domain models
│   │   └── src/
│   │       ├── models/                # DmcColor, PaletteEntry, Cell, Pattern, Project, ConversionJob
│   │       └── dto/                    # request/response DTOs mirroring §5 API contract
│   └── color/                        # color math, framework-free
│       └── src/
│           ├── space/                 # srgbToLab, labToSrgb, hexToRgb, rgbToHex
│           ├── difference/            # ciede2000
│           ├── quantize/              # kMeansQuantize, medianCutQuantize
│           ├── match/                 # nearestDmc (CIEDE2000 nearest-neighbour)
│           ├── symbols/               # symbol/glyph assignment for N colors
│           └── dmc/                   # dmc-colors.json (454 entries) + README citing source
│
├── tools/                            # repo-local scripts (e.g. DMC CSV → JSON generator, run once)
├── .github/workflows/ci.yml
├── docker-compose.yml
├── nx.json / pnpm-workspace.yaml / tsconfig.base.json
├── .eslintrc / .prettierrc
├── .husky/
├── README.md
├── CONTRIBUTING.md
├── PLAN.md
└── .env.example
```

---

## 4. Data models (`packages/types`)

```ts
export interface DmcColor {
  code: string; // e.g. "310" or "B5200"
  name: string; // e.g. "Black"
  hex: string; // "#000000"
  rgb: { r: number; g: number; b: number };
  lab: { l: number; a: number; b: number }; // precomputed at build time for fast matching
}

export interface PaletteEntry {
  index: number; // stable index into a Pattern's palette array; referenced by Cell
  color: DmcColor | CustomColor;
  symbol: string; // single glyph/character used in symbol & number render modes
}

export interface CustomColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  label?: string;
}

// Grid storage: sparse-friendly row-run-length encoding. Each row is a list of
// [paletteIndex | null, runLength] pairs. A 200x200 blank grid is ~a few bytes,
// not 40,000 numbers. Decoded to a flat Int16Array (-1 = empty) at load time
// for O(1) cell access in the renderer.
export type EncodedRow = Array<[paletteIndex: number | null, runLength: number]>;

export type PatternType = 'cross_stitch' | 'color_by_number' | 'diamond';

export interface Pattern {
  id: string;
  name: string;
  type: PatternType;
  width: number;
  height: number;
  palette: PaletteEntry[];
  grid: EncodedRow[]; // length === height
  meta: {
    fabricCount?: number; // aida count, cross-stitch only
    drillSizeMm?: number; // diamond only, typically 2.5-2.8
    createdFrom?: 'blank' | 'conversion';
    sourceConversionJobId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  patternIds: string[];
  sourceImageRef?: string; // storage key of the originally uploaded image, if any
  createdAt: string;
  updatedAt: string;
}

export type ConversionJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ConversionJob {
  id: string;
  status: ConversionJobStatus;
  progress: number; // 0-100
  params: ConversionParams;
  resultPatternId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionParams {
  sourceImageRef: string;
  targetType: 'cross_stitch' | 'color_by_number' | 'diamond';
  width: number;
  height: number;
  colorCount: number; // N colors to reduce to
  useAiBackgroundRemoval?: boolean;
  useAiUpscale?: boolean;
}
```

DTOs in `packages/types/src/dto` mirror these 1:1 for create/update payloads (e.g.
`CreatePatternDto`, `UpdatePatternDto`) so validation decorators live with the DTOs on the API
side while the plain interfaces stay dependency-free for the frontend.

---

## 5. API contract (M0 slice implemented; full shape below for later milestones)

Base path `/api`. JSON unless noted. Auth via `Authorization: Bearer <accessToken>`.

| Method | Path                                                      | M0? | Notes                                                                       |
| ------ | --------------------------------------------------------- | --- | --------------------------------------------------------------------------- |
| POST   | `/auth/register`                                          | ✅  | `{ email, password, name }` → `{ user, accessToken, refreshToken }`         |
| POST   | `/auth/login`                                             | ✅  | `{ email, password }` → same shape                                          |
| POST   | `/auth/refresh`                                           | ✅  | `{ refreshToken }` → new token pair                                         |
| GET    | `/users/me`                                               | ✅  | current user profile                                                        |
| GET    | `/projects`                                               | ✅  | list current user's projects                                                |
| POST   | `/projects`                                               | ✅  | `{ name }` → `Project`                                                      |
| GET    | `/projects/:id`                                           | ✅  |                                                                             |
| PATCH  | `/projects/:id`                                           | ✅  | rename etc.                                                                 |
| DELETE | `/projects/:id`                                           | ✅  |                                                                             |
| GET    | `/patterns?projectId=`                                    | ✅  | list a project's patterns (added in M1 for the editor's project view)       |
| GET    | `/patterns/:id`                                           | ✅  |                                                                             |
| POST   | `/patterns`                                               | ✅  | create blank pattern within a project                                       |
| PATCH  | `/patterns/:id`                                           | ✅  | save grid/palette edits                                                     |
| DELETE | `/patterns/:id`                                           | ✅  |                                                                             |
| GET    | `/palettes/dmc`                                           | ✅  | seeded reference data, paginated/filterable by name or code                 |
| GET    | `/palettes`                                               | ✅  | list current user's custom palettes                                         |
| POST   | `/palettes`                                               | ✅  | create custom palette                                                       |
| DELETE | `/palettes/:id`                                           | ✅  | added in M6 for the "My palettes" page                                      |
| POST   | `/conversions`                                            | ✅  | multipart upload + params → `{ jobId }`                                     |
| GET    | `/conversions/:id`                                        | ✅  | job status/progress                                                         |
| WS     | `/ws/conversions` (room per job, `subscribe` → `{jobId}`) | ✅  | progress push; the actual frontend uses polling instead (see M2 scope cuts) |
| POST   | `/exports/:patternId`                                     | ✅  | → `{ pdfUrl, pngUrl, svgUrl, materialsListUrl }`                            |

M0 wires every route above marked ✅ end-to-end (controller → service → Prisma → Postgres),
with the stub modules registered but returning `501 Not Implemented` so the routes exist and are
typed against `packages/types`, but do no real work yet.

---

## 6. Milestones

- **M0 — Foundation** _(done)_: Nx monorepo; `packages/types` + `packages/color` (with
  tested CIEDE2000, quantizer, DMC dataset+matcher); NestJS skeleton + Postgres via Prisma +
  JWT auth + projects/patterns/palettes CRUD; Angular shell + routing + design tokens + core
  `shared/ui` components; Docker Compose; CI (lint+test on PR).
- **M1 — Editor** _(done)_: `grid-canvas` + `GridRenderingService`, paint/erase/drag tools,
  palette panel (`palette-grid`/`palette-swatch`/`color-picker`), render modes
  (x-stitch/block/symbol/number), zoom, undo/redo (grouped per drag stroke), resize, save/load
  via API, `legend` + `size-readout`. Project → "New pattern" → editor flow wired end to end.
- **M2 — Converter (classic)** _(done)_: upload → quantize (k-means) → DMC-match → dedupe → assign
  symbols → grid → open in editor; real `conversion`/`imaging` modules; BullMQ job queue (a
  `WorkerHost` processor does the work off the request thread) with both a WS gateway and
  frontend polling for progress. `AiProvider` seam in place (`NullAiProvider` default) so
  background-removal/upscale flags degrade gracefully with no AI service configured.
- **M3 — Diamond painting mode** _(done)_: a `diamond` render mode (a filled rhombus "gem" per
  cell, distinct from block/x-stitch) in `GridRenderingService`/`grid-canvas`; drill size (mm) is
  settable at pattern creation and drives `size-readout`'s physical-size math; the editor defaults
  to diamond view on first opening a diamond pattern (without resetting a user's chosen view on
  every save); `legend`'s count column reads "Drills" instead of "Stitches" for diamond patterns.
  Drill palette continues to reuse the DMC set (assumption #3) - real diamond-painting drills are
  commonly DMC-numbered. Export remains M4's job, covering all three pattern types.
- **M4 — Exports** _(done)_: `POST /exports/:patternId` generates all four artifacts synchronously
  (small enough grids that a job queue isn't warranted) - a tiled, printable PDF (one page per
  ~36x46-cell tile, row/col rulers, grid guides bold every 10, a legend/materials page), a
  standalone SVG chart, a PNG rasterized from that SVG via `sharp`, and a CSV shopping list sorted
  by how much of each color you'll need. Fixed a real gap along the way: `LocalStorageAdapter`
  wrote files but nothing served them back — `main.ts` now mounts `/api/storage` as a static root
  matching `StorageAdapter.urlFor()`'s URLs. Extracted `contrastTextColor` into `packages/color`
  so the frontend swatch and the server-side chart pick text contrast the same way.
- **M5 — AI service** _(done)_: `services/ai` is a FastAPI microservice with `/background-removal`
  (via `rembg`) and `/upscale` (Lanczos resampling - see assumption #13). `apps/api`'s
  `ImagingModule` now resolves `AI_PROVIDER` to a new `HttpAiProvider` (built on Node's native
  `fetch`, no new HTTP client dependency) when `AI_SERVICE_URL` is set, and `NullAiProvider`
  otherwise - zero config still fully works. This is the one part of the stack actually verified
  by running it in this session: PyPI wasn't throttled the way the npm registry was, so a real
  venv was built, `rembg`/`onnxruntime` installed, `pytest` run, and the service smoke-tested over
  real HTTP (health check + an actual image upload/upscale round-trip with dimensions verified).
- **M6 — Polish** _(done)_: a "My palettes" page (`DELETE /palettes/:id` added to support it) - build
  a named palette from scratch with the color-picker, browse/delete saved ones. Fixed a real,
  previously-shipped bug found in review: the top nav's "Editor" and "Converter" links pointed at
  bare `/editor` and `/converter`, both of which have required a route param (`/editor/:id`,
  `/converter/:projectId`) since M1/M2 - they silently fell through to the wildcard redirect. Added
  tests for three components that had shipped without them (`DmcBrowseComponent`,
  `SignInComponent`, `RegisterComponent`); the auth ones surfaced a second real risk while writing
  them - a bare `{ navigate: jest.fn() }` Router stub breaks any component whose template uses
  `routerLink`, since the directive calls `router.createUrlTree()` internally, not just
  `navigate()`. Wired the optional `ai` service into `docker-compose.yml` behind a Compose profile
  (`docker compose --profile ai up`), off by default since `onnxruntime` makes for a large image
  and the app works fully without it.

M0 is the only milestone built in this turn. Checkpointing here before M1 per the brief.

---

## 7. Verification pass (post-M6)

M0-M6 above were built across a stretch where the npm registry was effectively unreachable
(installs timing out after 17+ minutes), so most of that code had never actually been installed,
compiled, linted, or run. Once registry conditions recovered, a full verification pass was run:
real `pnpm install`, `tsc --noEmit`, ESLint, Jest (unit), Angular/Nest production builds, and
finally Playwright e2e in a real browser against a real dev server. This caught bugs no amount of
code review would have: two quantizer algorithms that silently produced duplicate/straddling
color clusters, an Angular template syntax error, a runtime `NG0600` signal-write error, a
duplicate symbol-alphabet character, tsconfig/ESLint wiring gaps, and two bugs in test code itself
(not the components under test).

Two more were found once Playwright e2e tests were written to satisfy the spec's explicit
"draw a small pattern & export" / "convert an image & save" e2e requirement (`e2e/`,
`playwright.config.ts` — both flows mock the `/api/*` surface via `page.route()` rather than a
live backend, isolating "does the real browser/canvas/Angular app work" from backend
availability; see `e2e/support/mock-api.ts`):

- **Real auth race condition**: `App`'s constructor fired `AuthStore.loadCurrentUser()` as
  fire-and-forget, but `authGuard` reads `isAuthenticated()` synchronously during the router's
  _initial_ navigation. On a fresh page load with a valid stored token (deep link, bookmark, or a
  hard refresh on any protected route), the guard could run before the `/users/me` call resolved
  and incorrectly bounce an already-authenticated user to `/sign-in`. The "convert an image & save"
  e2e test caught this immediately, since it seeds tokens directly (`signInDirectly`) and navigates
  straight to a protected route rather than going through the login form. Fixed by moving
  `loadCurrentUser()` into an `APP_INITIALIZER` (`apps/web/src/app/app.config.ts`), which blocks
  Angular bootstrap — and therefore the router's initial navigation — until auth state resolves.
- **`@angular-builders/jest:run` in-process test runner bug**: `apps/web`'s `test` target ran Jest
  _inside_ the Angular CLI builder process rather than as an independent `jest` process, which
  corrupted Angular's global `TestBed` environment across files the moment more than one spec file
  ran in the same invocation (`Cannot set base providers because it has already been called` on
  every one of the 28 suites). Confirmed as a tooling bug, not a code bug, by running the same
  config directly via the bare `jest` CLI (155/155 tests passed). Fixed by pointing `apps/web`'s
  `test` target at `jest --config apps/web/jest.config.ts` directly — the same pattern `apps/api`
  already used — and dropping the now-unused `@angular-builders/jest` dependency and its
  `angular.json` builder entry.

Both e2e flows pass. Once the app was actually working end to end, `pnpm nx run-many
--target=lint --all` was also run for the first time against a real install and turned up two more
real gaps, both fixed:

- **ESLint's legacy config cascade escaping into `node_modules` via pnpm symlinks**: linting any
  project could try to load a completely unrelated `.eslintrc.js`/`.json` reached through a pnpm
  symlink — once for a third-party package's own stale bundled config (`@nestjs/jwt` shipped one
  referencing an option removed in `eslint-config-prettier` 8.0+, breaking `api:lint`), and once
  for `packages/color`'s _own_ `.eslintrc.json`, whose relative `extends: "../../.eslintrc.json"`
  resolved wrong when ESLint reached it through `apps/web/node_modules/@stitchcraft/color` (the
  pnpm workspace-link symlink) instead of its real path (breaking `web:lint`). Root-caused to each
  project's `.eslintrc.json` un-ignoring everything (`"ignorePatterns": ["!**/*"]`, needed so the
  root config's blanket `["**/*"]` ignore doesn't hide the project's own files) without re-excluding
  `node_modules` afterward. Fixed with `"root": true` plus an explicit
  `"**/node_modules/**"` ignore in all four project `.eslintrc.json` files (`apps/api`, `apps/web`,
  `packages/types`, `packages/color`); `apps/web` also needed `.angular/**` ignored once
  `node_modules` stopped masking it, since its Vite dep-cache is full of pre-bundled, unlintable
  ESM output. A related, narrower gap surfaced alongside it once typed linting actually ran clean:
  neither app's `jest.config.ts` was covered by its own `tsconfig.spec.json`, so
  `@typescript-eslint`'s typed rules couldn't parse it — added `"jest.config.ts"` to the `include`
  list in all four projects' `tsconfig.spec.json` (the same fix already applied to
  `packages/types`/`packages/color` earlier in the verification pass, just not yet noticed for
  `apps/api`/`apps/web`).
- **Two real accessibility bugs**, both never caught before because lint had never actually run
  clean: the converter page wrapped `sc-segmented-toggle` (a custom `role="radiogroup"` widget with
  its own `ariaLabel` input) in a `<label>`, which isn't valid markup for a non-native control — the
  wrapper is now a plain `<div>`. `Modal`'s Escape-to-close `(keydown)` listener sat on a
  non-focusable backdrop `<div>`; since `keydown` only fires on (and bubbles from) whatever element
  currently has focus, Escape would silently do nothing unless focus already happened to be on
  something inside the modal — a real functional bug, not just a lint nitpick. Fixed per the
  standard WAI-ARIA dialog pattern: the backdrop is now `tabindex="-1"` and receives focus in
  `ngAfterViewInit`, with its default focus ring suppressed (it's focused programmatically, not by
  tabbing, so a visible ring would be a visual regression rather than a wayfinding aid).

**Live PostgreSQL connection**, initially not verified for the reason above — resolved once real
credentials were supplied in `.env`. That unblocked the single biggest finding of this whole
verification pass:

- **The compiled API had never actually been runnable, in dev or in Docker.** Two independent bugs,
  both invisible until something actually tried to execute `apps/api`'s build output for the first
  time:
  1. `apps/api/tsconfig.app.json` had no explicit `rootDir`. Because `@stitchcraft/types` and
     `@stitchcraft/color` are imported by path-mapped bare specifiers that resolve to sibling
     packages' `src/`, TypeScript's rootDir inference span the whole repo, so `nest build`'s plain
     `tsc` output landed at `dist/apps/api/apps/api/src/main.js`, not the
     `dist/apps/api/main.js` every tool (nest-cli's launcher, the Dockerfile) assumed.
  2. Even pointed at the right file, it still crashed: plain `tsc` leaves path-mapped imports as
     unresolved bare specifiers (`require('@stitchcraft/color')`) rather than rewriting them, so
     Node fell back to resolving that specifier the normal way — through the pnpm workspace symlink
     in `node_modules/@stitchcraft/color`, straight to that package's **TypeScript source**, which a
     plain Node process can't execute (`ERR_MODULE_NOT_FOUND`).

  Fixed by switching `apps/api`'s build to NestJS's built-in webpack mode
  (`nest-cli.json`'s `"webpack": true`), which traces the real import graph and bundles first-party
  workspace code into one flat file instead of mirroring source directories. That alone wasn't
  enough either: the default webpack config's `webpack-node-externals` treats _any_ package
  resolved through `node_modules` as external, which in a pnpm workspace includes symlinked local
  packages — so `@stitchcraft/color` was still being left as an unbundled bare `require`. A custom
  `apps/api/webpack.config.js` allowlists the `@stitchcraft/*` scope so those specifically get
  bundled while genuine third-party deps (`@nestjs/*`, `bcrypt`, `sharp`, ...) still don't (correctly
  — those need to stay real `node_modules` installs, not bundled, since several have native
  bindings). `ts-loader` was added as the one new dependency this required. `pinned rootDir` stays
  in `tsconfig.app.json` too, now just for deterministic dev-mode (`nest start --watch`) behavior.
  The Dockerfile turned out to already assume the _correct_ final path
  (`apps/api/dist/main.js`) — it was right all along; the build underneath it just never actually
  produced a working file there. (Not verified against real Docker in this pass — no `docker` CLI is
  installed in this environment — but confirmed by literally running the produced
  `apps/api/dist/main.js` with plain `node` against the real database, which is the part Docker
  would otherwise be hiding.)

- **`.env` loading was cwd-dependent and silently wrong.** `apps/api:serve` (`nest start --watch`)
  always runs with `cwd: apps/api`, but `ConfigModule.forRoot()` had no `envFilePath`, so it only
  ever looked for `apps/api/.env` (never existed) — the repo-root `.env` was never actually being
  read by a locally-run API. Fixed by setting `envFilePath: ['.env', '../../.env']`. In the same
  vein, `.env`/`.env.example`'s `STORAGE_LOCAL_DIR=./apps/api/storage` only made sense resolved from
  the repo root, not from the API's actual cwd — fixed to `./storage`.
- **Migration files never existed.** `apps/api/prisma/migrations/` was empty — despite the schema
  being built out since M0, `prisma migrate dev` had never successfully run against a reachable
  database before now. Generated and applied the real initial migration (`20260817101645_init`);
  ran the seed script; then smoke-tested over real HTTP against the live database — register →
  login (JWT) → create project — and confirmed the row actually landed in Postgres via `psql`, not
  just a 2xx response. Along the way, found and cleared several orphaned `prisma migrate dev`
  sessions from earlier stuck attempts that were deadlocked on Postgres's migration advisory lock
  (user-approved before terminating those backend connections).

This is the one part of the stack that had **never been run at all** before this pass — not "run
with bugs," genuinely never executed past `tsc` type-checking. Everything above it in this
document describes code that was reviewed and unit/integration-tested with a mocked/in-memory
Prisma where applicable, but the actual "does `node dist/apps/api/main.js` boot and serve a real
request against a real Postgres" question had no answer until now.
