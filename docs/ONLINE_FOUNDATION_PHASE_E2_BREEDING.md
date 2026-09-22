# Online Foundation Phase E2: unique bred seeds

Status: implementation passed isolated database verification and was deployed to protected `dev.cactigrow.com` as staging Worker version `93434e96-a623-497d-b3c0-980cae25eb60`. Migration `0002_smooth_lady_vermin.sql` is applied to `cactigrow_staging`; the staging runtime role has only `SELECT`, `INSERT`, and `UPDATE` on `bred_seeds`. Human authenticated gameplay review remains pending. This document does not authorize production deployment.

## Authority and identity

The existing E1 V1 projection and commodity seed commands retain their contract. V2 adds a server-owned unique bred seed inventory and enriches physical specimens with persisted lineage and resolved genetic features. A breeding event establishes a new clone line and genetic profile before planting. The server resolves inheritance, feature and mutation outcomes, independent Shiny, IDs, and timestamps once. Planting that specific seed creates a physical specimen referencing the established clone line and does not roll genetics again. The available seed leaves the inventory projection, but its historical row remains for lineage and provenance.

Both collected parent specimens remain owned, unchanged, and available for repeated breeding. The service checks distinct owned mature parents, observed versions, and the centralized same-genus rule. No listing state exists for E1 server specimens, and selling remains unavailable. Echinopsis crosses Echinopsis and Lophophora crosses Lophophora; cross-genus pairs fail. Same-genus cross-species offspring use the first parent's species for display while retaining both parent species IDs and hybrid status, matching the existing prototype rule.

## API and lifecycle

- `GET /api/v2/me/plant-lifecycle` returns the six slots, commodity stacks, individual available bred seeds, and owned specimens.
- `POST /api/v2/me/plant-lifecycle/commands/breed-specimens` accepts two parent specimen IDs and observed versions.
- `POST /api/v2/me/plant-lifecycle/commands/plant-bred-seed` accepts one unique seed ID and Nursery slot ID.

Both commands require an authenticated internal player, a UUID `Idempotency-Key`, and the existing request-scoped database context. The client cannot choose the player ID, offspring ID, genetics, outcome, or timestamp. Receipt replay returns the original response; the transaction serializes duplicate commands. The seed row locks on planting and may move from available to planted only once. Existing E1 growth, readiness, and collection commands then apply unchanged to the resulting specimen. The two-minute development/staging growth schedule is still forbidden in production.

The migration `0002_smooth_lady_vermin.sql` adds only `bred_seeds` with owner, unique clone line, parent specimen/species IDs, feature state, availability, and optional planted specimen. Existing E1 tables and the Phase D bootstrap contract are not changed. The runtime role needs `SELECT`, `INSERT`, and `UPDATE` on this table; `UPDATE` also permits the row lock used by `SELECT FOR UPDATE`. Grant only after owner migration, with target database and direct/unpooled connection verified. Never run fixture provisioning or reset existing staging specimens as part of E2.

React reads V2 through the typed client and uses only server commands for server-owned parents and seeds. The legacy local prototype stays isolated in local mode. Garden display assignment, Sell, Study Genetics, tissue sampling, economy, and progression remain unmigrated. The six physical Garden display beds do not limit ownership and collection does not auto-assign a display bed.

## Verification gate

Run pure/domain, Worker/API, typed client, TypeScript, build, lint, schema consistency, and diff checks. The guarded integration suite passed against disposable `cactigrow_test`, including ownership, maturity, genus, replay/concurrency, unchanged parents, persistent seed identity and lineage, one-time planting, no rerolls, collection, commodity coexistence, and Account B isolation; its test schema was cleaned afterward. The additive migration and least-privilege grant were then applied to isolated staging; all six existing specimens and both commodity seed stacks retained their pre-migration and post-deployment counts. Staging deployed through the guarded wrapper after build, lint, Worker/API, client/domain, schema, and dry-run checks. Anonymous V2 requests still redirect to Cloudflare Access; authenticated browser gameplay needs human review. Do not commit or push in this pass.
