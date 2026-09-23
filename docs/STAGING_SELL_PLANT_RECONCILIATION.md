# Staging sale and rapid planting follow-up

Deployed staging Worker: `c78dbddf-aef1-4a68-a171-2a9e8a26d2f1`. Previous version: `4334c10d-c5ff-49cf-8658-6748a9d289b0`.

## Verified diagnosis

NPC sale follows `SellWorkflow` -> `GameStateProvider.sellPlantToNpc` -> `GrowerAuthorityProvider.mutate` -> `CactiGrowApiClient.mutateGrowerAlpha` -> the authenticated `/api/v1/me/grower-alpha` route -> `GrowerAlphaService.execute/apply/projectWith`. The server locks the owned specimen, calculates the established NPC reward, marks it sold, updates Tokens, and stores the projection in the command receipt within one transaction. The provider already installs that response. The bug was in `GameHeader` / `headerPlayerModel`: staging ignored this live projection and always displayed the one-time `PlayerBootstrapProvider` snapshot. The HUD now uses the live server projection, with bootstrap only as the initial fallback. No local currency award was added.

Sale success waits for the command's transaction and returned projection. The provider then starts lifecycle and Garden reads in parallel to remove the sold specimen and display assignments. These reads are not a serial prerequisite for displaying the returned balance. No additional bootstrap fetch is needed. This describes source-observed work, not measured live database/network timings.

Nursery slots open a fresh `SeedPicker`; choosing a seed immediately calls the appropriate V3 commodity or bred-seed method. The picker guards duplicate submissions. Plant mutation requests have no AbortController and no client timeout; effect cleanup only aborts initial projection reads. The Worker validates intent, authenticates ownership, and uses the existing transactional command receipts. No Worker transaction or receipt behavior changed in this follow-up.

The reported connectivity message was emitted by the typed client's rejected-fetch catch, before reading an HTTP response. Structured Worker errors already used their safe server message. The exact reason for the real staging fetch rejection has **not** been established: there is no captured failing network trace. No evidence proves rate limiting, a DB failure, or an overlapping mutation caused it. The documented edge rule is 100 API requests per 10 seconds; ordinary six-slot planting alone does not establish that threshold was reached.

## Focused changes

- V3 planting now reconciles the authoritative slot, stack/version, or consumed bred-seed ID from its response instead of issuing another full lifecycle GET. Grower refresh remains for XP/discoveries.
- A provider-level planting guard complements the picker guard. Older in-flight lifecycle/Grower reads cannot overwrite a completed mutation; a failed refresh retains an already loaded authoritative projection.
- V3 planting alone may retry a rejected fetch once, after 250 ms, with the exact same body and idempotency key. Receipt replay makes an already committed first attempt safe. HTTP errors, aborts, other mutations, and invalid responses are not automatically retried.
- Redirects are handled explicitly as session authentication failures instead of following Access redirects into possible cross-origin fetch failures. This is a handled failure mode, not a claim that it caused the reported incident.
- Structured errors preserve message, status, code, and request ID. Non-JSON 401/403/429/5xx responses have safe status-aware messages; no response HTML, SQL details, stack traces, or credentials enter UI messages.
- NPC confirmation has synchronous duplicate protection and a disabled pending state. Structured sale errors are surfaced safely.

## Files changed in this follow-up

- `src/components/layout/GameHeader.tsx`
- `src/components/layout/headerPlayerModel.ts`
- `src/app/GrowerAuthorityProvider.tsx`
- `src/app/PlantLifecycleProvider.tsx`
- `src/app/reconcilePlanting.ts` (new)
- `src/features/marketplace/SellWorkflow.tsx`
- `src/services/api/CactiGrowApiClient.ts`
- `src/services/api/CactiGrowApiClient.test.ts`
- `server/db/integration.test.ts`
- `docs/STAGING_SELL_PLANT_RECONCILIATION.md` (new)
- `docs/DEPLOYMENT_STAGING_FOUNDATION.md`

Earlier uncommitted viewport/breeding/plant-lock fixes are preserved.

## Validation and limits

TypeScript (client and Worker), ESLint, 31 Worker/API tests, 22 client tests, 6 lifecycle/domain tests, genetics/gameplay verification scripts, production and staging builds, staging dry run, and diff checks passed. Vite retains its existing large-chunk advisory. The PostgreSQL integration suite is not configured in this session and was skipped; its sale assertions now also check the exact established reward, new-key double-sale rejection, and a fresh projection after replay.

Isolated Playwright Chromium tests at 390x844 and 1440x900 used intercepted API fixtures. They verified immediate sale balance/specimen updates, one POST for double-click, persistence across a fixture-backed reload, delayed old-read rejection, six rapid sequential commodity/bred plantings, two lost responses after simulated commits, exact receipt-key reuse, six occupancies/consumptions, and a structured 409 without consumption or a connectivity message. Browser request counts confirmed no lifecycle GET is added by planting. These tests do not verify the live staging database or identify the original transport failure.

Manual staging check: reload, note Tokens, sell one specimen, confirm the exact displayed reward is added immediately and the specimen disappears, then reload and compare. Plant several distinct slots quickly with both seed kinds, confirm one consumption per slot, and reload to confirm the same occupancies. If an intermittent failure remains, capture its endpoint, HTTP status or browser network error, and request ID when present, without cookies or credentials.
