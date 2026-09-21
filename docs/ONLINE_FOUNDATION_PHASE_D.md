# CactiGrow Online Foundation V1 Phase D

Status: **IMPLEMENTED AND VALIDATED LOCALLY; NOT DEPLOYED**

Phase D adds the first authenticated, read-only application projection and typed browser boundary. It proves the shape needed for one external identity to resolve to one durable internal CactiGrow player across independent clients while different identities remain isolated. It does not migrate gameplay state or gameplay writes.

## Locked contract

The canonical application bootstrap endpoint is:

```text
GET /api/v1/me/bootstrap
```

An authenticated request returns the existing safe response envelope with this exact data shape:

```json
{
  "ok": true,
  "data": {
    "projectionVersion": 1,
    "player": {
      "playerId": "<internal CactiGrow UUID>",
      "createdAt": "<ISO-8601 timestamp>"
    }
  },
  "meta": {
    "requestId": "<request-specific ID>"
  }
}
```

`playerId` is the durable internal CactiGrow identity. `createdAt` comes from the persisted `players` row. The endpoint never accepts an internal player ID from the client. Missing or invalid authentication returns the existing structured `401 UNAUTHENTICATED` response.

The projection deliberately excludes external provider names and subjects, database details, Hyperdrive details, profiles, currencies, inventory, plants, Nursery, Garden, genetics, progression, marketplace data, and starter data. `/api/me` remains an unversioned Phase C diagnostic and is not the client application contract.

## Server trust boundary

The request flow is:

```text
Worker route
  -> existing provider-neutral authentication
  -> durable external-identity-to-player resolution
  -> PlayerBootstrapService
  -> PlayerBootstrapRepository
  -> PostgreSQL player read
  -> PlayerBootstrapV1 DTO
```

The read repository returns a small persistence record to the service. The service creates the transport DTO; no Drizzle model or PostgreSQL row crosses the API boundary. The shared contract contains transport types and runtime validation only and has no database dependency.

Each API request owns one lazy `RequestDatabaseContext`. The API handler creates it before routing and always awaits its idempotent `dispose()` in a `finally` block. The context creates at most one connected `pg.Client`, memoizes one Drizzle database facade, and returns that same facade to identity resolution, bootstrap projection, and any future repositories participating in the request. If no database-backed work occurs, no connection is opened. Disposal calls `Client.end()` after successful responses, authentication failures that acquired the database, and unexpected exceptions; cleanup failure is reported through the request's safe error reporter without exposing connection details or replacing an already constructed response.

The context is never global and is never reused across requests. Future projections and command handlers should obtain repositories from this request boundary. Drizzle transactions can run on the same request database, with the application command handler retaining transaction ownership; React, shared DTOs, and domain models remain unaware of connection management.

## Typed client boundary

`CactiGrowApiClient` owns base-URL handling, credential headers, request execution, response-envelope decoding, runtime projection validation, typed errors, and request-ID propagation. React does not call `fetch` directly.

`PlayerBootstrapProvider` exposes a state separate from `GameStateProvider`:

- `loading`
- `authenticated`
- `unauthenticated`
- `error`

Bootstrap failure does not replace, initialize, hydrate, or mutate the existing in-memory gameplay state. The current reducer remains the gameplay prototype authority during Phase D.

The browser defaults to same-origin API requests and includes credentials for a future cookie-based provider. Vite proxies local `/api` requests to the separately running Worker on `127.0.0.1:8787`; an explicitly configured non-secret `VITE_CACTIGROW_API_BASE_URL` can override the base origin when needed. Desktop and phone use the same client contract.

## Development authentication

Development identity remains an explicit test mechanism. In a Vite development build, `?developmentIdentity=account-a` or `?developmentIdentity=account-b` selects the corresponding allowed development credential. Missing and unknown values emit no credential. The adapter emits no development header when `import.meta.env.DEV` is false, and the Worker independently refuses to construct development authentication in the production environment.

The client never chooses or submits the internal CactiGrow player UUID. This mechanism is not a frontend login system and will be replaced by a real provider adapter in a later approved phase.

## Persistence and isolation guarantees

The isolated PostgreSQL integration test starts from an empty test database, applies the committed Phase C migration, and verifies:

- repeated Account A identity resolution returns the same player UUID;
- two independent Account A bootstrap requests return equivalent durable projection data even though their request IDs differ;
- `createdAt` matches the stored player record;
- Account B receives a different player UUID;
- invalid and missing credentials are rejected.

Worker tests additionally verify that authentication and bootstrap share one database context, separate requests receive distinct contexts, lazy acquisition happens once, Drizzle is reused, `Client.end()` is invoked once, and cleanup runs on success, authentication failure after acquisition, and route exceptions.

Automated database tests require `CACTIGROW_DATABASE_TESTS=1` and a `TEST_DATABASE_URL` whose database name contains `test`. They must never target the persistent development database or a future production database.

## Future expansion

Future server-backed gameplay data can be added through new versioned projections and application services behind this boundary. React and Phaser should consume stable DTOs and client projections without learning PostgreSQL schemas, Hyperdrive configuration, or CactiSwap identity details. Any gameplay migration must be separately designed around authoritative commands, validation, idempotency, transaction boundaries, and reconciliation.

## Explicit non-goals

Phase D adds no gameplay writes, gameplay hydration, gameplay schema, database migration, inventory or plant persistence, Nursery or Garden persistence, genetics, progression, Tokens, marketplace persistence, real CactiSwap/Base44 integration, multiplayer, production provisioning, deployment, account switcher, profile fields, or starter state.
