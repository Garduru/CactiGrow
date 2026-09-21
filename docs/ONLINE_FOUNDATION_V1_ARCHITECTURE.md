# CactiGrow Online Foundation V1 architecture

Status: **ARCHITECTURE APPROVED; PHASE A BACKEND SKELETON IMPLEMENTED; NO AUTHENTICATION, DATABASE, GAMEPLAY API, OR DEPLOYMENT**

This document records the repository state audited on 2026-09-20 and the approved persistent-online boundary. Phase A establishes the behavior-free Worker/API boundary described here; see [`ONLINE_FOUNDATION_PHASE_A.md`](ONLINE_FOUNDATION_PHASE_A.md). Phase B establishes request-scoped authentication and a non-durable development identity-to-player mapping; see [`ONLINE_FOUNDATION_PHASE_B.md`](ONLINE_FOUNDATION_PHASE_B.md). Neither phase changes gameplay rules, creates a database, connects a production identity provider, deploys the game, or implements multiplayer.

## 1. Executive summary

CactiGrow is currently a single-browser, in-memory prototype. `GameStateProvider` owns one `useReducer` state tree, `gameStateReducer` applies all gameplay mutations, and `createInitialGameState()` reconstructs a hard-coded player, inventory, and demo Nursery every time the application mounts. There is no browser persistence, API client, service implementation, authentication, database, or backend. `src/services/` contains only `.gitkeep`.

The current React/Phaser split is a good foundation. React owns gameplay state and derives narrow world projections; Phaser receives those projections through `WorldBridge` and emits semantic location intents. Phaser does not own plant inventory, genetics, progression, or property truth. The online migration should preserve that shape:

```text
PostgreSQL authoritative records
          ↑ ↓
TypeScript application commands in a Cloudflare Worker
          ↑ ↓
typed client API + client game store/projections
          ↓
React UI                 Phaser world renderer
```

The intended stack remains appropriate:

- **React, TypeScript, Vite, Phaser 3:** retain.
- **TypeScript Cloudflare Worker:** retain as the stateless HTTP command/query layer.
- **Managed PostgreSQL:** retain for relational ownership, uniqueness, transactional commands, marketplace races, and cross-device state.
- **Cloudflare Hyperdrive or a provider-supported serverless connection path:** evaluate once the PostgreSQL provider and region are chosen. Hyperdrive currently supports PostgreSQL and Worker-side pooled connectivity; do not hard-code the domain layer to Hyperdrive.
- **Durable Objects and WebSockets:** reserve for later Town rooms and other realtime coordination. Do not use them as the primary persistent game database.

The first online milestone should persist Player A independently of Player B, load the same state on desktop and phone, and survive reload/relogin. Realtime presence, Town movement, chat, friends, and Farm visits should remain later phases.

## 2. Current-state architecture findings

### Application state

- `src/App.tsx` mounts one `GameStateProvider` for the application.
- `src/game/GameStateProvider.tsx` uses `useReducer(gameStateReducer, ..., createInitialGameState)` and exposes commands through `GameStateContext`.
- `src/game/gameState.ts` holds the aggregate `GameState`, initialization, validation helpers, reward/discovery helpers, and reducer mutations.
- The reducer has useful domain checks, but it is still browser code. A user can replace actions/state or call equivalent logic with chosen inputs once deployed.
- No state is written to `localStorage`, `sessionStorage`, IndexedDB, a file, or a remote service. A reload creates a fresh player and demo state.
- The only player is hard-coded as `local-player` / `Player`; starting Tokens, seed stacks, and three demo plants are hard-coded.

### Mutation and nondeterminism

`GameStateProvider` supplies browser time to planting, collection, sales, listings, research, upgrades, sampling, extraction, and treatment. Client helpers generate IDs with `crypto.randomUUID()` for specimens, clone lines, bred seeds, listings, samples, extraction attempts/extracts, and treatments. Breeding, tissue quality, extraction, and treatment resolution use client-side `Math.random()` or injected random sources. Tokens are directly incremented or decremented in the reducer.

These are reasonable prototype seams because most model functions already accept `now`, random sources, or ID factories. Online commands can move those inputs to a server transaction without rewriting the core formulas.

### Rendering and world state

- `createFarmWorldProjection()` derives locations and Garden display visuals from property, Lab, owned specimens, and explicit display assignments.
- `WorldBridge` carries serializable projections into Phaser and semantic `ENTER_LOCATION` intents back out.
- Farm/Town layout, art registration, collision, authored spawn points, and camera/movement are client content/presentation.
- Local player position exists inside a Phaser scene and is not persisted.
- Return destinations use transient React Router `location.state`; refreshing an interior route intentionally falls back to a canonical world arrival.
- `?worldEdit` drafts live only in the module-scoped `WorldEditorController`; they are development presentation state and never mutate source or gameplay.

### Social and utility state

- `SocialPanelProvider` stores open surface, active tab, and chat-dock expansion in React `useState`.
- Friends, chat, and mail are empty UI shells. No real messages, relationships, presence, notifications, or mail records exist.
- Farm access preference is the only social-adjacent field in `GameState`; it is explicitly a non-enforced prototype preference.
- Settings is a disabled menu action. There is no settings model or persistence.

### Existing external integration

There is no Base44 SDK, API call, entity type, auth client, currency client, or CactiSwap service in `src`. CactiSwap appears only in branding and a disabled utility-menu entry. This clean absence should be preserved by introducing provider ports before any integration code.

## 3. State ownership and authority matrix

Authority classes used below:

- **A — server authoritative:** the server validates and commits all meaningful changes.
- **B — server persisted, client projected:** durable account state which the client may present or optimistically stage, but the server owns the saved value.
- **C — client-only / presentation:** safe to lose or recreate without changing game truth.
- **D — derived / recomputable:** calculated from authoritative inputs or versioned content.
- **E — future realtime / ephemeral server:** coordinated online session state, separate from durable account records.

| Domain | Current owner | Current storage | Current mutation path | Class | Future owner | Migration risk |
| --- | --- | --- | --- | --- | --- | --- |
| Internal player/account | Hard-coded `GameState.player` | React memory | Recreated by `createInitialGameState()` | A | Identity mapping + PostgreSQL player | High: no auth or account isolation |
| Display name/profile | `GameState.player` | React memory | No current editor | B | Player profile service/table | Low once identity exists |
| Tokens | `GameState.player.tokens` | React memory | NPC sale credits; Lab/property upgrades debit | A, through wallet boundary if shared | CactiSwap wallet or chosen wallet authority; CactiGrow records verified operations | Critical: direct client balance mutation |
| Cultivation/Breeding/Genetics XP | `player.skills` | React memory | Reducer reward helpers | A | Command transaction + skill rows | High: client action/reward replay |
| Normal inventory and seed stacks | `inventory` | React memory | Generic add/remove; planting decrements | A | Inventory repository | High: generic client add path and no durability |
| Unique bred seeds | `bredSeeds` | React memory | Client-created breeding output; planting removes | A | Unique seed + genetic identity records | Critical: client chooses ID/genetics/randomness |
| Nursery slots and occupancy | `nurserySlots` | React memory | Plant/collect reducer actions; property upgrade adds slots | A | Nursery slot/occupancy records | High: client time and duplicate collection risk |
| Growth progress/stage | `calculateNurseryGrowth(plantedAt, now)` | Derived in client | One-second UI clock | D from A inputs | Server timestamps/rules; client display projection | Medium: server must decide collect eligibility |
| Owned plant specimens | `ownedPlants` | React memory | Collection adds; sale removes | A | Plant specimen records | Critical: ownership and transfer truth |
| Garden display assignments | `gardenDisplayAssignments` | React memory | Assign/clear reducer actions | B | Assignment rows constrained by ownership | Medium: explicit six-slot rules must survive migration |
| Garden favorites/tags | `gardenOrganization` | React memory | Reducer actions gated by Garden level | B | Per-player specimen organization rows | Low/medium |
| Breeding eligibility/outcome | Model helpers + reducer | React memory | Client selects parents; browser creates complete seed | A | Server breeding command | Critical: lineage, Shiny, mutation, genetics |
| Quantitative genetics/features/Shiny | Repeated on plants/seeds | React memory | Seed/offspring constructors and treatments | A | Clone-line/genetic identity records | Critical: rare/economic attributes |
| Clone-line registry/counts | `cloneLines` | React memory | Register/unregister helpers | A for identity; D for counts | Clone-line records; counts queried/derived | High: current counts are local observations |
| Marketplace listings | `marketplaceListings` | React memory | List/cancel only; no buying | A | Marketplace service/tables | Critical before player-to-player trade |
| Achievements/event counts | `achievements`, `progressionEvents` | React memory | Evaluated inside reducer rewards | A if rewarded, otherwise B/D | Server event/reward transaction | High: replay and duplicate completion |
| Species discoveries/Journal stats | `speciesDiscoveries`, `journalStats` | React memory | Reducer discovery helpers | B; A where rewards depend on them | Player discovery records | Medium/high |
| Genetics research | `geneticsResearch` | React memory | Observe/analyze/compare and Lab milestone reducers | A | Research records and command handlers | High: unlocks and XP |
| Genetics Lab | `geneticsLab` | React memory | Upgrade/sample/extract/treat reducers | A | Lab, sample, extract, treatment records | Critical: client random outcomes and consumables |
| Property/building progression | `property` | React memory | Upgrade/access reducer actions | A for levels/costs; B for access preference | Property records + authorization policy | High: Token spending and future visitor access |
| Mail | Empty React page | None | None | B | Persistent mail service/table | Low now; privacy/abuse design later |
| Friend relationships | Empty React shell | Component tab only | None | A | Relationship service/table | Low now; authorization later |
| World chat/DM delivery | Empty React shells | Component presentation state | None | E; retained moderation records may be B | Realtime service; optional retention store | Low now; moderation/retention decision later |
| Social overlay state | `SocialPanelProvider` | React memory | Local open/tab/toggle actions | C | Client UI | Low |
| Farm authored layout/content | Source constants/assets | Bundle | Source revisions only | C/D | Versioned game content on client; optional content service later | Low |
| Player Farm projection | React projection from game state | Derived memory | Recomputed from state | D | Client projection from authoritative snapshot | Low; existing boundary is reusable |
| Town authored layout/content | Source constant | Bundle | Source revisions only | C/D | Versioned game content | Low |
| Local world movement/camera | Phaser scenes | Scene memory | Keyboard/pointer/camera logic | C now; E for future shared presence | Client prediction + realtime room coordinator | Medium later |
| Travel/return spawn | React Router `location.state` | History entry | Navigation helpers | C | Client navigation | Low; no durable persistence required |
| Settings | Disabled placeholder | None | None | C for device preferences; B for future account preferences | Client storage and/or profile preferences | Low |
| Plant visual descriptors/composites | Pure selector + asset manifests | Derived/cache memory | Recomputed from plant identity/genetics | D | Client renderer projection | Low; must never become authoritative gameplay |
| Development tools | URL flags, component/module state | Browser memory | DEV-only tools | C | Development tooling only | Low; ensure production gating |

## 4. Current persistence gaps

1. **Nothing authoritative survives remount/reload.** The complete game aggregate is reconstructed in memory.
2. **There is no account boundary.** All sessions are `local-player`; Player A and Player B cannot be represented safely.
3. **No cross-device version exists.** There is no snapshot version, command sequence, ETag, or synchronization protocol.
4. **No durable transaction boundary exists.** Seed consumption, slot occupancy, XP, discoveries, achievements, and collection are only atomically related inside one reducer call.
5. **No economy ledger exists.** Token changes are balance arithmetic with no operation ID, provider reference, reversal state, or audit trail.
6. **Unique identity is browser-generated.** Specimen, clone-line, listing, sample, extract, treatment, and offspring IDs are not globally authoritative.
7. **Time is browser-controlled.** Planting, growth eligibility, sampling cooldowns, listings, upgrades, and completion timestamps trust `Date.now()`.
8. **Random outcomes are browser-controlled.** Genetics, exact 1/4096 Shiny rolls, sample quality, extraction, and treatment resolution can be chosen or replayed.
9. **Prototype fixtures are mixed with initial state.** Starting seed stacks and three relative-time demo Nursery plants must become explicit seed/test fixtures rather than production account initialization.
10. **No migration/hydration seam exists yet.** UI calls context functions synchronously and expects immediate reducer results; asynchronous commands need explicit pending/error/reconciliation state.

## 5. Security and trust-boundary findings

This is a pre-deployment architecture review, not a penetration test. There is no exposed server to attack yet. The following browser-trust assumptions must not cross into an online build:

- A client must not submit a complete bred seed, genetics array, Shiny state, clone-line ID, sample quality, extract potency, or treatment roll as authoritative output.
- A client must not provide authoritative `now`, owner/seller/player IDs, XP, reward amounts, sale proceeds, Token balances, or upgrade costs.
- Generic inventory `add`/`remove` cannot be a public gameplay API. Inventory changes must be effects of named commands, grants, or administrative tools with separate authorization.
- Every object command must scope its lookup through the authenticated internal player ID. A syntactically valid specimen/listing/sample ID must not grant access. This prevents insecure direct object references and ID enumeration from becoming authorization.
- Plant/collect/breed/sell/list/cancel/sample/extract/treat/upgrade commands require server-side eligibility checks against current rows in the same transaction.
- Replayed collect, sell, reward, wallet, marketplace purchase, extraction, and treatment commands must be idempotent.
- Marketplace purchase must lock or conditionally update one active listing and validate current owner, buyer, price, listing version, and payment state. Two buyers cannot both succeed.
- Account linking must require proof from both the existing session and the external identity. Provider subject strings are mappings, never trusted player IDs.
- Future Farm access must be enforced when issuing/joining a Farm session, not inferred from a client preference or hidden UI.
- Public/visitor projections must exclude private genotype, carrier, research, inventory, provenance, and wallet data.
- Production DEV tools and development identity routes must be excluded or server-disabled, not protected only by a client query flag.

## 6. Proposed backend architecture

Use a stateless TypeScript Cloudflare Worker for HTTP commands and queries, with domain code isolated from Worker request objects and provider SDKs:

```text
HTTP route/adapters
  ├─ session authentication → AuthenticatedPlayerIdentity
  ├─ request validation + idempotency key
  └─ application command/query handlers
       ├─ domain rules (shared pure rules where safe)
       ├─ repositories + PostgreSQL transaction/unit of work
       ├─ IdentityProvider port
       ├─ WalletAdapter port
       └─ outbox/audit events
```

Recommended boundaries:

- **Transport:** routing, schema validation, request IDs, status/error mapping, cookies/CORS/CSRF.
- **Application:** command orchestration and transactions. It receives an internal `playerId`; it never trusts one from a payload.
- **Domain:** eligibility, genetic resolution, rewards, invariant checks. Existing pure model functions can migrate here after tests lock their current behavior.
- **Persistence:** repositories using PostgreSQL, with schema constraints as a second line of defense.
- **Integrations:** identity and wallet adapters only. Base44/CactiSwap SDK types stop at these adapters.
- **Projections:** stable client DTOs independent of table rows and external provider responses.

PostgreSQL is a better fit than a key-value or single JSON snapshot because CactiGrow needs enforceable ownership, unique slots, one active listing per specimen, lineage, consumable state transitions, marketplace transactions, and queryable histories. A small cached aggregate snapshot may later speed bootstrap, but it must be a derived cache, not the only source of truth.

Cloudflare Workers remain suitable for the command API. Current Cloudflare documentation supports deploying SPA assets with a Worker and connecting Workers to PostgreSQL through Hyperdrive. Choose the database region/provider before adopting connection-specific behavior, and keep repositories portable. Hyperdrive does not support PostgreSQL advisory locks; use row locks, conditional updates, and unique constraints rather than designing around advisory locks.

## 7. Proposed PostgreSQL domain model

Names are proposals, not migrations. Use server-generated UUIDs (UUIDv7 if the chosen database/tooling supports it cleanly, otherwise random UUIDs) and UTC `timestamptz`. Every mutable aggregate should have an integer `version` or equivalent compare-and-swap field.

### Identity and player profile

| Table | Important fields and constraints |
| --- | --- |
| `players` | `id` PK, `status`, `created_at`, `updated_at`; the internal CactiGrow identity |
| `player_identities` | `id` PK, `player_id` FK, `provider`, `provider_subject`, timestamps; unique (`provider`, `provider_subject`); optionally unique link type per player |
| `player_game_profiles` | `player_id` PK/FK, `display_name`, `state_version`, timestamps; no authoritative shared Token balance |
| `player_skills` | (`player_id`, `skill_id`) PK, nonnegative `xp`, `version`; index by player |

### Inventory, genetic identity, and plants

| Table | Important fields and constraints |
| --- | --- |
| `inventory_stacks` | `id` PK, `player_id` FK, `item_type`, `item_key`, nonnegative `quantity`, `version`; unique (`player_id`, `item_type`, `item_key`) for stackable items |
| `clone_lines` | `id` PK, `species_id`, `origin_type`, `origin_player_id` nullable, `origin_specimen_id` nullable, `established_at`, `genetic_profile_id` unique FK, `version` |
| `genetic_profiles` | `id` PK; explicit `vigor`, `growth_speed`, `size`, `flowering`, `mutation_chance`; hybrid flag and bounded hybrid metadata; immutable after genetic individual establishment except one controlled pre-plant treatment resolution |
| `clone_line_features` | (`clone_line_id`, `feature_id`) PK; genotype JSONB or explicit typed columns, expressed, strength, stability, origin; validate bounded shape in application and database checks |
| `clone_line_variants` | (`clone_line_id`, `variant_id`) PK, origin, established_at; Shiny is stored here and never rerolled in rendering |
| `clone_line_parents` | (`child_clone_line_id`, `parent_order`) PK, parent clone line/specimen/species FKs; exactly two rows for sexual offspring, enforced by command plus checks/validation tooling |
| `unique_seeds` | `id` PK, `owner_player_id` FK, `clone_line_id` unique FK, `status` (`inventory`, `planted`, `consumed`), `created_at`, `version`; unique bred seeds and future individually tracked seeds |
| `plant_specimens` | `id` PK, `owner_player_id` FK, `clone_line_id` FK, `source_seed_id` nullable unique FK, lifecycle/location status, planted/collected/updated timestamps, listed flag or derived active-listing check, `version` |

Normal stackable seeds remain quantities until a command creates an individual genetic identity. Exactly when a normal seed receives that identity and whether any new outcome is rolled is an open gameplay decision; the current rule that stackable normal seeds do not receive planting-time Shiny must not change accidentally.

### Nursery and Garden

| Table | Important fields and constraints |
| --- | --- |
| `nursery_slots` | (`player_id`, `slot_index`) PK, stable slot ID, unlocked flag/version; slot count validated from property level |
| `nursery_occupancies` | (`player_id`, `slot_index`) PK/FK, `specimen_id` unique FK, `planted_at`, growth-rule revision; one specimen in one slot |
| `garden_display_assignments` | (`player_id`, `slot_id`) PK, `specimen_id` FK, assigned_at, version; unique (`player_id`, `specimen_id`); exactly six allowed stable slot IDs |
| `garden_specimen_organization` | (`player_id`, `specimen_id`) PK, favorite, tags bounded as text array or child rows; FK ownership validation in commands |

Growth progress is not stored every second. Store authoritative `planted_at` and the applicable growth-rule/duration inputs, then derive progress. The collect command checks server time and writes the lifecycle transition once.

### Discoveries, progression, research, and Lab

| Table | Important fields and constraints |
| --- | --- |
| `player_species_discoveries` | (`player_id`, `species_id`) PK, first_discovered_at, source, source_ref |
| `player_achievements` | (`player_id`, `achievement_id`) PK, completed_at, rewarded_at nullable; unique completion prevents duplicate rewards |
| `player_event_counters` | (`player_id`, `event_key`) PK, count; keep only counters needed by current rules or analytics |
| `clone_research_records` | (`player_id`, `clone_line_id`) PK, depth, first/last analyzed, version |
| `clone_research_milestones` | (`player_id`, `clone_line_id`, `milestone_id`) PK, completed_at |
| `player_research_discoveries` | (`player_id`, `discovery_id`) PK, completed_at; global idempotent discoveries/comparisons |
| `genetics_labs` | `player_id` PK, tier, installed/upgraded timestamps, version |
| `specimen_sampling_state` | (`player_id`, `specimen_id`) PK, last/next eligible, count, version |
| `tissue_samples` | `id` PK, owner/collector and donor specimen/clone/species FKs, quality/band, initial/remaining uses, status, timestamps, version |
| `extraction_attempts` | `id` PK, owner/sample FKs, target, outcome, attempted_at, idempotency reference |
| `genetic_extracts` | `id` PK, owner, attempt/sample/donor FKs, target, quality, potency, stored/consumed state, consumer seed FK, version |
| `seed_treatments` | `id` PK, owner, seed/extract/provenance FKs, target, applied/resolved data, status, version; unique active treatment per seed under current rule |

### Property, marketplace, economy, and social

| Table | Important fields and constraints |
| --- | --- |
| `player_properties` | `player_id` PK, Farm access preference, version |
| `property_buildings` | (`player_id`, `building_id`) PK, level, installed/upgraded timestamps, version |
| `property_upgrades` | (`player_id`, `upgrade_id`) PK, completed_at, wallet operation FK nullable; unique completion |
| `marketplace_listings` | `id` PK, seller/player and specimen FKs, price, status, timestamps, version; partial unique index for one active listing per specimen; indexes on active/status/created/price/species projection fields |
| `marketplace_trades` | `id` PK, listing, seller, buyer, specimen, price, wallet operations, completed_at; immutable audit record |
| `game_economy_transactions` | `id` PK, player, command/type, signed amount or non-wallet value, related entity, status, idempotency key, timestamps; internal game audit, not a duplicate shared-wallet balance |
| `wallet_operations` | `id` PK, player, provider, kind, amount, status, provider_reference, idempotency key unique, retry/error metadata, timestamps |
| `mail_messages` | `id` PK, sender/recipient, subject/body, sent/read/deleted timestamps; no attachments under current direction |
| `friend_relationships` | canonical ordered player pair PK or relationship ID, requester, status, timestamps/version; unique pair |

Do not create chat/presence tables for Phase 1. If World Chat retention/moderation is approved later, store only the required retained message record. Active connections, movement, interpolation snapshots, and join/leave presence belong to a realtime room service, not PostgreSQL account aggregates.

### Transaction boundaries and indexes

- **Plant normal seed:** lock inventory stack and target slot; decrement quantity; create identity/specimen; occupy slot; update discovery/progression/achievement; increment player state version; commit together.
- **Plant unique seed:** lock seed and slot; resolve pending treatment once with server RNG; transition seed; create specimen/occupancy; update milestones; commit together.
- **Collect:** lock occupancy/specimen; validate server-time maturity; clear slot; transition specimen; reward/update discoveries once.
- **Breed:** lock both owned eligible specimens; validate unlisted/mature/compatible/distinct; generate offspring IDs/genetics/lineage with server RNG; insert unique seed; reward once.
- **NPC sale:** lock specimen/active listing state; calculate value from server content; transition ownership/status; clear Garden assignment; execute wallet operation strategy; record audit.
- **Marketplace purchase:** lock active listing and specimen; reserve/settle wallet operations; transfer owner; close listing; clear seller display/organization as defined; create trade; commit or compensate according to the wallet strategy.
- **Lab operations/upgrades:** lock consumable/sample/extract/building rows and relevant wallet operation; state transitions and rewards happen once.

Indexes should start from observed access paths: all player-owned tables by `player_id`; specimen by owner/status and clone line; Nursery occupancy by player/slot; Garden assignment by player; research by player/clone line; marketplace active listing filters; mail by recipient/sent time; identities by provider/subject. Add indexes from measured queries rather than indexing every field.

## 8. Plant and genetics identity model

The backend must preserve three separate concepts:

1. **Inventory seed identity:** stack quantity for fungible normal seeds, unique row for bred/treated seeds.
2. **Clone-line/genetic identity:** the heritable identity shared by future vegetative clones. This owns species/genetic profile, genotype/features, special variants such as Shiny, and sexual lineage.
3. **Physical specimen identity:** one living plant with owner, location, planted/collected state, sampling cooldown, listing/display relationships, and bounded physical presentation variation.

Server-generated IDs are required for all three unique identities, lineage records, listings, samples, extracts, treatments, commands, and wallet operations. The client may generate a random **idempotency key**, but that key is only retry identity and never becomes a game entity ID.

The current prototype repeats genetics on `BredSeed` and `Plant` and uses a bred seed ID as the planted specimen ID. During migration, preserve lineage and treatment provenance while introducing explicit seed-to-specimen linkage. Do not infer clone identity from matching genetic numbers, appearance, species, owner, or timestamps.

Recommended placement:

- Clone line/genetic profile: quantitative genetics, genotypes, expressed feature state, stability, mutation origin, Shiny, hybrid identity, parent lineage.
- Specimen: physical owner/location/lifecycle, planted and collected timestamps, listing/display state, sampling cooldown references, source seed, clone line.
- Treatment/extraction tables: immutable provenance and resolution. A permitted pre-establishment treatment may update the unique genetic profile exactly once inside the planting transaction; descendants do not inherit the treatment record itself.
- Visual variation: derive deterministic genetic appearance from clone-line ID and bounded physical pose from specimen ID/versioned recipes. Do not store art recipe output as gameplay truth unless future non-derivable cosmetics require it.

This supports future vegetative propagation: create a new specimen referencing the existing clone line and increment/query derived counts. Future grafting can add a separate composition/rootstock-scion model without corrupting clone-line or specimen identity.

## 9. Authentication abstraction

Core gameplay should receive this kind of provider-neutral identity:

```ts
interface AuthenticatedPlayerIdentity {
  playerId: string
  sessionId: string
  provider: string
  providerSubject: string
  issuedAt: string
  expiresAt: string
}

interface IdentityProvider {
  authenticate(request: Request): Promise<AuthenticatedExternalIdentity | null>
}
```

The HTTP authentication adapter verifies the external session, then an identity-mapping service resolves (`provider`, `providerSubject`) to the internal `players.id`. Application commands receive only the internal ID and authorization context. They do not import Base44 types.

Adapters can include:

- `DevelopmentIdentityProvider` for protected non-production environments.
- `CactiSwapIdentityProvider` for the eventual existing-account path.
- `SteamIdentityProvider` for later Steam/Tauri sign-in or account linking.

One internal player may have multiple verified external identities. Linking requires proof of both identities while signed into the same internal player. Desktop and phone sessions resolve to the same internal ID; a friend resolves to a different ID and all repositories scope reads/mutations by that ID.

For browser V1, prefer a secure, HttpOnly, Secure, SameSite session cookie on a same-origin `/api` deployment. If the frontend and API must use different origins, define a strict allowlist, credentials behavior, token storage policy, and CSRF strategy before implementation. Never put provider secrets in Vite environment variables or the built frontend.

## 10. CactiSwap and Base44 integration boundary

Base44/CactiSwap belongs in integration packages only:

```text
core command → IdentityProvider / WalletAdapter port
                       ↓
             CactiSwap adapter package
                       ↓
          Base44 or later ecosystem service
```

Rules:

- PostgreSQL rows use internal CactiGrow player IDs, not Base44 entity IDs.
- Domain types do not import provider user, wallet, or response types.
- Provider payloads are translated and validated at the adapter edge.
- Provider outages surface as typed integration failures; they must not corrupt local game records.
- Replacing Base44 means replacing an adapter and migrating identity mappings/provider references, not rebuilding game tables.
- CactiSwap entry points may deep-link into CactiGrow, but a link is not authentication proof.

No existing code violates this boundary because no integration exists yet.

## 11. Shared Token and wallet boundary

The current `player.tokens` is a mock local number. If Tokens remain shared, CactiGrow must not create a second authoritative balance.

```ts
interface WalletAdapter {
  getBalance(player: WalletSubject): Promise<WalletBalance>
  credit(request: WalletCreditRequest): Promise<WalletOperationResult>
  debit(request: WalletDebitRequest): Promise<WalletOperationResult>
  getOperation(idempotencyKey: string): Promise<WalletOperationResult | null>
}
```

Every operation includes a CactiGrow operation ID/idempotency key, player mapping, amount, reason code, and related game command/entity. CactiGrow stores the operation intent/status/provider reference in `wallet_operations`; it may cache a display balance with `authoritativeAsOf`, but the provider remains authoritative.

The critical open question is whether the eventual wallet offers reservation/commit/reversal semantics and idempotent operation lookup. An external wallet cannot share a PostgreSQL transaction. Economy commands therefore need one of these approved strategies:

1. **Preferred:** wallet reserve → commit CactiGrow transaction → wallet capture, with idempotent recovery/compensation.
2. **If only immediate debit/credit exists:** durable operation state machine/outbox with retries and explicit compensation. The UI reports pending until reconciled.

Never retry a debit/credit with a new key after a timeout. Query the original operation. Never return success for a property upgrade, sale, or marketplace transfer until its required wallet state is durable and recoverable.

If Tokens become CactiGrow-only instead, the same port can use a local PostgreSQL ledger and balance projection without changing core commands.

## 12. Proposed Online Foundation V1 API

Use versioned domain commands under `/api/v1`. Payloads contain intent and stable owned-object references, not outcomes, owner IDs, timestamps, reward values, random rolls, or balances. All mutating requests carry `Idempotency-Key`; concurrency-sensitive commands also carry the last observed account/entity version where useful.

### Bootstrap and reads

| Operation | Returned projection | Notes |
| --- | --- | --- |
| `GET /api/v1/me/bootstrap` | Profile, account state version, skill XP, authoritative/cached wallet display, inventory stacks, unique seeds, Nursery, owned specimen summaries/private details, Garden assignment/organization, discoveries/achievements, research/Lab, property | One authenticated cross-device hydration request; support ETag or `If-None-Match` |
| `GET /api/v1/marketplace` | Paginated public active listing projections | Separate because it is public, filtered, and potentially large |
| `GET /api/v1/mail` | Paginated mailbox projection | Later, not required for first persistence milestone |
| `GET /api/v1/social/...` | Relationships/presence projections | Later, not required for first persistence milestone |

Do not return authored Farm/Town layout or plant art recipes from bootstrap while those remain versioned client content. Do not return hidden genetics in visitor/public projections.

### Authoritative commands

| Command | Request intent | Server validation and transaction | Response | Idempotency |
| --- | --- | --- | --- | --- |
| Plant normal seed | slot ID, stack item key/version | authenticated owner; slot unlocked/empty; quantity; server ID/time; decrement + create/occupy + rewards | changed inventory, slot/specimen, skills/discoveries, account version | Required |
| Plant unique seed | slot ID, seed ID/version | ownership, empty slot, pending treatment; resolve treatment once with server RNG | changed seed/slot/specimen/Lab/research | Required |
| Collect plant | slot ID/occupancy version | owner; occupied; server-time maturity; not already collected | cleared slot, owned specimen, rewards | Required |
| Assign Garden display | named slot ID, specimen ID | owner; allowed slot; specimen owned; clear its prior slot; enforce uniqueness | all changed assignments/version | Idempotent by desired state |
| Clear Garden display | named slot ID | owner; slot validity | changed assignment/version | Idempotent by desired state |
| Breed plants | two specimen IDs | both owned, distinct, mature/eligible, unlisted, same compatible genus; server genetics/Shiny/IDs/time | new unique seed + lineage, skills/discoveries | Required |
| Sell specimen to NPC | specimen ID/version | owned, unsold, unlisted; server price; clear display/organization; wallet workflow | specimen removal/status, assignments, wallet operation/balance projection, skills | Required |
| Create listing | specimen ID/version, asking price | owned, eligible, unlisted, price policy; lock specimen | listing + specimen projection | Required |
| Cancel listing | listing ID/version | seller is authenticated player; active | listing + specimen projection | Required/idempotent terminal state |
| Buy listing | listing ID/version | buyer differs, active; lock listing/specimen; wallet settlement; transfer | trade, buyer/seller projections as authorized | Required; later than first milestone |
| Observe/analyze/compare | specimen ID(s) | ownership, research prerequisites, idempotent milestones | research/skills/achievements changes | Required for rewarded steps |
| Upgrade Lab/property | target tier or upgrade ID/version | prerequisites, current level, authoritative cost, wallet workflow | Lab/property, wallet operation, account version | Required |
| Set Farm access | desired preference | allowed value; owner | property projection | Idempotent by desired state |
| Collect sample | specimen ID/version | ownership, Lab/skill/cooldown; server quality/ID/time | sample, cooldown, research/skills | Required |
| Extract sample | sample ID, target/version | ownership, uses/prerequisites; server outcome/ID/time | sample use, attempt/extract, research | Required |
| Apply treatment | extract ID, unique seed ID/version | ownership, eligibility, no duplicate; consume exactly once | extract + seed treatment + research | Required |

Do not expose generic CRUD for balances, inventory quantities, genetics, rewards, ownership, or lifecycle state.

Use a consistent response envelope:

```ts
type CommandResponse<TChanged> = {
  commandId: string
  accountVersion: number
  changed: TChanged
  notices: readonly ClientNotice[]
}
```

Commands return authoritative changed slices so the client does not refetch the full bootstrap after every click.

## 13. Client state and projection architecture

The current architecture can evolve without making Phaser authoritative, but `GameStateProvider` needs to stop combining transport, command creation, aggregate mutation, and UI convenience methods.

Recommended client layers:

1. **Typed API client:** transport only; session, idempotency headers, errors, DTO decoding.
2. **Client game store:** hydrated account projection, account version, per-command pending/error state, and reconciliation of authoritative command responses.
3. **Domain selectors/projections:** existing helpers such as Farm/Garden/plant visual projections, operating on stable client domain types.
4. **React command hooks:** UI-friendly async operations (`plantSeed`, `collectPlant`) with pending/result handling.
5. **React and Phaser consumers:** both read projections; Phaser continues to emit semantic intents only.

Do not bind UI directly to SQL-shaped or provider-shaped responses. Define API DTOs and map them to client domain models. During migration, retain the reducer behind a repository/command interface or introduce server-command actions incrementally; do not replace every page at once.

Optimistic updates are appropriate only for reversible presentation/preferences such as a Garden display move, and even then they must reconcile with the server. Inventory, breeding outcomes, collection, sale, purchase, rewards, Lab operations, and wallet changes should show pending state and apply the authoritative response.

## 14. Cross-device synchronization strategy

1. Sign-in resolves the external session to one internal player ID.
2. `GET /me/bootstrap` hydrates a complete player projection and `accountVersion`.
3. A command sends an idempotency key and relevant observed version.
4. The server validates current rows, commits, increments versions, and returns changed projections.
5. The client reconciles the response and persists no independent authoritative copy.
6. On window focus, reconnect, explicit refresh, or a `409 stale_state`, the client performs conditional bootstrap using ETag/version.
7. The same account on phone receives the desktop's committed state. A different account is scoped to different rows and cannot query Player A's private state.

For two tabs or devices, server wins. Non-conflicting commands can succeed against independently versioned entities; commands affecting the same slot/specimen/listing return a conflict or domain rejection. The losing client refreshes the relevant projection and explains the new state. Avoid complex offline write merging.

The browser may cache the last successful projection for a faster loading shell, but it must be labeled stale/read-only until session and server state are confirmed. Do not queue economy, ownership, genetics, growth completion, or reward commands while offline.

## 15. Failure, concurrency, and idempotency strategy

### Request lifecycle

- Disable or mark the initiating control pending while a command is in flight.
- Generate one client idempotency key per user intent and reuse it for retries.
- Store the key, request fingerprint, authenticated player, status, and final response server-side for retry-safe commands.
- Reject reuse of the same key with a different payload.
- Return stable domain error codes (`slot_occupied`, `not_mature`, `stale_version`, `wallet_pending`) plus user-safe messages.
- Unknown network result means **retry/query the same operation**, not issue a new one.

### Database concurrency

- Use PostgreSQL row locks or conditional `UPDATE ... WHERE version = ?` for slots, specimens, samples, extracts, buildings, and listings.
- Use unique/partial unique constraints for slot occupancy, Garden specimen assignment, active listing per specimen, achievement/milestone completion, and idempotency keys.
- Keep transactions short; never hold a database lock while waiting indefinitely on an external wallet call.
- Use an outbox/operation state machine for work that must continue after the HTTP request or coordinate with an external provider.

### Reconnect and stale clients

- Retry safe reads automatically with bounded backoff.
- Retry commands only with the original idempotency key.
- On authentication expiry, pause commands and reauthenticate; never reinterpret auth failure as an empty/new account.
- On stale state, retain the user's intent for explanation, refresh the affected projection, and require re-confirmation if price/ownership/cost changed.

## 16. Request-volume strategy

- Hydrate ordinary play with one compact authenticated bootstrap request, not one request per domain or plant.
- Keep public marketplace, mail history, and social lists separately paginated because they grow independently.
- Return authoritative changed slices from each command; do not refetch bootstrap after every action.
- Deduplicate simultaneous bootstrap/focus refreshes and use ETag/account version for unchanged state.
- Derive growth bars locally from authoritative timestamps and a server-time offset. Do not poll once per slot or once per second.
- Do not send player movement to the persistence API. Future movement uses a realtime connection at a bounded tick rate.
- Plant rendering is fully local from the authoritative descriptor inputs and cached assets. It performs zero per-frame network requests and no per-plant API calls during rendering.
- Batch only naturally atomic user intents. Do not create a generic multi-command endpoint that weakens validation or idempotency.
- Observe command counts, bootstrap size, query counts, latency, wallet retries, and database pool pressure before adding caches.

## 17. Development and test account strategy

Create a server-side `DevelopmentIdentityProvider` for local and private-test environments only:

- Local development can map explicit allowlisted handles such as `dominick-a` and `friend-b` to seeded external subjects and separate internal player rows.
- The private test environment should sit behind Cloudflare Access or equivalent allowlisting. A small test-account chooser may exist only after the Access gate and only when a server environment flag enables the development provider.
- The backend, not Vite/client code, selects enabled identity providers. Production configuration must fail closed if a development provider is requested.
- Use separate database instances/schemas and signing secrets for local, test, and production.
- Provide deterministic seed scripts for test identities, never implicit hard-coded data in production account creation.

Test matrix:

1. Account A desktop plants/collects/assigns and receives a new account version.
2. Account A phone signs in and sees the same authoritative state.
3. Account B sees a separate starter state.
4. Account B attempts direct calls with Account A's IDs and receives not-found/forbidden without data leakage.
5. Reload/relogin preserves both accounts.
6. Two Account A tabs race for one slot/seed; exactly one command succeeds.

## 18. Private deployment architecture

Smallest sensible test deployment:

- **Frontend and API:** one Cloudflare Worker deployment serving Vite static assets and same-origin `/api/*`, or static assets plus a separately routed Worker if operationally necessary. A same-origin unit simplifies cookies, CORS, and mobile testing.
- **Access gate:** a Cloudflare Access policy on the test hostname, allowlisting Dominick and invited testers. Treat this as environment access control, not automatically as the permanent in-game identity model.
- **Database:** managed PostgreSQL with automated backups, TLS, a dedicated least-privilege app user, a test-region choice close to the primary audience, and a connection strategy verified with Workers. Hyperdrive is a reasonable default candidate.
- **Secrets:** Cloudflare secret bindings/provider secret store only. Source and Vite `VITE_*` variables contain no database, session, wallet, or provider secrets.
- **Environments:** local, test, and production use separate Worker bindings, database, identity issuer/client, cookie names/domains, wallet configuration, and migrations. Never share test/player data with production.
- **Sessions:** HttpOnly Secure SameSite cookies, short-lived sessions with rotation/revocation, strict origin checks, CSRF protection for cookie-authenticated mutations, and rate limits on sign-in/commands.

Do not deploy until the provider choices, data retention, backup/restore, migration procedure, and minimum observability are approved.

## 19. Future realtime multiplayer boundary

Keep persistent commands on the HTTP/Worker/PostgreSQL path. Add realtime as a separate authenticated transport later:

```text
HTTP API + PostgreSQL             Durable Object room + WebSockets
durable ownership/economy        ephemeral Town presence/movement/chat
             \                    /
              authenticated internal player ID
```

A Durable Object per Town instance is a suitable Cloudflare-native candidate because one object can coordinate a room's WebSockets. It should validate a short-lived room ticket issued by the main API, track join/leave and latest movement snapshots, rate-limit inputs, and broadcast viewer-safe avatar state. Persisted account changes still call the command API. Do not copy the full player aggregate into the room.

Future Farm visits use a separate owner-Farm room or session. The API checks the owner's authoritative access preference/relationship and issues a scoped ticket. The Farm owner/server remains authoritative for access and Farm data. Visitors receive public projections only and cannot invoke owner-only gameplay commands.

World Chat is Town-instance scoped. Direct Messages remain live under current product direction; Mail is the persistent asynchronous channel. Decide moderation, retention, blocking, and report requirements before choosing any chat persistence.

## 20. Migration plan from the current in-memory prototype

1. Freeze current domain behavior with focused server-portable tests for planting, collection, breeding, Shiny, treatment, Garden assignment, sales, upgrades, and rewards.
2. Introduce provider-neutral backend/client contracts and environment boundaries without changing UI behavior.
3. Create internal player identity and PostgreSQL schema/migrations.
4. Seed test accounts explicitly, including current starter inventory; keep demo Nursery fixtures out of production initialization.
5. Implement bootstrap projection and hydrate a new client game store read-only while comparing it with the current state shape.
6. Move commands one vertical slice at a time. Start with normal seed planting and collection because they prove identity, inventory, Nursery, time, transaction, progression, and cross-device persistence.
7. Migrate Garden assignment/organization and property preferences.
8. Migrate breeding/genetics, research/Lab, sales/marketplace, and wallet-sensitive upgrades after server-side randomness/idempotency and wallet strategy are ready.
9. Remove corresponding local reducer write paths only after each server slice passes cross-device and conflict tests.
10. Add realtime presence after persistent state and account isolation are stable.

The client can temporarily use an adapter with `InMemoryGameRepository` and `RemoteGameRepository` implementations, but production builds must not silently fall back to in-memory state after an API/auth failure.

## 21. Risks and open decisions

Approval is needed for these choices before their dependent phases:

1. **PostgreSQL provider and region:** determines connection path, backups, networking, and latency.
2. **First private-test identity:** Cloudflare Access identity, a dedicated OIDC provider, or another test-only provider; CactiSwap integration can follow.
3. **Shared Token decision:** Is Token balance truly shared? What wallet API supports balance, idempotent debit/credit, lookup, reservation/capture, and reversal?
4. **Marketplace settlement:** whether purchases wait synchronously, use pending settlement, or require wallet reservation.
5. **Normal seed individualization:** when server-generated clone-line/specimen truth is created and which outcomes apply, while preserving the current no planting-time Shiny rule until explicitly changed.
6. **Achievement rewards:** which achievements have economic rewards and therefore require stronger ledger semantics.
7. **Starter state:** production starter inventory/property and whether any demo plants exist for test accounts only.
8. **Account linking/recovery:** provider-linking rules, conflicts, unlinking minimums, recovery, bans, deletion, and export.
9. **Chat/DM policy:** retention, moderation, blocking, age/safety requirements, and whether DMs remain strictly online-only.
10. **Mail policy:** retention limits, deletion semantics, abuse controls, and whether attachments remain prohibited.
11. **Offline UX:** whether a last snapshot may be viewed read-only and how stale state is labeled.
12. **Operational baseline:** logging redaction, audit retention, alerts, database restore tests, rate limits, and admin/support access.

## 22. Recommended implementation phases

### Phase A — backend skeleton and environments

**Implementation status: complete.** The repository now has the behavior-free Worker skeleton, generated Cloudflare runtime/binding types, response/error handling, health route, identity and wallet ports, local development commands, and lightweight route tests. No Phase B or C functionality was included.

- **Purpose:** establish a deployable but behavior-free Worker boundary, typed environment config, request IDs/errors, health endpoint, and provider ports.
- **Dependencies:** approve Cloudflare Worker direction and repo layout; no database provider required yet.
- **Major systems:** new Worker package/entrypoint, environment typings, `IdentityProvider` and `WalletAdapter` interfaces, root scripts/CI checks, local/test/production configuration templates with no secrets.
- **Acceptance:** Worker type-checks; `/api/health` reports only non-sensitive build/environment health; production cannot enable development auth accidentally; frontend remains unchanged.
- **Risks:** premature framework/ORM choice and coupling domain code to Worker globals.

### Phase B — authentication and internal player identity

**Implementation status: complete.** The Worker now has a request-scoped authentication helper, explicit non-production Account A/B credentials, provider-neutral internal-player resolution, a protected `/api/me` infrastructure endpoint, and defense-in-depth production rejection. Phase C preserves this boundary and replaces the original temporary mapping implementation with its PostgreSQL repository.

- **Purpose:** resolve every request to an internal CactiGrow player ID and prove Account A/B isolation.
- **Dependencies:** Phase A; choose first test identity method.
- **Major systems:** session middleware, identity provider adapter, player/identity repository, protected test sign-in.
- **Acceptance:** desktop/phone sessions for A map to one internal ID; B maps separately; IDOR tests pass; no Base44 types outside adapter.
- **Risks:** insecure account linking or a development backdoor escaping test.

### Phase C — PostgreSQL schema and migration discipline

**Implementation status: complete for development/private testing.** The repository contains the two-table identity schema, generated Drizzle migration, request-scoped Hyperdrive/`pg` client, PostgreSQL repository/resolver, and opt-in isolated-database integration test. Separate Neon development and test databases, least-privilege development runtime access, a real cache-disabled development Hyperdrive binding, the actual Hyperdrive data path through Cloudflare remote preview, live durable Account A/B resolution across Worker restart, concurrency/constraint checks, and the production development-auth gate are verified; see [`ONLINE_FOUNDATION_PHASE_C.md`](ONLINE_FOUNDATION_PHASE_C.md). Production infrastructure and deployment remain separate future work.

- **Purpose:** establish queryable authoritative records and repeatable migrations.
- **Dependencies:** provider/region choice; Phase B identity keys.
- **Major systems:** migration tool, schema above, repository transaction abstraction, seed fixtures, backup/restore procedure.
- **Acceptance:** clean database can migrate and seed A/B; constraints reject duplicate occupancy/assignment/listing/rewards; rollback/restore is rehearsed for test.
- **Risks:** over-normalizing unstable future features or hiding core ownership in JSONB.

### Phase D — bootstrap and client read projection

- **Purpose:** load the same persisted state on multiple devices without changing gameplay commands yet.
- **Dependencies:** Phases B/C.
- **Major systems:** bootstrap query/DTO, typed API client, client store hydration, loading/auth/error states, mapping to existing selectors and Phaser projections.
- **Acceptance:** A desktop and phone render the same seeded inventory/Nursery/Garden/property; B remains separate; one ordinary bootstrap request; Phaser remains projection-only.
- **Risks:** API DTOs leaking database/provider shapes or an oversized undifferentiated state blob.

### Phase E — authoritative Nursery vertical slice

- **Purpose:** prove remote mutation, server time/IDs, transactions, rewards, idempotency, and synchronization through plant and collect.
- **Dependencies:** Phase D; agreed starter state and growth rule revision.
- **Major systems:** plant/collect commands, inventory and Nursery repositories, specimen/clone-line creation, progression/discovery/achievement effects, command reconciliation UI.
- **Acceptance:** the first-online-milestone scenario works for plant/collect; duplicate requests do not duplicate state; two-tab race has one winner; reload/phone reflects results.
- **Risks:** accidentally changing normal-seed identity/Shiny rules or prototype growth balance.

### Phase F — remaining authoritative gameplay migration

- **Purpose:** move Garden, breeding/genetics, research/Lab, property, sales, and marketplace in bounded slices.
- **Dependencies:** proven Phase E command pattern; wallet strategy before Token-sensitive slices.
- **Major systems:** remaining reducer commands and domain tables, server RNG, lineage, Lab provenance, wallet operations.
- **Acceptance:** no economic/rare outcome depends on browser random/time/IDs; each migrated local write path is removed; behavior remains consistent with current rules.
- **Risks:** broad-bang migration, wallet partial failure, hidden reward duplication.

### Phase G — cross-device, concurrency, and recovery hardening

- **Purpose:** validate real multi-device behavior and operational recovery.
- **Dependencies:** core Phase F slices required for Alpha.
- **Major systems:** versions/ETags, focus/reconnect refresh, stale/conflict UX, observability, backup restore, load/race tests.
- **Acceptance:** A desktop/phone converge; simultaneous slot/listing/lab operations remain correct; restore drill and failure runbooks pass.
- **Risks:** stale optimistic state, excessive refresh traffic, insufficient diagnostics.

### Phase H — private friend testing

- **Purpose:** expose a protected test build to Account A/B on separate networks.
- **Dependencies:** security review, Access policy, test environment, monitoring, backups.
- **Major systems:** Workers static assets/API deployment, managed PostgreSQL, secrets, allowlist, release/rollback.
- **Acceptance:** invited testers can sign in; no production secrets/data; account isolation and request budgets are observed; rollback is documented.
- **Risks:** treating an Access gate as gameplay authorization or exposing development tools.

### Phase I — realtime multiplayer foundation

- **Purpose:** add authenticated Town presence without restructuring persistent state.
- **Dependencies:** stable identity/session, private testing, approved realtime/chat policies.
- **Major systems:** room ticket endpoint, Durable Object/WebSocket room, movement protocol, remote avatar projection, join/leave and rate limits.
- **Acceptance:** authenticated players join one Town instance, see bounded movement updates, and disconnect cleanly; persistent commands remain on the HTTP/PostgreSQL path.
- **Risks:** abuse/moderation, bandwidth/tick rate, room scaling, leaking private profile data.

### Exact next implementation task after Phase C

Phase D may add the authenticated read-only bootstrap projection and typed client boundary without migrating gameplay writes. It must prove the same Account A projection across desktop and phone and continued Account B isolation before any authoritative gameplay command is introduced. Production infrastructure remains unprovisioned and must be isolated from development and automated tests before private deployment.

## Reference links verified for this proposal

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Hyperdrive: PostgreSQL support](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/)
- [Cloudflare Hyperdrive getting started and connection pooling](https://developers.cloudflare.com/hyperdrive/get-started/)
- [Cloudflare Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Access web applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)
