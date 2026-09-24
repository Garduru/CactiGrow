# Multiplayer Foundation L1: Area contracts and automatic Layering

L1 contains only framework-independent contracts and synchronous domain transitions.
It does not connect players, issue credentials, start sockets, instantiate Durable
Objects, access a database, or enable multiplayer in Town.

## Areas and identifiers

`shared/realtime/areas.ts` registers only `town`, coordinate version 1. Its bounds
remain 2200 x 1500; entries remain farm-arrival (1100, 1280), shop-exterior
(650, 560), and marketplace-exterior (1510, 590). The existing Town layout imports
these values without changing art, collision, navigation, or movement behavior.

Layer capacity 32 and Area population limit 128 are provisional configuration,
not evidence of realtime performance. Empty Layers retain metadata for 30 seconds.
Movement configuration records existing speed 245 and proposed maximum 10 updates
per second / 2-unit tolerance; it does not enforce a network rate or speed envelope.

Area, Layer, player, and presence identifiers are distinct branded types. Layer and
presence IDs are opaque UUIDs supplied by the future server adapter; no random ID
generator runs in L1. Identifier constructors validate format, not authorization.
UUID constructors normalize to lowercase; admission transitions and wire guards
require that canonical representation so alternate casing cannot alias an identity.
Layer display numbers are not identities. Additional Areas require registry entries,
not allocator changes. Synthetic Areas exist only in tests.

## Assignment and membership

`assignLayer` is a pure decision over an Area and Layer population snapshots:

1. Enforce the Area population limit.
2. Prefer an eligible, server-authorized recent-Layer affinity.
3. Otherwise prefer the oldest occupied Layer with room.
4. Otherwise reuse the oldest retained empty Layer, or request a new Layer.

Equal creation times break ties by opaque Layer ID. Full or retired Layers cannot
be selected, including through affinity. Members are never moved to consolidate
population. Area limit failure is the typed `AREA_FULL` result.

`presenceState.ts` composes assignment with immutable join/leave/update transitions.
Population derives from membership, not independently writable counters. One player
has at most one presence per Area. Other Areas may contain the same player.

Replacement is a separate **trusted server-only** operation. The future adapter
must establish reconnect authorization before invoking it. Replacement retains the
presence and Layer, allocates a newer generation, resets movement sequence, and
marks movement stopped. It can succeed at full capacity because it adds no member.
All leave/update/replacement events match Area, Layer, player, presence, and generation.
Old-generation events cannot affect the replacement. Fresh joins after leave also
allocate a newer generation. Generation exhaustion fails closed.

Times and IDs are explicit inputs. Times must be nonnegative integer milliseconds
and nondecreasing within a state. The adapter must preserve the generation counter
and time floor when restoring a state; a fresh runtime must not accept callbacks
from a previous runtime incarnation. State snapshots/configuration are readonly
TypeScript values for a trusted owner, not validated deserialization formats.

Last departure starts empty retention. Retirement removes only expired empty
Layers, at the exact deadline. Join prunes expired empty Layers on success. Explicit
retirement supports later alarm-driven cleanup. There are no timers in L1.

**Synchronous domain tests do not establish distributed concurrency safety.** L2
must serialize the complete read/decide/commit operation and test actual runtime
admissions. It must also define recovery validation, alarms, bounded pending
connections, attachment versions, and deployment behavior.

In particular, `assignLayer` reserves no slot. An asynchronous step between its
decision and insertion can allow two requests to select the last available slot.
`joinPresence` combines those steps synchronously, but its returned state must
still be committed by the owner without interleaving: two calls using the same
old snapshot can lose a member and allocate the same generation. Replacement,
leave, movement, and retirement also return snapshots and require the same owner
serialization. Finish asynchronous authorization before reading the current state,
or revalidate against current state inside the serialized transition. L1 supplies
no runtime lock, reservation, or distributed concurrency guarantee.

The Area registry is shared protocol content. Capacity or coordinate overrides in
an owner must stay consistent with the registry used by welcome validation; test
fixtures with custom limits do not establish independently negotiated limits.

## Protocol and admission

Protocol V1 has client hello/move/ping/leave and server
welcome/joined/moved/left/pong/error unions. Welcome combines Area/Layer assignment,
coordinate version, local presence ID, a public snapshot including self, and limits.
Generation is server-issued metadata; client messages cannot supply it. Server
event sequences are per receiving connection; movement sequences are per generation.
After a replacement, clients must replace the old generation's movement baseline.

The default text limits are 1024 UTF-8 bytes inbound and 32768 outbound. Parsers
return typed failures for oversized frames, malformed JSON, unsupported versions,
and invalid messages. Transport code must reject binary frames before invoking
these text parsers. Object validators alone do not enforce frame size.

V1 uses exact field allowlists, including nested public DTOs. Unknown fields are
rejected; future extensions need coordinated validator changes or a negotiated
protocol version. Public presence is constructed explicitly and contains only
presence ID, generation, placeholder label/appearance, position, facing, movement,
and sequence. It excludes internal player IDs and all account/gameplay data.

Movement validation here covers structural validity, finite coordinates, bounds,
and increasing sequence. Collision simulation, elapsed-speed checks, rate limits,
interpolation, and socket backpressure remain future phases. A valid DTO never
authorizes durable gameplay.

The HTTP admission request contains version, registered Area, and approved entry
identifier. Success data contains version, Area, an exact same-origin relative
socket path, opaque ticket, and canonical ISO expiry, inside the existing API
envelope. Shape validation does not establish ticket authenticity or freshness.
No endpoint or ticket generator exists. L3 must derive identity from authentication,
preserve verified expiry, issue/consume tickets, and add scoped reconnect credentials.

## Validation and boundaries

`npm run test:realtime` runs deterministic Node tests without a new framework.
Tests cover capacities, affinity, retirement, immutable transitions, replacement,
stale events, Area/Layer isolation, protocol privacy, UTF-8 sizes, and admission
shapes. Worker/client/E1/Garden regression suites remain unchanged.

No Cloudflare configuration, PostgreSQL schema, authentication implementation,
React provider, Phaser networking, economy, or gameplay authority changes belong
to this phase. The next implementation phase is L2 only after review.
