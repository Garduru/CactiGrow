# Chat + Mailbox V2

Deployed to protected staging as Worker **83f39699-2a0c-4194-a708-6647bbc8c901**. Actual paired server acceptance passed in Brave/Chrome on 2026-10-04. Physical iPhone/Safari checks remain manual. Production is held by the latest user instruction. Staging migration 0007 and grants were not rerun.

## Requested final report

| # | Topic | Result |
|---|---|---|
| 1 | Channels | Local = current Area; Town = Town Area membership; World = current Zone; DM = one online player anywhere. Four independent bottom-left tabs. |
| 2 | Mapping | `town` and each private `farm-<public profile UUID>` belong to `starter-zone` / Starter Zone. Farm interior/fallback routes retain their owner's Farm scope; Town/Shop/Market routes use Town. Farm admission requires authenticated ownership. `ChatLocation` centralizes the temporary topology. |
| 3 | Town vs World | Town does not reach Farm; World reaches Town and Farms in the same Zone. Leaving Town stops Town membership. Neither depends on rendering Layers. |
| 4 | Local | Area-wide delivery across rendering Layers. Movement snapshots retain Layer isolation. Different private Farms have different Local scopes. |
| 5 | DM anywhere | SocialProvider owns one existing AreaConnection per gameplay session; Town rendering consumes it. A private directory within the existing AreaPresence namespace routes by internal player identity/current socket generation. No second WebSocket. |
| 6 | Online | Leases use existing heartbeat/stale/authorization deadlines. Recipient socket acceptance precedes sender echo. Offline/blocked delivery fails visibly and suggests Mail. UI uses neutral availability text rather than unverified online badges. |
| 7 | Mobile chat | visualViewport geometry places the dock above the keyboard. Mobile focus locks/restores document styles/scroll using the existing Admin restoration helper; inputs are at least 16px. Close restores offsets/input and preserves HUD/world. Rapid reopen cancels previous restoration listeners. |
| 8 | Mail | Authenticated typed GET/POST API plus unread-count route; persistent Inbox/Sent/Compose, bounded recipient search, read state, one optional attachment, review, paging/refresh, menu badge. Works offline without realtime push. |
| 9 | Currency | Deducted atomically on send; credited only on claim. Existing command receipts enforce send replay identity; locked mail row/claimed timestamp enforce one credit and reject a second claim with 409. Capacity failure rolls back and leaves escrow claimable. |
| 10 | Items | Existing San Pedro and Peyote commodity seed stacks only. Debit on send, credit on claim under inventory locks. No generic items or individual bred seed transfer. |
| 11 | Specimens | Only owned, collected, non-Favorite, unlisted, unoccupied specimens. Escrow reserves the existing ID, hides it from usable inventory, and rejects sale/list/breed/organization mutations. Claim transfers ownership without cloning/rerolling and preserves clone line/genetics/lineage/Shiny/timing/tags. Research remains each player's own permanent knowledge, per user clarification. Display placement is removed. |
| 12 | Blocks | Either direction rejects new mail. Existing escrow remains claimable to avoid stranding valuables. DM/public delivery retain server block filtering; recipient search hides blocked/self targets. |
| 13 | Schema | Additive `0007_hard_supreme_intelligence.sql` creates only mail_messages plus FKs/indices/constraints. Attachment/reservation/read/claim state share that table. Existing command receipts provide replay/audit records. New runtime privilege: only SELECT/INSERT/UPDATE on mail_messages. |
| 14 | Staging acceptance | Actual paired protected-staging channels, DM, blocks, mail and preservation passed. Physical iPhone checks remain manual; synthetic cross-Zone coverage is accepted. |
| 15 | Staging version | 83f39699-2a0c-4194-a708-6647bbc8c901 on dev.cactigrow.com, via guarded deployment; supersedes initial V2 Worker 183f4671-0e99-4a70-af07-4b0fcd4a91fc. |
| 16 | Production version | No new version/upload or mailbox SQL applied. Latest user instruction holds production. |
| 17 | Verification | Build/lint/Worker types, focused chat/mail/browser tests and affected regression suites pass; commands below. |
| 18 | Files | Exact grouped inventory below, including generated snapshot/journal. |
| 19 | Commit/push | Scoped commit/push follows paired acceptance; see the final delivery report for the resulting hash. Archive/audit/benchmark exclusions remain untouched. |
| 20 | Deferred | Full world topology/Farm visiting, group DMs, permanent chat history, verified global online badges, mail push/returns/cancel/delete/claim-all, generic attachments, and production rollout. |

## Bounds and history

Chat remains ephemeral: up to 100 client session messages; DMs survive Area changes, public history resets. Text retains the existing 500-character/1 KiB frame contract and transport limits. The directory adds five send attempts per player per two seconds, preserved across refresh/hibernation, and caps its live index at 2048 peers. This Alpha bound is not unrestricted future world scalability.

Mail bounds: subject 1-80 characters, body 1-2000, currency 1-1,000,000, commodity quantity 1-1000, ten successful sends per minute, and 50 records per folder/page. Offsets are capped at 10,000. Strict commands reject unexpected fields/malformed UUIDs. Search reuses existing authenticated bounded name search. Client balances/ownership/genetics are never authoritative. The unread badge loads on login/eligible visibility refresh and updates on mailbox/read operations without interval polling.

## Verification

Passing runs have no skips; some suites overlap and counts are not independent coverage totals.

| Command | Result |
|---|---|
| `npm run build`, `npm run build:staging` | Production/staging TypeScript and Vite pass; existing large-chunk warning remains. |
| `npm run lint`, `npm run typecheck:worker`, `npm run db:check` | Pass. |
| `npm run dry-run:staging` | Planned staging Worker/bindings compile; no upload. |
| `npm run test:chat` | 12: scopes, actual Worker/DO Farm/Town DM routing, blocks, acknowledgment, expiry/replacement, rate persistence, Layer separation, viewport restoration. Cross-Zone isolation uses synthetic topology because no second live Zone exists. |
| `npm run test:mail` | 13: strict contracts, real PostgreSQL authenticated delivery/replay/races/protection/blocks, capacity rollback/retry, and isolated 0007-only migration/grant CLI. |
| `npm run test:social:viewport` | 2: real React/CSS Chromium fixtures for staging/production at 390px/320px, simulated keyboard/pan/restoration, compose/internal scroll/input isolation, read/count/claim UI, retained HUD/world fixture. |
| `test:realtime`, `test:realtime:runtime`, `test:realtime:admission` | 45 / 17 / 9, including workerd hibernation/idle expiry/admission. |
| `test:multiplayer:client` | 9, including two actual local clients/movement/reconnect. |
| `test:worker`, `test:client`, `test:menu` | 42 / 24 / 8. |
| `test:commerce`, `test:garden`, `test:collection`, `test:e1` | 4 real PostgreSQL commerce / 10 / 7 / 9. |
| `test:admin` | 6, including unchanged Admin mobile overlay behavior. |

PostgreSQL suites use `CACTIGROW_EMBEDDED_POSTGRES_MODULE` pointing to an existing embedded-postgres installation. Browser tests use `CACTIGROW_TEST_BROWSER_EXECUTABLE` pointing to existing headless Chromium. No dependency was added. Logs are in ignored `.wrangler/`. Pre-existing pg transaction patterns emit a concurrent-query deprecation warning.

Browser fixtures simulate visualViewport keyboard events and mock API/context projections. They do not establish physical Safari keyboard behavior, authenticated staging sessions or live database prerequisites.

## Historical staging database preparation (completed; do not rerun)

The execution shell has no CACTIGROW_OWNER_DATABASE_URL in its process/user/machine environment. The user reports an already-loaded direct connection in their existing VS Code PowerShell session, independently checked there as database cactigrow_staging / role cactigrow_staging_owner. That session's environment cannot be inherited here. The user already ran the continuation below and confirmed the safe result. It is retained only as preparation history. Do not request a file path or production access.

1. Load the exact existing direct staging owner connection to cactigrow_staging. Verify prior migrations and existing gameplay/social privileges; do not rerun 0006 or reapply old grants.
2. Apply only 0007 and its new narrow grant, then verify:

```powershell
& {
  $ErrorActionPreference = 'Stop'
  Set-Location -LiteralPath 'E:\CactiGrow'
  if ([string]::IsNullOrWhiteSpace($env:CACTIGROW_OWNER_DATABASE_URL)) {
    throw 'The staging owner environment variable is not loaded in this session.'
  }
  node --experimental-strip-types .\scripts\mail-rollout.ts --environment staging --ensure --confirm-database cactigrow_staging
  if ($LASTEXITCODE -ne 0) { throw 'Mailbox staging preflight failed; do not deploy.' }
}
```

The --ensure helper applies 0007 only if the mailbox table is absent, grants only missing mailbox SELECT/INSERT/UPDATE privileges, and verifies exact migration tracking/hash, required constraints/indices, narrow privileges and non-elevated runtime role. Repeating it verifies without reapplying anything. Inconsistent tracking/partial schemas, pooler/runtime connections, and excessive privileges fail closed. It does not reapply old migrations/grants or change player records. First-run/repeat behavior was tested on a disposable staging-named PostgreSQL database. Existing gameplay grant verification remains required.

3. After prerequisites pass, build and upload through the existing guard:

```powershell
npm run build:staging
$env:CACTIGROW_DEPLOY_CONFIRM = 'staging'
npm run deploy:staging
```

Staging config adds the existing AreaPresence class/namespace pattern and dev.cactigrow.com realtime origin because that environment previously lacked the binding. No second transport, Access/DNS/auth change, or production config change. Record the returned Worker version; verify front door, health/assets and authenticated APIs.

4. Complete the live checklist below. A dry run, Access redirect or fixture does not count as authenticated acceptance.
5. Production is currently held. After a later explicit instruction releases that hold, independently verify the production owner connection to cactigrow before applying only 0007/new grants and using the guarded production upload. Record version and repeat authenticated checks. Rollback must preserve additive mail/escrow data.

## Required live acceptance

- Two accounts in Town: Local/Town/World shared; movement rendering preserved.
- Farm and Town: Local isolated, Town unavailable on Farm, World shared; DM succeeds both directions.
- Leave/re-enter Town: membership changes; disconnect recipient: DM fails without delivered echo and Mail works.
- Block both directions: new DM/mail denied; existing escrow claimable.
- Offline text delivery: recipient login/refresh sees unread mail; opening updates read count/badge.
- Small currency/seed send and claim: refresh/retry both ends, verify one debit/credit.
- Safe test specimen: escrow rejects reuse; claim preserves ID/genetics/lineage/tags, changes ownership once, and does not copy research knowledge.
- Favorite/listed/insufficient-funds/insufficient-seeds rejection causes no debit.
- Physical iPhone: keyboard open/close/pan, input/send above keyboard, no lasting zoom/jump, HUD/world retained, game input restored. Mail compose/picker fit and scroll internally.

## Changed files

- Contracts/topology: `shared/api/mailV1.ts`, `mailV1.test.ts`, `shared/realtime/chatLocation.ts`, `areas.ts`, `protocolV1.ts`.
- Mail authority/schema: `server/player/MailService.ts`, `mail.integration.test.mjs`, `server/db/schema/mail.ts`, `schema/index.ts`, `migrations/0007_hard_supreme_intelligence.sql`, `meta/0007_snapshot.json`, `meta/_journal.json`, `server/api/router.ts`, `scripts/mail-rollout.ts`.
- Escrow: `server/gameplay/specimenCommerceEligibility.ts`, `PlantLifecycleService.ts`, `GrowerAlphaService.ts`, `GardenService.ts`.
- Realtime: `server/realtime/ChatDirectory.ts`, `AreaCoordinator.ts`, `AreaPresence.ts`, `admissionRoutes.ts`, `admission.runtime.test.ts`, `chatScopes.test.ts`, `areas.test.ts`.
- Client transport/session: `src/services/api/CactiGrowApiClient.ts`, `src/services/realtime/AreaConnection.ts`, `src/features/social/SocialContext.tsx`, `socialContextState.ts`, `ChatHistory.ts`, `src/game-world/useTownPresence.ts`, `TownWorldPage.tsx`, `FarmWorldPage.tsx`, `FarmTestScene.ts`, `TownTestScene.ts`, `worldKeyboardFocus.ts`, `worldKeyboardFocus.test.ts`.
- Social UI: `ChatConversation.tsx`, `ChatPage.tsx`, `InGameChatHud.tsx`, `RecipientSearch.tsx`, `socialPanelState.ts`, `useChatViewport.ts`, `chatDocumentLock.ts`, `chatViewport.test.ts`, `social.viewport.test.mjs` under src/features/social.
- Mail/menu/HUD: `src/features/mail/MailPage.tsx`, `mailStatus.tsx`, `mailStatusContext.ts`, `src/features/menu/FeaturePanelOverlay.tsx`, `gameMenu.runtime.test.ts`, `src/components/layout/GameHeader.tsx`, `UtilityMenu.tsx`, `src/app/GameSession.tsx`, `src/styles/game.css`.
- Config/docs: `package.json`, `wrangler.jsonc`, `PROJECT_CONTEXT.md`, this document.

The staging rollout also changed `tsconfig.app.json` to exclude shared Node test files from the browser TypeScript project, matching the existing src test exclusion. This fixes the fresh build's missing Node test types without changing runtime code or adding dependencies.

Preserved user exclusions: CactiGrowProductionSource.zip, docs/GARDEN_NPC_SALE_AUDIT.md, local-ai-benchmark-report.txt.

## Final staging acceptance evidence - 2026-10-04

User-confirmed additive migration 0007 and narrow mailbox grants were not reapplied. Final staging Worker is **83f39699-2a0c-4194-a708-6647bbc8c901**, uploaded through the guarded staging script after a fresh staging build. The prior claim-rejection Worker was b968d7f4-8eb2-4b15-9117-f4f53d17287f. Production-shaped builds were local validation only. Existing isolated Hyperdrive, Access, auth and DNS are preserved. Anonymous `/`, `/api/health`, `/api/v1/me/mail`, and `/api/v1/realtime/admission` still redirect to sweet-union-f685.cloudflareaccess.com. Authenticated gameplay/social/mail actions passed in both browser sessions.

A is Staging Tester in Brave: internal UUID `47511805-24fb-4934-8fb8-bd495bc3ad55`, public UUID `815e6672-24c5-4da5-bef6-c98a420befe0`. B is Staging Tester 2 in Chrome: internal UUID `0de86abc-e886-4870-a077-ada947bf638f`, public UUID `c8f213b0-b73c-402b-8313-a114f12f5766`. B used normal verified Access sign-in, existing stable internal UUID resolution, idempotent onboarding and character creation. Neither account was recreated; development identities remain rejected in staging.

| Acceptance | Actual staging evidence |
|---|---|
| Local same Area | Both accounts in Town received A-T1-local and B-T1-local. |
| Local cross-Area | A Town/B Farm messages A-split-local and B-split-local remained isolated. |
| Town | Both-Town delivery passed; A-split-town was absent from B Farm; B had disabled composer and Enter Town to join Town chat. |
| World | Both-Town and split Farm/Town delivery passed in both directions, independently of Town log. |
| Zones | Only starter-zone exists live. Synthetic future cross-Zone isolation passed, accepted by user. |
| DM | A Town/B Farm and A Farm/B Town both directions passed. Final build logs contain A-Farm-to-B-Town-final-wasd and B-Town-to-A-Farm-final-wasd on both accounts; no Town requirement. |
| Offline | Closing B's last staging tab genuinely disconnected it. A-closed-B-DM-must-reject produced no sender echo and suggested Use Mail. An earlier navigation-error experiment did not disconnect B and is not offline evidence. |
| Blocks | A-to-B and B-to-A DM rejected; recipient search hid blocked target; a stale selected Mail recipient failed server validation. Unblock restored delivery; final read-only pair block list is empty. |
| Text/read/badge | B text mail persisted and was read by A. Offline currency mail appeared on B login as one unread; opening cleared count/badge. Final projections and seven test rows show zero unread. |
| Currency | A sent B one unit while offline: sender debit at send, recipient credit at claim. A later received B's one-unit return; stale second claim explicitly rejected. Final balances A 11022/B 0. |
| Seed | Existing one-seed B-to-A mail and additional one-unit sends/claims passed. Final B-to-A stale second claim explicitly rejected. Final San Pedro stacks A 2/B 2; one B seed grew the disposable test specimen. |
| Specimen | Fresh ordinary common San Pedro b95bc79a-96b9-4adc-967b-30544ca60a6c was normally planted, matured and collected by B. Pending Mail retained B database ownership while hiding it from usable inventory; claim transferred to A once, revision 2 to 3. A stale second claim rejected. |
| Favorite/listed | Stale compose selection failed when B made the plant Favorite, and failed while B listed it. Favorite restored false; temporary listing d3ac0a5c-d6d6-49ea-9c21-e32ad1d78a24 is cancelled. |
| Preservation | Full before/after read-only comparison passed for ID, clone line fc2dba0b-0fcc-4763-8286-32abcfc3ee33, source/lifecycle/planting/collection/creation/visual version, genetics, lineage, variants and tags. Live plant has no parents and empty tags; nonempty metadata/Shiny preservation is covered by real PostgreSQL fixtures. |
| Private research | B Observed the fresh clone before sending. Both private research JSON records remained unchanged; B retains Observed knowledge and A gains none. |
| Desktop input | Actual WASD text typed and sent in both browsers; A Farm position stayed x1500/y1500. Scene destruction focus error fixed with destroy cleanup/null-manager guard and regression test. |
| Mobile | Chromium 390px/320px tests pass for simulated keyboard/pan, reachable input/send, restoration and Mail compose overflow. Physical iPhone/Safari not verified. |

Claim testing initially showed exactly-once credit but a successful no-op second claim. MailService now rejects already-claimed attachments with 409. Concurrent PostgreSQL tests require one success/one rejection, followed by another rejected replay; live stale views independently confirmed the explicit error for currency, seed and specimen.

Closing auxiliary same-account tabs can leave an old realtime lease briefly active; Chrome initially showed unavailable after a clean navigation, then recovered on reload after the duplicate session closed/expired. No authentication or admission ownership rule was weakened. Final paired DM delivery passed after clean reload. Both main user sessions remain open; auxiliary replay tabs were closed.

Final read-only verification through the existing staging Hyperdrive returned pass=true: exact staging runtime, 23 required privilege sets, no missing baseline grants, no excessive mailbox/elevated privileges, both Grower/Garden/Social/Mail service projections valid and unread zero. All seven test mails are read and all six attachments claimed; no pair blocks or active test listing remain. The transferred specimen and normal test mail/receipt history are retained.

Verification: staging build, production local build, lint, Worker typecheck and db check pass. Focused/affected suites passed without skips: chat 12, mail 13 (real PostgreSQL), social viewport 2, realtime 45, realtime runtime 17, admission 9, multiplayer client 9, Worker 42, client 24, menu 8 after the new regression, commerce 4 (real PostgreSQL), Admin 6, Garden 10, Collection 7, lifecycle/breeding 9 and navigation 12. Counts overlap. Existing large bundle and pg concurrent-query deprecation warnings remain. Ignored .wrangler logs and read-only snapshots hold detailed safe local evidence.

## Separate existing grant issue

`public.genetic_profiles`: staging runtime cactigrow_staging_runtime has SELECT/INSERT but lacks UPDATE, required by the existing quantitative-treated bred-seed planting branch. A separate read-only production check found cactigrow_runtime already has SELECT/INSERT/UPDATE. Ordinary planting and Chat/Mail passed their baseline grants. No permission was modified; a focused staging gameplay correction is separate from this milestone.

## Remaining handoff and production hold

Paired staging server acceptance passed. The latest user instruction says not to touch production yet, superseding the earlier conditional promotion request. No production mailbox migration/grants/upload occurred, and no new production Worker/health acceptance is claimed. A later explicit production instruction must release this hold; production owner prerequisites must then be verified independently using the established secure environment workflow.

Physical iPhone checklist: open Chat, focus input, verify input/send sit above the keyboard, type WASD/send without world movement, dismiss keyboard, and confirm original dock position/zoom/offset and HUD/world/input restoration. Mail Compose: focus recipient/body/attachment picker, verify reachable controls, internal scrolling and no horizontal page overflow, dismiss/close, and confirm normal page/world restoration. This manual device evidence remains outstanding separately from server acceptance.
