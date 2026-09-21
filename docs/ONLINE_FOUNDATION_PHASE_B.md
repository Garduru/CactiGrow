# Online Foundation V1 — Phase B

## Status and scope

Phase B establishes authenticated request handling and the internal-player identity boundary without adding durable persistence. It is independently testable through HTTP and remains isolated under `server/`.

Phase B does not provide production authentication. It does not add sessions, cookies, frontend login, PostgreSQL, Base44/CactiSwap, Steam, gameplay APIs, persistence, realtime systems, or deployment.

## Authentication flow

```text
HTTP request
  -> authentication helper
  -> configured IdentityProvider
  -> verified external identity { provider, subject }
  -> PlayerIdentityResolver
  -> internal CactiGrow playerId
  -> request-scoped AuthenticatedPlayerContext
  -> protected API handler
```

The three identity layers remain distinct:

1. **External identity** is a verified provider and provider subject. It is not a gameplay ownership key.
2. **Internal player identity** is CactiGrow's stable `playerId`. Future gameplay and database ownership use this value.
3. **Authenticated request context** combines the resolved player, safe external identity metadata, and request ID for one request. It never contains raw credentials.

Public handlers remain possible. `GET /api/health` does not invoke authentication.

## DevelopmentIdentityProvider

`DevelopmentIdentityProvider` exists only for `development` and `test`. It accepts exactly two allowlisted, stable development subjects:

- `account-a`
- `account-b`

The explicit development-only credential is:

```http
X-CactiGrow-Development-Identity: account-a
```

There is no default account. Missing, unknown, or ambiguous header values return the same `401 UNAUTHENTICATED` response. The provider does not inspect a client-supplied `playerId`, and raw credentials are not logged or returned.

## Production safety gate

Production fails closed in two places:

1. Authentication bootstrap selects no development authentication dependencies when `CACTIGROW_ENVIRONMENT=production`.
2. `DevelopmentIdentityProvider` refuses construction for production. The provider-neutral PostgreSQL resolver added in Phase C is never reached without a verified identity.

A development credential therefore cannot authenticate in production. There is no query parameter, fallback identity, or magic production value.

## PlayerIdentityResolver

`PlayerIdentityResolver` is a provider-neutral replacement boundary:

```text
VerifiedExternalIdentity -> ResolvedPlayerIdentity { playerId }
```

Phase B originally used a temporary `DevelopmentPlayerIdentityResolver` with an explicit in-code mapping:

| External identity | Temporary internal player ID |
| --- | --- |
| `development/account-a` | `00000000-0000-4000-8000-00000000000a` |
| `development/account-b` | `00000000-0000-4000-8000-00000000000b` |

Those IDs were deterministic fixtures distinct from provider subjects. Phase C removes that active fixed mapping and supplies a PostgreSQL-backed resolver while preserving the interface; see [`ONLINE_FOUNDATION_PHASE_C.md`](ONLINE_FOUNDATION_PHASE_C.md). PostgreSQL now generates internal IDs on first durable resolution after external provisioning and migration.

Device identity is not player identity. Later, desktop, phone, and Steam clients can resolve to the same internal player when their verified external identities are mapped or linked to that player.

## AuthenticatedPlayerContext

Protected handlers receive:

- internal `playerId`
- request `requestId`
- verified provider and subject metadata

They do not receive the development header, authorization value, cookie value, or any client-provided internal ID. Authentication is derived separately for every request; no mutable current-player state is stored in Worker globals.

## Development identity endpoint

```http
GET /api/me
```

The endpoint is an infrastructure check, not a gameplay profile. Its successful payload contains only:

```json
{
  "ok": true,
  "data": {
    "playerId": "00000000-0000-4000-8000-00000000000a",
    "identityProvider": "development"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Missing or invalid credentials receive the standard structured `401 UNAUTHENTICATED` response.

## Local verification

Start the frontend and Worker in separate PowerShell terminals:

```powershell
npm run dev
npm run dev:worker
```

Health remains public:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

Missing credential:

```powershell
try { Invoke-RestMethod http://127.0.0.1:8787/api/me } catch { $_.Exception.Response.StatusCode.value__ }
```

Account A:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/me -Headers @{ 'X-CactiGrow-Development-Identity' = 'account-a' }
```

Account B:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/me -Headers @{ 'X-CactiGrow-Development-Identity' = 'account-b' }
```

Production safety can be exercised locally in another terminal:

```powershell
npm exec wrangler dev -- --env production --config wrangler.jsonc
try { Invoke-RestMethod http://127.0.0.1:8787/api/me -Headers @{ 'X-CactiGrow-Development-Identity' = 'account-a' } } catch { $_.Exception.Response.StatusCode.value__ }
```

The production-mode request must return 401.

Automated Worker verification remains:

```powershell
npm run check:worker
```

## Future adapters

A future `CactiSwapIdentityProvider` can validate CactiSwap credentials and return the same `{ provider, subject }` external identity shape. The resolver then maps that identity to a CactiGrow player. No gameplay handler needs Base44 or CactiSwap types.

A future `SteamIdentityProvider` can do the same for a Steam subject. Account linking may later map multiple external identities to one internal player, but linking rules are intentionally deferred.

## Deferred work and next phase

Frontend login, persistent browser sessions, cookies, account linking, provider SDKs, CactiSwap, Steam, gameplay endpoints, and state migration remain deferred.

Phase C is complete for development/private testing. Durable identity is live-verified with isolated Neon development/test databases and the development Hyperdrive binding. See [`ONLINE_FOUNDATION_PHASE_C.md`](ONLINE_FOUNDATION_PHASE_C.md).
