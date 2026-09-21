# CactiGrow Online Foundation Phase E1

Status: **IMPLEMENTED AND LIVE-VERIFIED IN PERSISTENT DEVELOPMENT**

Phase E1 adds the first server-authoritative gameplay vertical slice: persistent commodity seed stacks, six Nursery slots, commodity planting, development-accelerated timed growth, collection, and persistent owned specimens. The Phase D bootstrap contract remains unchanged.

## Authority and identity

The durable chain is commodity seed stack -> clone line -> physical specimen -> presentation. Planting establishes a sexual genetic individual with server UUIDs, version-1 baseline genetics, an independent exact 1/4096 Shiny roll, authoritative timestamps, and a resolved growth schedule. Clone-line UUID drives genetic visual variation; specimen UUID drives bounded physical variation. Collection preserves both identities and all genetic state.

Server mode is explicitly enabled in development with `?e1Lifecycle=server`; local prototype mode remains the default. The modes never dual-write. In server mode, commodity inventory, six Nursery slots, readiness, collection, and E1-created specimen identities are server-owned. Progression, discoveries, and achievements are deliberately not awarded. Unique seeds, breeding, Garden assignment, selling, Lab operations, and other local mutations are not supported for server specimens until those systems migrate.

## API

- `GET /api/v1/me/plant-lifecycle`
- `POST /api/v1/me/plant-lifecycle/commands/plant-commodity-seed`
- `POST /api/v1/me/plant-lifecycle/commands/collect-plant`

Commands require an `Idempotency-Key` UUID. Clients submit intent and observed row versions, never player IDs, generated IDs, timestamps, genetics, randomness, or outcomes. The application service owns a Drizzle transaction obtained from the existing request-scoped database context.

## Growth and randomness

E1 growth-rule version 1 is the isolated two-minute development rule and throws under production configuration. `ready_at` is stored, while progress, stage, and readiness labels are derived. Shiny uses a cryptographically secure unsigned 16-bit draw; exactly one low twelve-bit result among 4096 succeeds. Completed receipts return the original result before new random work.

## Development fixtures

Seeds are never created by authentication, bootstrap, player creation, or lifecycle reads. After separate migration approval, run the explicit tool with `CACTIGROW_ENABLE_DEVELOPMENT_PROVISIONING=1`, `CACTIGROW_ENVIRONMENT=development`, a direct `DATABASE_URL` targeting exactly `cactigrow`, and alias `account-a` or `account-b`:

```text
npm run db:provision:development-seeds -- account-a
```

It inserts missing San Pedro (4) and Peyote (2) rows only. Existing rows, including zero-quantity rows, are never refilled. It rejects production, pooled connections, arbitrary players, and unknown aliases, and does not print identities or credentials.

## Schema, permissions, and recovery

Migration `0001_aberrant_amazoness.sql` adds only the eight approved E1 tables. It is additive and leaves Phase C/D identity tables intact. It is applied exactly once to persistent development alongside the existing Phase C migration.

The reviewed development runtime grants are:

| Table | Privileges |
| --- | --- |
| `player_seed_stacks` | `SELECT`, `UPDATE` |
| `clone_lines` | `SELECT`, `INSERT` |
| `genetic_profiles` | `SELECT`, `INSERT` |
| `clone_line_variants` | `SELECT`, `INSERT` |
| `plant_specimens` | `SELECT`, `INSERT`, `UPDATE` |
| `nursery_occupancies` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| `gameplay_command_receipts` | `SELECT`, `INSERT`, `UPDATE` |
| `player_plant_lifecycle_versions` | `SELECT`, `INSERT`, `UPDATE` |

`UPDATE` on `nursery_occupancies` is required by PostgreSQL for the collection transaction's `SELECT FOR UPDATE` row lock even though the command deletes, rather than updates, the occupancy. The role retains no schema `CREATE`, migration-table modification, ownership, elevated membership, database/role creation, replication, bypass-RLS, or superuser privileges.

Use the existing direct/unpooled owner procedure and target-database validation when migration is separately approved. Once durable gameplay exists, recovery is fix-forward: disable the E1 authority switch, preserve rows, and apply a reviewed corrective migration.

Persistent development verification exercised the real typed client -> temporary remote Worker preview -> development Hyperdrive -> `cactigrow_runtime` -> Neon path. Both approved fixtures remained idempotent at San Pedro 4 and Peyote 2 before testing. Account A planting, stored idempotent replay, a two-client same-slot race, authoritative-time collection, stored collection replay, Account B isolation, and projection persistence after preview restart all passed. The race left no orphan clone line, genetic profile, specimen, or occupancy. Browser-visible lifecycle responses contained only the versioned lifecycle contract and resolved gameplay state. The temporary previews were shut down; no permanent Worker was deployed and no production infrastructure was provisioned.
