# Contributing to StitchCraft

## Branching

- `main` — always releasable.
- `develop` — integration branch; feature branches target this.
- `feature/<short-name>` — one branch per unit of work, branched from `develop`,
  merged back via pull request.

## Commits

Use short, imperative commit subjects (`Add DMC nearest-color matcher`, not
`Added` or `Adding`). Keep commits scoped to one logical change.

## Before opening a PR

```bash
pnpm nx affected -t lint test build
```

Only affected projects are checked, so this stays fast as the workspace grows.
CI runs the same command on every PR.

## Workspace conventions

- All new code is TypeScript in `strict` mode. No `any` without a comment
  explaining why it's unavoidable.
- Business/rendering logic belongs in a service (`GridRenderingService`,
  feature `*Store`), not in components — components stay thin
  input/output adapters.
- Shared contracts (domain models, DTOs) live in `packages/types` and are
  imported by both `apps/web` and `apps/api` — never duplicate a shape.
- Color math (space conversion, difference, quantization, matching) lives in
  `packages/color` and stays framework-free so it is trivially unit-testable.
- Respect Nx module boundaries (`pnpm nx graph` to visualize).
- In `apps/web`, follow the five layers in [ARCHITECTURE.md](./ARCHITECTURE.md):
  `domain/` (pure, no Angular), `core/`, `data-access/`, `shared/`,
  `features/`. Lint enforces them: no feature imports another feature, no
  `../` imports (use `@app/...`), and `domain/` stays framework-free.
- Order imports: packages, `@stitchcraft/*`, `@app/*`, then `./local`,
  with a blank line between groups.
- Per-pattern-type rules go in `domain/pattern/pattern-rules.ts`, not inline
  `type === 'diamond'` checks.
- Ask before destructive actions with `ConfirmService`, not `window.confirm`.

## Running things locally

See the root [README](./README.md) for `docker-compose` and per-app dev
commands.
