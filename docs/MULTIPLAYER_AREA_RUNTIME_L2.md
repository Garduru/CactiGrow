# Multiplayer Foundation L2: internal Area runtime

L2 implements an internal, generic Cloudflare Durable Object adapter around L1.
It does not make authenticated multiplayer available to browsers. The application
Worker (`server/index.ts`), API router, environment bindings and main Wrangler
configuration are unchanged. There is no public admission or WebSocket endpoint.

## Ownership and admission

`AreaPresence.ts` owns one `AreaCoordinator` per configured Area. The server helper
`getAreaCoordinator` resolves validated registry IDs through
`namespace.idFromName('area:v1:' + areaId)`. The object independently checks that
its ID matches the requested configured Area. Town remains the sole registry entry.
Additional Areas require shared content/configuration, not allocator changes.

`admitToArea(namespace, scope)` is the future L3 integration seam. Scope contains
an authenticated internal player ID, configured Area, approved entry point,
authorization expiry in milliseconds, and optionally verified affinity or the
exact membership key authorized for replacement. It is a server-only capability
input; a structurally valid UUID or membership key is not authorization.

The helper constructs a fresh binding-only GET upgrade request. Its internal
`X-CactiGrow-Trusted-Scope` header is transport metadata, **not authentication**.
Never proxy a browser Request or its headers to the Durable Object. The DO's
`fetch` accepts only that private transport; it is not publicly routed. A workerd
test established that a WebSocket Response cannot be serialized through RPC, so
upgrades use the supported binding `fetch` mechanism instead.

L3 must authenticate, resolve internal identity, verify ticket/reconnect authority,
propagate verified expiry, validate Origin and approved entry/Area, then call this
helper. L2 neither issues nor consumes tickets. Stream `hello` messages are rejected
because an accepted stream already has server-established ownership.

## Atomicity and L1 reuse

Every event enters `blockConcurrencyWhile`, including initial recovery. The core
transition is synchronous: read current state, invoke L1 `joinPresence` or
`replaceAuthorizedConnection`, accept/attach the socket, assign the resulting
state and socket ownership, and synchronously persist the ownership checkpoint.
No network call or await separates assignment from commitment. Only alarm
scheduling yields afterward, while the event gate remains closed.

The core reuses L1 assignment, capacity, movement sequence/bounds checks,
generation advancement, departure, retirement, and public projection functions.
There is no parallel Layer allocator. Its provisional configuration remains
32 players/Layer, 128/Area and 30-second empty-Layer retention. Concurrent local
admission tests prove the invariants at these limits, not production throughput.

SQLite-backed DO synchronous KV stores one bounded, versioned checkpoint under
`area-presence-v1`: Area/content version, logical Layer metadata, ownership keys,
next generation and monotonic time floor. This is local Durable Object coordination
storage, not a Neon table or PostgreSQL migration. Position is not in the checkpoint.
Storage failures propagate through the event gate and reset the object rather
than continuing with uncertain ownership. Cloudflare storage output gates protect
outgoing traffic until pending storage writes are confirmed.

## Socket lifecycle and recovery

Sockets use `ctx.acceptWebSocket`, `ctx.getWebSockets`, versioned attachments, and
the DO message/close/error handlers. Each attachment stores the accepted L1 member
(including position/sequence), authorization expiry, last valid activity, outbound
event sequence, rate-window counters, output-byte budget, and invalid-message count.
It contains an internal player ID needed for ownership, but no JWT, ticket, cookie,
email, external identity subject, or private gameplay record. Public projections
still explicitly omit internal ownership IDs. The attachment fits within 2 KiB.

The constructor reconstructs connections before delivering events. It validates
the checkpoint, content version, canonical identities, timestamps, capacity,
ownership uniqueness, attachment shape, movement, authorization and liveness.
Only an open socket matching an exact checkpoint ownership key is recovered.
Ambiguous duplicate sockets are all rejected, rather than choosing a winner.
Corrupt, expired, closed, orphaned or superseded sockets are closed/quarantined.
Surviving peers receive removal events for checkpoint members that cannot recover.
A corrupt checkpoint closes connections and disables admission; it is not silently
reset or used to invent membership. Operational recovery then requires a separately
reviewed intervention. Recovery does not deserialize arbitrary state into L1.

The checkpoint fences attachments left behind by a failed/partial admission,
replacement, or departure. Replacement preserves presence/Layer and consumes no
additional capacity. It advances generation, removes old socket ownership, closes
the old socket, sends peers an old-generation `left` followed by a new-generation
`joined`, and gives the replacement its welcome first. Late old movement/close/error
events cannot affect the replacement. All cleanup is idempotent.

Disconnected members are removed immediately when an event or send failure reveals
the disconnect. Alarms enforce authorization expiry, 60-second inactivity and
empty-Layer retirement even without client traffic. No intervals run. Each event
awaits scheduling the next deadline under the event gate. This conservative storage
overhead must be measured before a separately tested scheduling optimization.
Wall-clock rollback is clamped to the persisted state floor.

## Protocol and bounded transport

L1 protocol V1 is unchanged. Welcome precedes deltas to a new socket. Joined,
moved and left are broadcast only within the member's Layer; movement excludes
the sender. Identity is derived solely from current socket ownership.

Incoming text is capped at 1024 UTF-8 bytes. Binary/oversized frames close the
connection immediately. Malformed JSON, unsupported versions, unexpected identity
fields, invalid transitions, non-finite/out-of-bounds coordinates and stale sequence
numbers are rejected. Three invalid messages close a connection. A fixed one-second
window allows at most 30 messages and the Area's configured 10 movement messages;
excess closes the connection. Window counters survive hibernation. Valid ping/move
refresh liveness; ping receives protocol pong. Heartbeat guidance is 20 seconds.

There are no application send queues or retries. Every outgoing frame is capped
at 32 KiB; each receiver has a conservative 64 KiB/second output budget. Closed
sockets, send failures or exhausted budgets trigger cleanup. Accepted plus closing
platform sockets are capped at twice the Area population limit. The installed
server WebSocket API exposes no reliable bufferedAmount measurement: these bounds
limit offered traffic but do not prove a hard bound on platform/network buffers.
Slow-reader/backpressure and sustained full-capacity traffic require staging tests.

L2 is not comprehensive movement anti-cheat. Speed, collision, interpolation,
prediction/corrections and actual Town sampling remain L6 work. No React, Phaser,
gameplay, currency, Marketplace, chat, Base44 or CactiSwap integration is added.

Structured diagnostics report initialization, admission/rejection with Layer,
population changes, closure, protocol violations and recovery failures. They omit
player IDs and raw message bodies, and do not log every accepted movement.

## Tooling and local configuration

Verified installed versions: Wrangler 4.135.0, Miniflare 5.20260918.0-alpha,
workerd 1.20260918.1, esbuild 0.28.1. Node's existing test runner bundles the
isolated runtime tests using the tools already supplied by Wrangler; no dependency
or lockfile changes are needed. The test uses Miniflare 5's worker config/manifest
and declarative SQLite export schema, not the old Miniflare constructor format.

`wrangler.realtime.local.jsonc` is an isolated local-only configuration. It declares
the binding and `exports.AreaPresence` with `storage: sqlite`; the installed
Wrangler schema supports this declarative lifecycle mechanism without a legacy
`migrations` array. Its `server/realtime/worker.ts` entrypoint returns 404 for every
HTTP request. Synthetic identity injection lives only in the in-memory test bundle.
Neither this config nor the test bridge is referenced by deployment scripts.
No config can itself prevent an operator explicitly deploying it: do not deploy it.

L3/eventual staging will require an explicitly approved application class export,
binding and declarative SQLite export in the intended environment, plus authenticated
admission/upgrade routing and runtime tests. Production must remain inert until
separately authorized. No remote resource has been provisioned by L2.

## Evidence and remaining acceptance

`npm run test:realtime` preserves all 45 L1 tests.
`npm run test:realtime:runtime` covers deterministic owner transitions/faults and
actual local workerd admissions, concurrent capacity, ordered welcomes, peer events,
Layer isolation, replacements, malformed/binary/oversized frames, close cleanup,
authorization alarms and idle hibernation. Hibernation is verified by a changed
constructor instance ID with the same live socket, position, sequence and ownership.
Controlled-clock reconstruction tests cover corrupt attachments/checkpoints,
duplicate owners, stale generations, expiration, rate budgets and Layer retirement.
The bundled runtime dependency graph is checked to exclude gameplay/database/UI code.
Worker tests assert realtime routes remain 404 even with spoofed internal headers.

The local expiry test observes eventual socket closure without intervening client
traffic. Close notification was intermittent at a 10-second test deadline; measured
successful runs took approximately 2 or 12 seconds for a 2-second authorization.
Direct platform closure in a diagnostic test showed the same delay. The test allows
40 seconds, and does not establish prompt close delivery. Deadline checks still fence
expired messages independently of close notification. Actual Cloudflare close latency
and alarm scheduling must be verified in a separately authorized staging test.

This is local runtime evidence. Deployment restarts, regional infrastructure failures,
network partitions, real clients/slow receivers and production load are untested.
Attachments are hibernation metadata, not a promise of recovery across every crash
or deployment. Unsafe recovery closes connections and requires later authenticated
readmission. No public multiplayer acceptance is claimed before L3 and later phases.

API references checked against installed types/schema:
[hibernation and event gates](https://developers.cloudflare.com/durable-objects/api/state/),
[SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[declarative exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).
