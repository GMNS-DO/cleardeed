# ClearDeed

Property due-diligence tool for Odisha.

## Setup

```bash
npx pnpm install
npx pnpm --filter @cleardeed/web dev
```

## Structure

- `apps/web/` — Next.js app
- `packages/` — Shared packages (schema, orchestrator, fetchers)
- `workers/` — Playwright worker
- `infra/` — Docker, migrations
- `scripts/` — Probe and seed scripts
- `docs/` — Decisions, source docs, sessions