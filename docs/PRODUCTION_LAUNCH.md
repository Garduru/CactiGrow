# Production Status — 2026-10-01

## Live Baseline

Production is already live at `https://cactigrow.com` on the existing `cactigrow-api-production` Worker. Production Neon Auth is working with real accounts, persistent player state and restoration are working, and real two-account Town multiplayer has been tested. Do not change DNS, domains, auth configuration, existing realtime bindings, or multiplayer authority for Social V1.

Production growth uses the already-deployed Alpha schedule: San Pedro matures in five minutes and Peyote in fifteen minutes, with intermediate durations scaled proportionally. Preserve these timings and all stored schedules.

The existing production resources are the Neon Auth endpoint recorded in `NEON_AUTHENTICATION.md`, Hyperdrive `158393f7112548959359357702fe183f` using `cactigrow_runtime`, and the deployed SQLite `AreaPresence` Durable Object. The checked-in Wrangler production config already targets the live apex and `www` routes. No domain cutover is needed.

## Player Profiles/Social V1

Commit `3c5cdc4356030df37f04e11d6d546b865c2665c5` adds additive migration `0005_majestic_fenris.sql` for `player_profiles`, `friend_requests`, `friendships`, and `player_blocks`. It adds no backfill and changes no existing player rows. Existing accounts choose a name on their next authenticated session.

Apply the migration with the direct production owner/migration connection after the isolated database integration test passes. Verify the target database is `cactigrow`. Never reset, drop, truncate, or rewrite player data.

Grant `cactigrow_runtime` only these additional privileges:

- `player_profiles`: `SELECT`, `INSERT`, `UPDATE`.
- `friend_requests`: `SELECT`, `INSERT`, `UPDATE`.
- `friendships`: `SELECT`, `INSERT`, `DELETE`.
- `player_blocks`: `SELECT`, `INSERT`, `DELETE`.

Retain existing narrow grants on player, onboarding, specimen, and bred-seed tables. Do not grant schema creation, migration-table access, or elevated role attributes. Social chat continues over the existing AreaPresence socket; the Durable Object stores only its private ephemeral block projection, not message history.

## Rollout Gate

The Social V1 migration and Worker rollout are not yet applied. In the current workspace, `TEST_DATABASE_URL`, `DATABASE_URL`, and the database-test enable flag are absent; `.env.production` contains only frontend build settings. `npm run test:db` therefore skipped the disposable PostgreSQL suite. Do not deploy the Worker until the isolated integration passes, the migration and grants are applied and verified, and the post-migration projection checks pass.

Once those gates pass, deploy only through `npm run deploy:production` with `CACTIGROW_DEPLOY_CONFIRM=production`. This deploys to the already-live Worker and does not require or authorize DNS changes. Verify `/api/health`, authenticated bootstrap, name persistence, social relationships, and two-account Town chat/block behavior afterward. Application rollback must not reverse the additive migration or erase player data.