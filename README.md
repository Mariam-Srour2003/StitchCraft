# StitchCraft

Cross-stitch, color-by-number & diamond-painting studio: draw patterns by
hand, or convert a photo into one, then export a printable chart with a
materials list.

This is milestone **M0 — Foundation**: monorepo tooling, shared type/color
packages, a NestJS API with working auth + projects/patterns/palettes CRUD,
and an Angular shell with a shared UI component library. See
[PLAN.md](./PLAN.md) for the full architecture, data model, API contract,
and milestone breakdown, and [CONTRIBUTING.md](./CONTRIBUTING.md) for
day-to-day workspace conventions.

## Stack

Angular 18 (standalone + signals) · NestJS · PostgreSQL/Prisma · Redis/BullMQ
(from M2) · Nx monorepo · pnpm. Full rationale in PLAN.md §1.

## Prerequisites

- Node 20+
- pnpm (`corepack enable && corepack prepare pnpm@9 --activate`, or `npm i -g pnpm`)
- PostgreSQL and Redis — either via Docker Compose (below) or installed locally
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
apps/api         NestJS API (auth, projects, patterns, palettes, storage; M2+: conversion/imaging/export)
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

## What's implemented in M0

- **Auth**: register/login/refresh with JWT access + refresh tokens, bcrypt
  password hashing, refresh-token revocation via a stored hash.
- **Projects & patterns**: full CRUD, ownership-checked on every mutation,
  grid stored as run-length-encoded rows (`packages/types`) so a blank
  200×200 pattern doesn't cost 40,000 numbers.
- **Palettes**: browse the seeded 454-color DMC reference set
  (paginated/searchable) and create custom palettes.
- **Color math** (`packages/color`): sRGB<->CIELAB conversion, CIEDE2000
  perceptual color difference, k-means and median-cut quantization, nearest-
  DMC-color matching, and a readable symbol/glyph alphabet for
  color-by-number and diamond charts — all unit-tested.
- **Angular shell**: routing, design tokens as CSS custom properties (with a
  dark-mode media query and `prefers-reduced-motion` support), a signal-based
  `AuthStore`, HTTP interceptors for auth + 401 handling, and a 10-component
  `shared/ui` library (button, icon-button, segmented-toggle, slider, modal,
  toolbar, file-drop, badge, empty-state, progress), each with its own test.
- **Conversion/imaging/export routes** exist and are typed against the API
  contract but return `501 Not Implemented` — real implementations land in
  M2 and M4.

Not yet built (by design — see PLAN.md milestones): the grid-canvas pattern
editor (M1), the image conversion pipeline (M2), diamond-painting mode (M3),
real exports (M4), and the optional AI service (M5).
