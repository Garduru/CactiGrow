# L3: authenticated multiplayer admission

L3 connects the existing authenticated player pipeline to the L2 Area Durable Object.
There is no new login provider, gameplay authority, React connection manager or Phaser
integration. Main staging/production configuration remains disabled for realtime.

## HTTP and WebSocket flow

`POST /api/v1/realtime/admission` accepts JSON `{ v: 1, areaId: "town",
entryPointId: "farm-arrival" }`, optionally with `reconnectToken`. It uses the existing
`authenticateRequest`, verified identity adapter and internal player resolver.
The existing staging initialization boundary remains unchanged. Browser player IDs,
Layer IDs and replacement keys are rejected. Only registered Areas/entries are allowed.

Both public routes require the exact configured Origin, matching the request origin.
HTTPS is required except loopback development/test. Query parameters are rejected.
No cross-origin access is enabled. Production always returns 404, even if a binding
or enable flag is supplied. Other environments need `CACTIGROW_REALTIME_ENABLED=true`,
`CACTIGROW_REALTIME_ORIGIN` and an `AREA_PRESENCE` binding.

The Worker constructs a fresh private binding request to `/tickets`; client headers
are never forwarded. The Area owner generates independent 256-bit random ticket and
reconnect credentials. Its SQLite KV holds only SHA-256 hashes, verified scope and
expiration. Tickets expire after at most 30 seconds, bounded by authorization expiry.
At most one pending ticket exists per player/Area; newer issuance invalidates the old
pending ticket. There are at most 128 pending tickets and 128 reconnect records per
Area. Expired records are pruned by alarms; inactive reconnect records can be evicted
under storage pressure. Credentials are never logged or stored in socket attachments.

Successful issuance uses the existing no-store API envelope. Its data is defined by
`shared/api/realtimeCredentialsV1.ts`, an explicit extension of L1's admission DTO:

```ts
{
  v: 1, areaId, socketPath, ticket, expiresAt,
  reconnectToken, authorizationExpiresAt
}
```

L4 should validate this response, construct a same-origin WebSocket URL from
`socketPath`, and switch `http/https` to `ws/wss`. Use
`realtimeSocketProtocols(ticket)` as the WebSocket constructor's protocols argument.
It offers `cactigrow.v1` and `cactigrow.ticket.<ticket>`; the server selects only
`cactigrow.v1`. Credentials never appear in URLs. Do not log subprotocol request
headers, API credential bodies, or tokens in client telemetry. Keep credentials
private to the connection owner; do not share them across tabs or players.

`GET /api/v1/realtime/areas/town` requires that upgrade/protocol shape and passes only
the parsed ticket and configured Area to private `/redeem`. It does not accept L2's
trusted-scope header from browsers. A ticket is a short-lived bearer credential;
the application session was verified at issuance. Upgrade needs no custom browser
Authorization header and performs no database identity lookup.

The Area object hashes the presented credential, then enters its event gate. It
checks expiry/scope and deletes the pending record before synchronously calling L2
admission. No await separates consumption and membership commitment. Concurrent use
has one winner; unsuccessful admission also burns the ticket. Persisted consumption
survives idle reconstruction. Storage failures reset the object through the gate.
L1/L2 still select the Layer, enforce 32/128 provisional capacities, and send the
unchanged V1 welcome before deltas. No new Layer allocator exists.

## Reconnect and expiry

An active presence cannot be replaced by ordinary admission, even from another
authenticated tab for the same account. Reconnect requires both a freshly verified
application session for that player and the current reconnect token. The owner binds
the ticket to the exact current membership generation. Successful redemption rotates
the token and uses L2 replacement; old movement, close events and reconnect tokens
cannot affect the replacement. If the presence has already left, a valid reconnect
credential can obtain a fresh join instead. Reconnect credentials alone cannot log in.

L4 should retain the current and newly issued reconnect credentials through an
ambiguous upgrade outcome: the new token becomes active on successful server admission,
not HTTP ticket issuance. On welcome, keep the new token and discard the old one.
Do not blindly retry the same ticket. An interrupted replacement whose generation
has already disappeared needs a new admission request. Without the valid current
token, an active session cannot be forcibly taken over; wait for departure/expiry.

Connection authorization ends at the earlier of verified provider session expiry
and 15 minutes after issuance. Staging requires a verified expiry. Existing explicit
development/test identities lack sessions, so they receive the bounded 15-minute
authorization. Expired messages and sends are rejected by L2 independently of delayed
physical socket closure. Reauthenticate and reconnect before authorization expires.
Application logout or upstream revocation does not currently push revocation to DOs;
the bounded grant remains usable until its expiry. L4 should send leave/close on logout.
No permanent multiplayer session or refresh-token system is introduced.

Failures use the existing API envelope: 400 malformed input/upgrade, 401 missing or
invalid authentication/ticket, 403 Origin/reconnect denial, 404 disabled/unknown route
or Area, and 409 duplicate/capacity/stale admission. Browser WebSocket failures usually
hide the HTTP body: request fresh credentials through HTTP to recover a typed error.

## Configuration and local verification

`server/index.ts` exports `AreaPresence`; main `wrangler.jsonc` has no realtime binding
or enable flag. `wrangler.realtime.integration.local.jsonc` alone wires the real Worker,
SQLite class export, local origin and enable flag. Its Hyperdrive ID is deliberately
a placeholder; provide an existing isolated local database connection through
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Do not put credentials in
the config. Build assets, then run:

```text
npx wrangler dev --local --config wrangler.realtime.integration.local.jsonc --port 8787
```

Use `http://localhost:8787` and the existing explicit Account A/B development identity
header. This config must not be deployed. L3 performs no database provisioning,
migration or remote infrastructure changes. Existing identity resolution retains its
normal database behavior; movement/ticket consumption do not access PostgreSQL.

`npm run test:realtime:admission` runs contract checks and actual local Worker/DO tests.
The in-memory test bundle uses the real Access JWT verifier with generated signing
keys and an isolated player resolver; it substitutes no production auth bypass.
It covers signed/forged/expired identity, malformed scope, Origin and production gates,
ticket supersession/expiry/replay/concurrent use, wrong coordinator, Layer assignment,
reconnect rotation/ownership, authorization expiry and actual idle reconstruction.
Live PostgreSQL identity resolution and Cloudflare Access front-door behavior are
not exercised by this isolated suite.

Before a separately authorized staging rollout: configure only the staging binding,
SQLite export, enable flag and exact HTTPS origin; verify Access forwards upgrades
and subprotocols; exercise two real accounts/browsers, expiry, reconnect ambiguity,
slow readers, sustained load and deployment recovery. L2's observed local close-event
delay remains a staging acceptance item. No production readiness or deployment is
claimed. React/Phaser integration remains L4/L5/L6.

Platform coordination follows the installed APIs and Cloudflare's
[event-gate documentation](https://developers.cloudflare.com/durable-objects/api/state/)
and [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).
