# Online Foundation V1 — Phase A

Status: **IMPLEMENTED — BEHAVIOR-FREE BACKEND SKELETON**

Phase A establishes the permanent backend dependency boundary without connecting authentication, a database, a wallet provider, gameplay state, realtime systems, or deployment.

## Backend structure

```text
server/
  index.ts                         Cloudflare Worker entrypoint
  env.ts                           typed and runtime-validated safe bindings
  tsconfig.json                    isolated Worker type-check configuration
  worker-configuration.d.ts        generated local Cloudflare runtime/binding types
  api/
    errors.ts                      public API error codes/statuses
    response.ts                    JSON success/error envelopes and headers
    router.ts                      native Request router and health route
    handler.ts                     request ID and centralized error boundary
    handler.test.ts                lightweight route/error tests
  identity/
    IdentityProvider.ts            provider-neutral identity port
  wallet/
    WalletAdapter.ts               provider-neutral shared-currency port

wrangler.jsonc                     Worker source of truth and environments
```

Browser/game code remains under `src/` and does not import the backend. The Worker does not import browser/game state.

## Worker entrypoint and routing

`server/index.ts` exports a standard module Worker handler. It delegates every request to `handleApiRequest`, which creates a server request ID, invokes the small native router, converts known `ApiError` values into public responses, and converts unexpected exceptions into a generic internal error without returning implementation details.

Implemented route:

```text
GET /api/health
```

Success response:

```json
{
  "ok": true,
  "data": {
    "service": "cactigrow-api",
    "environment": "development",
    "version": "0.0.0"
  },
  "meta": {
    "requestId": "server-generated-uuid"
  }
}
```

Unknown routes return a structured `404 NOT_FOUND`. Other methods on `/api/health` return `405 METHOD_NOT_ALLOWED`. The Phase A Worker is API-only, so non-API paths also receive the structured 404. Frontend asset serving is intentionally not configured.

## API response and error convention

Successful responses use:

```ts
{ ok: true, data: T, meta: { requestId: string } }
```

Errors use:

```ts
{
  ok: false,
  error: { code: ApiErrorCode, message: string },
  meta: { requestId: string }
}
```

Phase A defines these transport-level codes:

| Code | Status | Intended use |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | malformed client input |
| `UNAUTHENTICATED` | 401 | no valid authenticated session |
| `FORBIDDEN` | 403 | authenticated but not authorized |
| `NOT_FOUND` | 404 | route or scoped resource absent |
| `METHOD_NOT_ALLOWED` | 405 | known path with unsupported method |
| `CONFLICT` | 409 | stale version or domain-state conflict |
| `INTERNAL_ERROR` | 500 | unexpected failure with no internal detail exposed |

All responses are JSON, use `Cache-Control: no-store`, set `X-Content-Type-Options: nosniff`, and return `X-Request-Id`. Future gameplay errors should extend the convention deliberately rather than inventing unrelated envelopes.

## Environment bindings

`wrangler.jsonc` is the configuration source of truth. It currently declares only safe non-secret text bindings:

- `CACTIGROW_ENVIRONMENT`: `development`, `test`, or `production`
- `CACTIGROW_VERSION`: a safe build/version identifier

Development is the top-level local configuration. Named `test` and `production` environments repeat their bindings because Wrangler bindings are environment-specific. `server/env.ts` narrows and validates the values before they are exposed by health output.

Cloudflare runtime and binding declarations are generated locally from the configured compatibility date with `wrangler types`. The generated declaration is ignored because Wrangler's current output contains generator-owned formatting that fails this repository's whitespace check; `build`, `typecheck:worker`, and `check:worker` regenerate it from `wrangler.jsonc`, while `worker:types:check` verifies the resulting file. Database, Hyperdrive, identity-provider, wallet-provider, Durable Object, and secret bindings are intentionally absent.

## Identity boundary

`IdentityProvider` accepts provider-neutral request credentials and returns a verified external provider/subject mapping or `null`. It exposes no Base44, CactiSwap, Steam, or Cloudflare Access type.

Phase B now supplies the separate `AuthenticatedPlayerContext` and provider-neutral player-resolution boundary documented in [`ONLINE_FOUNDATION_PHASE_B.md`](ONLINE_FOUNDATION_PHASE_B.md). Phase A itself provides no provider implementation or login route.

## Wallet boundary

`WalletAdapter` defines the minimum provider-neutral contract for:

- authoritative balance reads
- idempotent debit requests
- credit requests where supported
- lookup of an earlier operation by idempotency key
- successful, pending, rejected, unavailable, unsupported, and unknown outcomes
- provider operation references without provider-specific response types

The contract does not define reservation/capture/reversal behavior because the future CactiSwap wallet capabilities are not known. No adapter is implemented, and the current frontend Token prototype is untouched.

## Local development

Use two terminals so ordinary frontend development remains unchanged.

Terminal 1 — existing Vite frontend:

```powershell
npm run dev
```

Terminal 2 — local Worker on `http://127.0.0.1:8787`:

```powershell
npm run dev:worker
```

Exercise health independently:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

Useful checks:

```powershell
npm run worker:types
npm run worker:types:check
npm run typecheck:worker
npm run test:worker
npm run check:worker
```

`check:worker` verifies generated types, type-checks the server, runs route tests, and performs a local Wrangler dry-run bundle. It does not deploy.

To preview the safe test binding locally:

```powershell
npm run dev:worker -- --env test
```

## Intentionally deferred

Phase A contains none of the following:

- PostgreSQL, migrations, repositories, database drivers, or Hyperdrive
- authentication/session behavior or identity SDKs
- Development, CactiSwap, Steam, or Cloudflare Access provider implementations
- Base44 SDK or API calls
- wallet provider calls or Token mutations
- gameplay endpoints, bootstrap, persistence, or client state migration
- frontend API coupling, loading/auth screens, or health UI
- WebSockets, Durable Objects, presence, chat, or multiplayer
- static frontend hosting or deployment configuration

## Dependency

The only new dependency is the development dependency `wrangler`. It runs the local Cloudflare Worker runtime, generates compatibility-date-specific runtime/binding types, validates configuration, and creates dry-run bundles. Native Worker APIs provide routing/responses, and Node's built-in test runner covers Phase A behavior; no API or test framework was added.

## Next phase

Phase B authentication and non-durable internal-player resolution are now implemented. Phase C should add PostgreSQL schema and migration discipline, durable player/external-identity mappings behind the existing resolver boundary, explicit test fixtures, and recovery procedures after the provider, region, connection, and migration choices are approved.
