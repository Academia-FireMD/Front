# API types — generated from Server's OpenAPI spec

`schema.d.ts` is the single source of truth for request/response shapes between
`Front` and `Server`. It is checked in so typecheck passes without running
codegen first.

## Regenerate

Two paths:

**From a running Server (typical dev):**

```bash
# terminal 1
cd ../Server && pnpm start:dev

# terminal 2
cd ../Front && pnpm generate:api:from-live
```

**From a static spec file (no Server running):**

```bash
cd ../Server && pnpm generate:openapi   # writes Server/openapi.json
cd ../Front && pnpm generate:api         # reads ../Server/openapi.json
```

## Workflow

Whoever changes a DTO, controller, or response shape in `Server` must
regenerate `schema.d.ts` in `Front` in the same PR. CI should flag drift by
regenerating and diffing.

## Usage

```ts
import type { paths, components } from './schema';

type LoginResponse = paths['/auth/login']['post']['responses']['201']['content']['application/json'];
type Usuario = components['schemas']['Usuario'];
```

Prefer the generated types over hand-written interfaces in
`src/app/shared/models/` — those remain only until fully migrated.
