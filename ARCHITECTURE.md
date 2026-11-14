# StitchCraft architecture

How the code is organised, which way dependencies may point, and why. The
rules marked **enforced** fail `pnpm nx run-many -t lint` when broken.

## The monorepo

```
apps/
  web/        Angular 18 SPA (standalone components, signals)
  api/        NestJS REST API + BullMQ worker, Postgres via Prisma
services/
  ai/         optional FastAPI service (background removal, upscale)
packages/
  types/      shared models, DTOs and pure grid helpers (RLE codec,
              grid validation, cell counting, CSV)
  color/      color math: CIELAB, CIEDE2000, quantizers, DMC dataset and
              matching, symbols, thread/drill estimates
```

`apps/*` may depend on `packages/*`; packages depend only on each other;
apps never import each other. **Enforced** by `@nx/enforce-module-boundaries`.

Anything both the browser and the server must agree on lives in a package,
so it exists exactly once: the grid format and its validation, how many
skeins a stitch count needs, how a CSV is quoted, the 500-cell size limit.

## The web app: five layers

```
apps/web/src/app/
  domain/        pure logic - no Angular, no RxJS, no I/O
    grid/          grid ops, flood fill, shapes, stitch font, regions, row tally
    pattern/       per-type rules, stats, progress codec
    editor/        tools, shortcut resolver, undo history
  core/          app-wide singletons: auth, API client, settings, browser
                 storage and downloads, confirm dialogs, interceptors
  data-access/   one service per API resource, the pattern library loader,
                 the thread stash store
  shared/        reusable UI: the ui kit, the pattern canvas, thumbnails,
                 the DMC thread search
  features/      one folder per routed page
```

Allowed imports (**enforced** with `no-restricted-imports`):

| Layer          | May import                            |
| -------------- | ------------------------------------- |
| `domain/`      | `domain/`, `@stitchcraft/*`           |
| `core/`        | `core/`, `domain/`, packages, Angular |
| `data-access/` | `core/`, `domain/`, packages, Angular |
| `shared/`      | everything except `features/`         |
| `features/*`   | everything except **another** feature |

Imports between folders use the `@app/...` alias; `../` imports are banned
(**enforced**), and `./` is for files in the same folder. Imports are ordered:
packages, `@stitchcraft/*`, `@app/*`, then `./local`.

### Why these layers

- **`domain/` is where the interesting code lives** - flood fill, region
  labelling, stitch-font rendering, run-length intersection - and keeping it
  free of Angular makes it trivial to test and reuse. Templates, the editor
  and the shopping list all draw on it.
- **Features are leaves.** Before this structure, 14 imports went sideways
  between features (templates reached into the editor for its font;
  shopping reached into the stash page). Anything two features need now
  moves down a layer.
- **`data-access/` hides where data comes from.** The thread stash lives in
  browser storage today (see PLAN.md assumption #14); pages only talk to
  `StashStore`, so moving it to the API later touches one class.

## Key design decisions

- **Grids are run-length encoded on the wire and in the database**
  (`EncodedRow[]`), and decoded to one `Int16Array` per row in the editor.
  `-1` is an empty cell.
- **Backstitch lives in `meta.backstitches`** as corner-to-corner lines and
  is drawn on its own overlay canvas above the cells, so line edits and cell
  edits never force each other to repaint.
- **Rows are immutable in the editor.** An edit replaces only the touched
  rows with new arrays. This one rule is what makes three things cheap:
  the canvas repaints only rows whose reference changed, undo snapshots hold
  row references instead of copies, and `RowTally` caches colour counts per
  row object.
- **The store owns all editing rules; components stay thin.** `EditorStore`
  turns pointer input into grid changes and undo steps; `GridCanvas` only
  draws and reports cells; keyboard input goes through the pure
  `resolveShortcut`, and the component just dispatches the resulting action.
- **Undo history is bounded** (200 steps) because some steps are
  whole-pattern snapshots (resize, flip, rotate, palette clean-up).
- **One place per per-type rule.** "What does a diamond pattern default to,
  measure in, buy by?" is answered in `domain/pattern/pattern-rules.ts` and
  `materialColumnLabel` in `packages/color`, never inline.
- **The API validates every grid it stores** (`findGridProblem`): row count,
  row widths, run lengths and palette indices must match the pattern, and
  stitching progress must match its size. Width and height are capped at 500,
  and the JSON body limit is 8 MB to fit the largest valid pattern.

## Testing

- Pure code (`domain/`, `packages/*`) gets thorough unit tests, including
  edge cases (500x500 flood fill, misaligned RLE runs, every template).
- Stores and components are tested through their public API with mocked
  data-access services.
- `e2e/` holds Playwright flows against a mocked API.

Run everything: `pnpm nx run-many -t lint test build`.
