# First Basin Field Survey V1

Implemented and deployed to protected staging on 2026-10-08. This optional quest extends accepted checkpoint `82f78d3a94a2525befdd0f01e83f05b781cb2e0d`. Production is unchanged. This report distinguishes restricted PostgreSQL tests, controlled browser response fixtures, authenticated live acceptance, and remaining physical-device checks.

## 1. Quest giver

Mara, at one additional authored Cross Path station (`mara-basin-survey`, Area `cross-path-1`, runtime position 720,420). The station reuses her approved NPC-exclusive character appearance. Original Starting tutorial Mara is unchanged. The station is hidden until the player's Farm tutorial is complete. NPC approach, tap and E open a real conversation; the nearby prompt reads `E / tap to talk`.

The only LDtk content change is one tagged NPC entity. The offline recipe `scripts/field-survey-v1.mjs --all` reproduces it; `--check` verifies without writing. World source version is `27a4ae9f00bd4f4a`. After removing this explicit addition, the accepted complete project matches the baseline hash. All 11 Areas, 21 exits, art, collision, spawns, landmarks and runtime dimensions remain unchanged.

## 2. Quest title

**First Basin Field Survey**, quest ID `first-basin-field-survey`.

## 3. Unlock rule

The current authoritative `farmTutorialComplete` flag must be true. Established players use the same eligibility rule. Acceptance is optional; `Maybe later` leaves it available. No Farm gate, travel gate, forced modal or auto-accept was added.

## 4. Objectives

Visit the three selected Basin landmarks; make one legitimate wild San Pedro harvest; make one legitimate wild Peyote harvest; enter Basin Cave; discover Seeping Stone; inspect Mineral Formation; then return to Mara at Cross Path and explicitly report. The existing supported wild nodes and cave interaction are used. There are no quest-only fake plants or manual objective-completion commands.

## 5. Selected landmarks

`entrance-grove` (Entrance Grove), `dry-wash` (Dry Wash), and `eastern-ridge` (Eastern Ridge) form the west/middle/east route through The Basin. Cave landmark `seeping-stone` and inspection `cave-mineral-seam-note` complete the cave observation. Existing positions and descriptions are unchanged.

## 6. Existing-progress reconciliation

The server projects objectives from existing persisted landmark/note checkpoints, World Area discovery, and fingerprinted legitimate wild-harvest reward receipts. Seed ownership alone cannot satisfy harvest objectives. Valid observations before acceptance count, including already depleted nodes; no respawn, global landmark reset, seed clearing or tutorial replay is required.

## 7. Journal integration

The existing Field Journal includes the survey description, objective checklist, status, reward and report date, followed by the existing discovered-landmark descriptions and cave notes. A compact, collapsible objective surface uses existing game styling. Exploration responses directly publish the survey projection; a targeted read handles unlock and first cave entry. No periodic quest polling or per-frame HTTP was added. Response ordering rejects stale progress. Map/result feedback, dialogue, HUD and minimap remain usable.

## 8. Reward

One completion awards **30 Harvesting XP and 25 currency**, using the existing XP and balance paths. No seeds, genetics, rare outcomes, title or new economy system. XP follows the established XP cap. The normal wild-harvest reward remains unchanged.

## 9. Persistence and idempotency

`FieldSurveyService` serializes with the existing onboarding owner lock. Quest checkpoint, permanent reward receipt, Starting XP and currency commit atomically in existing tables. Commands are authenticated, strict, fingerprinted and idempotent. Accept/report validate persisted Area/revision, actual NPC target, endpoint proximity, reachable ground, line of sight and elapsed travel plausibility. An early report cannot finish the quest. Concurrent/replayed reports cannot pay twice; a failed balance update rolls the whole report back.

The permanent lifetime claim survives a quest-only reset; reaccepting/reporting gives no second reward. Tutorial reset preserves previously awarded survey XP alongside ordinary wild XP. No schema, migration, index, grants or new infrastructure are required.

The accepted exploration authority limitation remains: endpoints are client-reported and plausibility checked, rather than continuously server-authoritative movement. Existing exit-proximity enforcement remains deferred. This quest does not introduce scarce/rare tradable founder rewards or claim to close that boundary.

## 10. Dev Tools support

Existing staging/local Dev Tools gain own-player inspection and a revisioned **reset Field Survey only** control. Reset clears acceptance/completion only; discoveries, notes, harvesting history, seeds, XP, currency and permanent reward claim are retained. No other player target is accepted. Production Dev Tools remain absent; production survey/dev routes reject before auth/database.

## 11. Staging Worker

Final version **`23f0bca9-2f28-4a17-a944-1b46d84352a4`**, `cactigrow-staging`, serving **dev.cactigrow.com at 100%** from `2026-10-08T09:19:11.819Z`. Guarded command: `CACTIGROW_DEPLOY_CONFIRM=staging npm run deploy:staging`, following the staging build and isolated Cloudflare profile.

Immediately preceding version: `e4db7b50-d2c1-4c8a-899a-3c25443a2009` (initial survey upload); task baseline: `f5fc1e92-9626-427a-a8c9-45569430bed5`. The second upload corrects the NPC prompt found during live review. Existing staging Hyperdrive, AreaPresence, hostname, Access and variables are retained. Read-only preflight verified the isolated staging database/runtime identity and required current privileges. No database/configuration/Access/DNS/binding changes and no production deployment.

## 12. Tests, build and lint

All listed suites passed with zero failures/skips. Test executions overlap; this is not a claim of unique-case counts.

| Verification | Passing executions |
| --- | ---: |
| `test:field-survey` (contracts, whole-world preservation, restricted real PostgreSQL) | 22 |
| `test:field-survey:browser` (actual React/Phaser, controlled server responses) | 1 |
| Exploration (restricted real PostgreSQL) | 32 |
| Starting (real PostgreSQL and full tutorial/Farm Chrome flow) | 29 |
| World (real PostgreSQL) | 19 |
| Existing full World Chrome browser | 1 |
| Worker types, type freshness and tests | 42 |
| API client | 26 |
| Dev Tools | 7 |
| Menu | 8 |
| Navigation | 12 |
| Minimap | 3 |
| Characters | 14 |
| Settlement | 9 |
| Basin environment | 13 |
| Chat | 12 |
| Multiplayer client | 9 |

Final `npm run build`, `npm run build:staging`, `npm run lint`, affected client TypeScript and staging dry run pass. Existing large-chunk build warning remains. Focused browser coverage includes prerequisite/station visibility, optional decline, real NPC approach, accept/report, prior history, touch harvest, walking landmark discovery, cave inspection/entry, return requirement, Journal, refresh persistence, old response/GET races, no polling and 320/360/390px surfaces. The prompt fix adds a visible Mara talk-prompt regression. Full World Chrome retains 26 physical transitions, 960 character poses, 80 eye checks, navigation/minimap/remotes/cleanup and one-row mobile HUD.

## 13. Live acceptance

Authenticated **Staging Tester 2** physically walked Farm to Cross Path with the existing minimap. Farm onboarding was already complete, all qualifying prior field records were present, and the survey was previously unaccepted/unclaimed. Mara offered the optional survey; declining left it available. Accepting immediately reconciled all prior objectives (3/3 landmarks, both wild species, cave entry/landmark/note) and left a required return report step. Reporting through the actual nearby NPC dialogue completed the quest. Currency changed 0 to 25; persisted Harvesting XP changed 170 to 200.

A read-only, repeatable-read staging snapshot confirms completion, all objectives retained and **exactly one lifetime reward receipt**. Final-release authenticated reload retained completion and currency; reopening Mara shows the completed record with no accept/report button. Final-release prompt visually verified. Live 390x844 tracker, conversation and scrolled Journal fit, document width equals scroll width (390px), HUD stays one row, and minimap remains functional. Existing World/Local chat modes open normally; no chat messages were sent. Travel to Town and back to Farm completed normally. Final-release Journal retained every completed objective. Normal viewport restored and the account left on Farm.

This account already satisfied all observations, so incremental fresh objective progression is proven by restricted PostgreSQL and actual-browser fixtures, not claimed as a fresh live-account run. Protected logout/OTP relogin, paired live accounts and physical iPhone/Safari/performance remain manual acceptance. No account/quest/history reset was performed during live review.

Ignored evidence: `.wrangler/field-survey-work/` (build/deploy/test logs, final deployment list, baseline/post read-only snapshots, live screenshots), `.wrangler/field-survey-browser/` (fixture result and 320/360/390 screenshots), and existing World browser evidence. In particular, `staging-readonly-survey-reconciliation-post.json` records the exact +30 XP/+25 currency/one receipt result; `live-survey-final-journal.png` shows final-release completed objectives and report date.

## 14. Files changed

38 task paths: 20 existing files modified, 18 new files. No dependencies or art assets changed.

| Existing files modified | Purpose |
| --- | --- |
| `PROJECT_CONTEXT.md` | Append current milestone evidence without rewriting prior bytes |
| `package.json` | Two focused test commands |
| `server/api/router.ts` | Existing authenticated/staging/dev route integration |
| `server/exploration/ExplorationService.ts` | Survey projection in existing responses |
| `server/starting/StartingResetService.ts` | Preserve permanent survey XP |
| `shared/api/explorationV1.ts` | Optional validated survey projection |
| `shared/characters/appearance.ts` | New station alias to existing Mara appearance |
| `shared/world/generatedWorld.ts` | Regenerated authored world |
| `shared/world/basinExploration.test.mjs`, `shared/world/settlement.test.ts` | Permit only the explicit new station while retaining frozen baseline hashes |
| `src/app/GameSession.tsx` | Provider and compact objective |
| `src/features/devtools/DevToolsPanel.tsx`, `src/features/devtools/devTools.runtime.test.ts` | Existing Dev Tools integration and production exclusion |
| `src/features/exploration/ExplorationProvider.tsx` | Direct live projection reconciliation |
| `src/features/journal/FieldJournalPage.tsx` | Existing Journal integration |
| `src/game-world/LdtkWorldPage.tsx` | Eligible NPC visibility and real conversation |
| `src/game-world/LdtkAreaScene.ts` | One NPC talk-prompt branch |
| `src/services/api/CactiGrowApiClient.ts`, `src/services/api/CactiGrowApiClient.test.ts` | Typed API methods and tests |
| `world/cactigrow-world.ldtk` | One tagged NPC addition |

New paths:

```text
docs/FIRST_BASIN_FIELD_SURVEY_V1.md
scripts/field-survey-v1.mjs
server/quests/FieldSurveyService.ts
server/quests/fieldSurveyState.ts
server/quests/fieldSurvey.integration.test.mjs
shared/api/fieldSurveyV1.ts
shared/api/fieldSurveyV1.test.ts
shared/world/fieldSurvey.test.mjs
src/features/field-survey/FieldSurveyContext.ts
src/features/field-survey/FieldSurveyProvider.tsx
src/features/field-survey/FieldSurveyObjective.tsx
src/features/field-survey/FieldSurveyObjectives.tsx
src/features/field-survey/FieldSurveyDialog.tsx
src/features/field-survey/FieldSurveyJournal.tsx
src/features/field-survey/FieldSurveyDevInspection.tsx
src/features/field-survey/fieldSurveyPresentation.ts
src/features/field-survey/fieldSurvey.css
src/features/field-survey/fieldSurvey.browser.test.mjs
```

## 15. Commit/push status

No commit, push or index staging. HEAD remains `82f78d3a94a2525befdd0f01e83f05b781cb2e0d`. `git diff --check` passes. All 144 saved pre-existing art/public file hashes match; all three unrelated local exclusions match. The original 166,454 bytes of `PROJECT_CONTEXT.md` are preserved as an exact prefix. Preserve and exclude `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, and `local-ai-benchmark-report.txt`.

## 16. Recommended next milestone

Human content and physical iPhone/Safari acceptance of this optional survey, including a fresh post-tutorial player and protected relogin. Before adding scarce/rare tradable wild rewards, close the existing movement/exit authority boundary in a separately scoped milestone. Production promotion requires a separate explicit instruction.
