# StitchCraft — PLAN

Cross-stitch, color-by-number & diamond-painting studio: draw patterns by hand, or convert a
photo into one, then export a printable chart with a materials list.

This document is the source of truth for architecture decisions. It is written before any
feature code and will be kept current as milestones land.

---

## 1. Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **Nx (integrated monorepo, pnpm package manager)** | Nx has first-class generators for both Angular and NestJS in one workspace, a dependency graph that enforces module boundaries (`@nx/enforce-module-boundaries`), affected-only test/lint/build in CI, and a build cache. A bare pnpm workspace would need all of that hand-rolled. |
| Frontend framework | **Angular 18+, standalone components, signals, `@if`/`@for`** | The spec's reference editor prototype is a canvas-driven, stateful single page — Angular's DI + RxJS/signals combo suits a tool with many interacting stateful panels (tools, palette, undo stack, zoom) better than a leaner framework would without extra structure. Standalone components remove NgModule boilerplate; signals give fine-grained reactivity for a canvas that repaints on every cell edit without the overhead of full change detection. |
| Frontend state | **Signal-based `*Store` services per feature** (no NgRx) | Editor state (grid, selected color, tool, undo stack) is local to one feature and doesn't need to be observed app-wide or replayed. A `computed()`-driven store service is less ceremony than NgRx actions/reducers/effects for this. Revisit only if cross-feature state sharing or time-travel debugging becomes a real requirement — not speculative in M0. |
| Rendering | **HTML Canvas behind a `GridRenderingService`, dirty-rect redraw** | Canvas is the only realistic choice for a paintable 200×200 grid at interactive frame rates; the DOM (one element per cell) falls over well before that size. Isolating drawing in a service (not the component) keeps the component a thin input/output adapter, and lets `packages/color`-driven glyph/symbol logic be unit-tested without a browser. |
| Styling | **SCSS + CSS custom properties as design tokens, component-scoped styles, no UI kit** | The component list in the spec (button, swatch, segmented-toggle, grid-canvas...) is small and highly specific to pattern-craft UI (thread swatches, symbol legends) — a general-purpose kit (Material, PrimeNG) would fight the domain more than it'd save. Tokens as CSS custom properties (not just SCSS variables) so runtime theming (e.g. print stylesheet, high-contrast mode) doesn't require a rebuild. |
| Backend | **NestJS (TypeScript)** | One language across the stack; shared types package works without a codegen step. Nest's module system maps directly onto the feature boundaries in the spec (auth, projects, patterns, palettes, conversion, imaging, export, storage), and its DI makes the `StorageAdapter`/`AiProvider` interfaces (local disk vs S3, classic vs AI-backed) trivial to swap via provider tokens. |
| Deterministic image work | **`sharp` + `packages/color` inside a NestJS `imaging` module** | Resize, palette quantization, and DMC matching are pure/deterministic — they don't need a model runtime, so they stay in-process for lower latency and no extra service to run in dev. |
| Optional AI work | **Separate Python FastAPI service (`services/ai`), called over HTTP via an `AiProvider` interface** | Background removal / super-resolution / segmentation are best served by the Python ML ecosystem (rembg, OpenCV, ONNX runtime). Keeping it a separate, optional HTTP service means the Node stack never depends on Python being installed, and `AiProvider` has a `NullAiProvider` fallback so the app is fully functional with zero AI configured — required by the spec, not optional. |
| Persistence | **PostgreSQL via Prisma** | Prisma's schema-first models map cleanly onto the spec's data model, migrations are trackable in git, and its generated client is fully typed — consistent with "everything typed." Postgres (not SQLite) because `ConversionJob` status and pattern grids benefit from JSONB and because production deploys need a real server DB anyway; using it from day one avoids a later migration. |
| Object storage | **`StorageAdapter` interface; local-disk adapter in dev, S3-compatible adapter for prod** | Spec requires source images and generated exports to be stored somewhere pluggable. Local disk means `docker-compose up` needs no cloud credentials to develop. |
| Job queue | **BullMQ + Redis** | Conversions and exports are the two genuinely slow operations (image processing, PDF tiling). BullMQ gives retries, progress events, and a dashboard-friendly job model with minimal code; progress is pushed to the client over a NestJS WebSocket gateway that subscribes to job progress events. |
| Shared types | **`packages/types`, plain TS, no runtime dependency** | Both apps import the same `Pattern`, `DmcColor`, DTO, etc. definitions so a shape change fails the build on both sides instead of silently drifting. |
| Color math | **`packages/color`, framework-free** | sRGB↔Lab conversion, CIEDE2000, and quantization are pure math — isolating them lets them be unit-tested exhaustively (this is where correctness matters most: a wrong nearest-thread match ships a wrong shopping list to a paying user) and reused identically by the Nest `imaging` module and any future CLI/script. |
| Lint/format | **ESLint (`@nx/eslint`) + Prettier, strict TypeScript everywhere** | Nx wires project-aware ESLint (module-boundary rules) out of the box; Prettier removes formatting bikeshedding. `strict: true` in the base `tsconfig` catches null-safety bugs before they reach the canvas renderer, where they're hardest to debug visually. |
| Testing | **Jest (unit, both apps + packages), Playwright (e2e)** | Nx's default Jest setup needs no extra wiring versus Karma, runs faster, and is what `packages/types`/`packages/color` unit tests use too — one test runner for non-Angular-specific code. Playwright covers the two cross-cutting flows the spec calls out (draw-and-export, convert-and-save) at the browser level, which is the only level that actually exercises the canvas. |
| Local dev / CI | **Docker Compose (postgres, redis, api, web, optional ai) + GitHub Actions (lint, test, build on PR)** | Compose gives one-command dev per the spec. CI runs Nx's `affected` commands so PRs only rebuild/retest what changed. |

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
  code: string;        // e.g. "310" or "B5200"
  name: string;         // e.g. "Black"
  hex: string;           // "#000000"
  rgb: { r: number; g: number; b: number };
  lab: { l: number; a: number; b: number }; // precomputed at build time for fast matching
}

export interface PaletteEntry {
  index: number;         // stable index into a Pattern's palette array; referenced by Cell
  color: DmcColor | CustomColor;
  symbol: string;         // single glyph/character used in symbol & number render modes
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
  grid: EncodedRow[];              // length === height
  meta: {
    fabricCount?: number;          // aida count, cross-stitch only
    drillSizeMm?: number;          // diamond only, typically 2.5-2.8
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
  sourceImageRef?: string;         // storage key of the originally uploaded image, if any
  createdAt: string;
  updatedAt: string;
}

export type ConversionJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ConversionJob {
  id: string;
  status: ConversionJobStatus;
  progress: number;                // 0-100
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
  colorCount: number;               // N colors to reduce to
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

| Method | Path | M0? | Notes |
|---|---|---|---|
| POST | `/auth/register` | ✅ | `{ email, password, name }` → `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | ✅ | `{ email, password }` → same shape |
| POST | `/auth/refresh` | ✅ | `{ refreshToken }` → new token pair |
| GET | `/users/me` | ✅ | current user profile |
| GET | `/projects` | ✅ | list current user's projects |
| POST | `/projects` | ✅ | `{ name }` → `Project` |
| GET | `/projects/:id` | ✅ | |
| PATCH | `/projects/:id` | ✅ | rename etc. |
| DELETE | `/projects/:id` | ✅ | |
| GET | `/patterns?projectId=` | ✅ | list a project's patterns (added in M1 for the editor's project view) |
| GET | `/patterns/:id` | ✅ | |
| POST | `/patterns` | ✅ | create blank pattern within a project |
| PATCH | `/patterns/:id` | ✅ | save grid/palette edits |
| DELETE | `/patterns/:id` | ✅ | |
| GET | `/palettes/dmc` | ✅ | seeded reference data, paginated/filterable by name or code |
| GET | `/palettes` | ✅ | list current user's custom palettes |
| POST | `/palettes` | ✅ | create custom palette |
| POST | `/conversions` | ✅ | multipart upload + params → `{ jobId }` |
| GET | `/conversions/:id` | ✅ | job status/progress |
| WS | `/ws/conversions` (room per job, `subscribe` → `{jobId}`) | ✅ | progress push; the actual frontend uses polling instead (see M2 scope cuts) |
| POST | `/exports/:patternId` | stub (M4) | → `{ pdfUrl, pngUrl, svgUrl, materialsListUrl }` |

M0 wires every route above marked ✅ end-to-end (controller → service → Prisma → Postgres),
with the stub modules registered but returning `501 Not Implemented` so the routes exist and are
typed against `packages/types`, but do no real work yet.

---

## 6. Milestones

- **M0 — Foundation** *(done)*: Nx monorepo; `packages/types` + `packages/color` (with
  tested CIEDE2000, quantizer, DMC dataset+matcher); NestJS skeleton + Postgres via Prisma +
  JWT auth + projects/patterns/palettes CRUD; Angular shell + routing + design tokens + core
  `shared/ui` components; Docker Compose; CI (lint+test on PR).
- **M1 — Editor** *(done)*: `grid-canvas` + `GridRenderingService`, paint/erase/drag tools,
  palette panel (`palette-grid`/`palette-swatch`/`color-picker`), render modes
  (x-stitch/block/symbol/number), zoom, undo/redo (grouped per drag stroke), resize, save/load
  via API, `legend` + `size-readout`. Project → "New pattern" → editor flow wired end to end.
- **M2 — Converter (classic)** *(done)*: upload → quantize (k-means) → DMC-match → dedupe → assign
  symbols → grid → open in editor; real `conversion`/`imaging` modules; BullMQ job queue (a
  `WorkerHost` processor does the work off the request thread) with both a WS gateway and
  frontend polling for progress. `AiProvider` seam in place (`NullAiProvider` default) so
  background-removal/upscale flags degrade gracefully with no AI service configured.
- **M3 — Diamond painting mode** *(done)*: a `diamond` render mode (a filled rhombus "gem" per
  cell, distinct from block/x-stitch) in `GridRenderingService`/`grid-canvas`; drill size (mm) is
  settable at pattern creation and drives `size-readout`'s physical-size math; the editor defaults
  to diamond view on first opening a diamond pattern (without resetting a user's chosen view on
  every save); `legend`'s count column reads "Drills" instead of "Stitches" for diamond patterns.
  Drill palette continues to reuse the DMC set (assumption #3) - real diamond-painting drills are
  commonly DMC-numbered. Export remains M4's job, covering all three pattern types.
- **M4 — Exports**: tiled printable PDF chart, legend, floss/drill shopping list, PNG/SVG.
- **M5 — AI service**: Python FastAPI (`services/ai`) with background removal + upscale behind
  `AiProvider`; feature-flagged; `NullAiProvider` remains the default with zero config.
- **M6 — Polish**: projects dashboard, custom palettes UI, fuller test coverage, docs,
  one-command `docker-compose up` dev loop verified end-to-end.

M0 is the only milestone built in this turn. Checkpointing here before M1 per the brief.
