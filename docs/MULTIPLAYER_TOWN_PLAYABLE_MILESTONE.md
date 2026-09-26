# Playable multiplayer Town milestone

The combined L4/L5/L6 client consumes the existing L1 protocol and L3 admission on
top of L2. Town is the only connected scene. Layer assignment and identity remain
server-owned. Production realtime remains disabled; no infrastructure is changed.

## Lifecycle and presentation

`useTownPresence` owns one `AreaConnection` for the Town route/entry point, gated by
authenticated bootstrap state. Status changes do not recreate Phaser. A deferred
start cancels React Strict Mode's immediate setup/cleanup cycle before admission;
repeated starts are idempotent. Route exit or identity changes abort admission,
cancel timers, send leave when possible, close the socket and clear remote state.
Scene shutdown/destruction also removes its subscription, avatars and frame hook.

Admission uses the existing authenticated API client and validated shared DTOs.
The same-origin socket uses L3's ticket subprotocol upgrade followed by welcome;
there is no additional stream hello (L2 rejects it). Tickets/reconnect tokens stay
in memory, never in URLs, logs or browser storage. In development only, realtime
retains the explicitly selected Account A/B credential across route navigation.
Existing gameplay API credential behavior is unchanged.

Welcome builds the remote snapshot, excluding self. Joined/moved/left deltas use
presence IDs, generations and sequences; duplicate/stale updates do not duplicate
avatars. Event gaps force reconnect. Only the authorized connection's Layer is
displayed. The remote renderer uses the existing simple body/head proportions,
a green body and the server's public label, with no physics or private profile data.

Phaser samples actual local position after update, preserving speed, collision,
tap/keyboard movement and immediate local control. Changed position/facing/movement
sends at most once per 110 ms (about 9 Hz, below the 10 Hz limit), including the
final stopped sample. Idle movement is silent; heartbeats remain. No movement HTTP,
database writes, persistent positions or client-selected Layer exist. Remote avatars
interpolate to each target over 110 ms, then hold there until another packet.
There is no extrapolation, prediction, rollback or authoritative collision checking.

Unexpected loss clears remotes immediately and retries after 1, 3 and 8 seconds.
Only 60 seconds of stable connection replenishes that retry budget. Attempts have
a 10-second admission/welcome deadline; buffering is bounded. Rotating reconnect
credentials retain the previous candidate until welcome to handle ambiguous upgrades.
Old callbacks are fenced by a connection epoch. Fresh welcome replaces the snapshot.
Authentication/contract failures stop; authorization expiry also stops (at most
15 minutes under L3). Re-enter Town to retry; there is no automatic grant renewal.
Concise status appears in Town, while local play remains available on failure.

## Local two-account playtest

Use the existing L3 local integration configuration and an already provisioned,
isolated development database. Set
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in the terminal using
your existing approved local connection; do not put credentials in tracked files.
This milestone provisions no database. Normal authenticated bootstrap/identity
resolution retains its existing database behavior; ephemeral presence never uses it.

1. From the repository root, run `npm run build:multiplayer:local`.
2. Run `npx wrangler dev --local --config wrangler.realtime.integration.local.jsonc --port 8787`.
3. In browser profile A, open `http://localhost:8787/town?developmentIdentity=account-a`.
4. In a separate browser profile/private session B, open `http://localhost:8787/town?developmentIdentity=account-b`.
5. Wait for **Connected** in both. Move apart from the shared arrival point. Each
   should see one green remote Grower; mutual visibility confirms the same Layer.
6. Move A with WASD/arrows or click/tap, and confirm B sees the movement and stop.
   Repeat moving B while observing A. Local collisions and speed should feel unchanged.
7. Navigate A out of Town or close A's tab. B's remote avatar should disappear.
8. Re-enter A's Town URL and confirm one remote returns in each view. Separately,
   briefly interrupt A's network and restore it within the retry window: expect
   Reconnecting, then Connected and a fresh snapshot without duplicates.
9. Leave/re-enter Town through the game navigation repeatedly. Check that presence
   disappears on departure, restores once, and that no hidden Town socket remains.
10. Leave the network unavailable through the bounded attempts: local play should
    continue with Multiplayer unavailable. Restore it and re-enter Town to retry.

Use exactly `localhost:8787`, not a different hostname, port, Vite proxy or production
build: L3 checks same-origin admission and upgrade. Account A/B is the existing
development-only identity provider, not a new public authentication bypass. Refresh
with the explicit identity URL; reconnect credentials are intentionally lost on full
reload. A still-live old session can reject a fresh admission until cleanup completes.
Abrupt network loss can take the server's stale timeout (60 seconds plus scheduling)
to remove presence from peers; clean leave is immediate when transport delivers it.

## Evidence and remaining acceptance

`npm run test:multiplayer:client` covers admission, controlled Strict Mode-style
lifecycle, snapshot/deltas, stale callbacks, movement limits, cleanup, expiry,
backpressure and interpolation. Its two-client local workerd integration uses the
real router, existing development identity provider and AreaPresence, with an
isolated in-memory player resolver; it checks same-Layer admission, bidirectional
movement, reconnect generation changes and departure. It does not exercise a real
browser, Phaser rendering, PostgreSQL identity resolution or the Access front door.

The implementation run passed 8 new client/integration tests, 45 L1, 17 L2, 7 L3,
32 Worker, 22 API client, 6 E1 and 10 Garden tests, TypeScript, ESLint, production
build and Worker type freshness. Browser visual acceptance remains manual because
no browser was available to the automation tool. Capacity values are provisional;
these tests do not establish sustained-load or production readiness.

Before separately authorized staging work: configure the staging-only DO binding,
SQLite export, enable flag and exact HTTPS origin; verify Access forwards upgrades
and subprotocols. Exercise two real authenticated browsers, route/Strict Mode
cleanup, mobile rendering, expiry, reconnect ambiguity, background-tab throttling,
slow readers, sustained load and deployment recovery. Staging remains disabled in
the existing main configuration. No deploy, remote Cloudflare or Neon change is
part of this milestone; chat, other Areas and gameplay/economy systems are excluded.
