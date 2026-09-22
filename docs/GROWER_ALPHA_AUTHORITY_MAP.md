# Grower Alpha online authority map

This map is the implementation checklist for the consolidated Grower Alpha migration. Protected staging must never mix server-owned durable state with the legacy reducer.

## A. Server authoritative already

- Authenticated external identity to durable internal player UUID.
- Grower Alpha initialization marker and one-time starter package.
- Commodity seed stacks; unique bred seeds.
- Clone lines, quantitative genetic profiles, variants, Shiny identity, specimens, Nursery occupancy, growth timestamps, collection, breeding, lineage, and lifecycle versions.
- E1/E2 command idempotency, ownership checks, transactions, concurrency control, timestamps, and server randomness.

## B. Local/legacy and required for online Grower Alpha

- Cultivation, Breeding, and Genetics XP; levels remain derived from the static OSRS curve.
- Alpha Token balance and established Token mutations.
- Authoritative gameplay-event ledger/counters used for XP and achievements.
- Garden display assignments, favorites, and tags.
- Species/Shiny discoveries, achievement completion, Genetics research records and discovery milestones.
- Genetics Lab tier, samples, extraction attempts/extracts, sampling cooldowns, and seed treatments where existing rules are complete.
- Property building levels, completed upgrades, and Farm access preference.
- NPC specimen sale using the established species/genetics formula.
- Marketplace listing creation and cancellation using the established asking-price bounds.

The migration must replace staging reads and mutations for these domains; there are no client/server dual-writes.

## C. Static content or client-only UI

- Species, feature, XP threshold, reward, achievement, building-upgrade, Lab-tier, and visual recipe definitions.
- Menus, dialogs, selected tabs/specimens, filters, sort order, form drafts, notices, current clock ticks, responsive state, camera/zoom, animation, and Phaser presentation.
- Development World Editor drafts and static world geometry/assets.
- Local settings until account synchronization is explicitly designed.

## D. Future/unimplemented or blocked by missing design

- Shop purchasing: no stocked catalog or established prices exist.
- Production/shared CactiSwap Token wallet integration.
- Adventure, Forestry, Fishing, quests, tutorial objectives/content, character slots/modes, realtime multiplayer, and production identity.
- Marketplace buying, ownership transfer, Token settlement, public discovery, fees, moderation, and history. The prototype labels buying "coming later" and establishes no purchase/settlement behavior, so the migration must not invent it.

## Migration batches

1. Core projection and event foundation: all skill XP, Alpha Tokens, gameplay event records, discoveries, and achievements; hook existing plant commands atomically.
2. Garden and specimen economy: display assignments, favorites, tags, NPC sale, and listing lifecycle.
3. Research and property: Genetics research, Lab/sample/extraction/treatment state, building upgrades, and Farm access.
4. Client cutover: one typed Grower projection and typed commands; legacy `GameState` remains isolated development-only and is not mounted as staging authority.
5. Complete isolated PostgreSQL loop and account-isolation verification, then one additive staging rollout.

Every batch uses additive schema, existing internal player/specimen IDs, authenticated ownership validation, idempotency keys, and authoritative projections. Database rows are never exposed directly as API contracts.
