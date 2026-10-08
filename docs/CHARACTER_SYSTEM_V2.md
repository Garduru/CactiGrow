# CactiGrow Character System V2

Staging-only milestone, 2026-10-07. This supersedes the static character portion of Art Direction V1. Its world tiles remain directionally accepted. Character V2 still requires human visual acceptance; no commit or push is authorized before that acceptance.

## Milestone report

1. **Body architecture:** `shared/characters/appearance.ts` adds bounded presentation indices: 0 Masculine, 1 Feminine. This is appearance data, with no gender/account field. The existing Starting checkpoint, command receipt and public presence projection remain the persistence/transport boundaries. Missing body resolves to 0 without writing or resetting an account.
2. **Art differences:** two separately authored body pose sheets share practical clothing, painterly lighting and world height. The feminine base has a different face, narrower shoulder line, waist and hip silhouette; it is not a recolor of the masculine base. Body-specific pose pigment masks preserve painted folds while recoloring skin, shirt and trousers with shared palette choices.
3. **Creator:** name first, then Face and hair / Field outfit, then one authoritative save. Equally styled Masculine/Feminine controls appear first. Both bodies support three skin tones, four hairstyles, four hair colors, four work-shirt palettes, three trouser palettes, three headwear states and two accessory states. Back retains local choices; previews update from the same compositor used in-world. Existing loading/error/retry behavior prevents saving an unseen preview.
4. **Walk structure:** each body has four directional rows, each with one idle and four authored walking poses. Legs alternate, arms swing subtly and the body changes pose. `CharacterMotion` observes actual completed movement; one loop advances per 160 world units. It adds no movement controller, pathfinding, network publication or gameplay state.
5. **Facing:** south/west/east/north, chosen from actual displacement. A small diagonal tie band retains a matching previous direction. Stopping returns to that direction's idle after a 55 ms grace period, avoiding idle flashes between 60 Hz physics steps on faster displays. Large restoration jumps select idle. Click, keyboard and minimap movement all use this same observer.
6. **Multiplayer:** Town's existing 110 ms interpolation feeds the same animation state. Saved body/modules are composited once per look. Public facing is retained, and walking stops at the interpolated target even if the latest packet still says moving. Existing generation, sequence, membership and transport rules are preserved. Staging presences without saved appearance use the shared masculine compatibility look and animation; production/development retain their existing placeholder rendering. No account or public payload is rewritten.
7. **Mara:** an authored older female field guide with silver braid, sage blouse, ochre pocket vest, straw hat, worn boots, satchel and closed field notebook. The outfit/face are separate authored art beyond player combinations. Four planted idle directions face nearby players while preserving her `mara-guide` entity ID, position, interaction range, dialogue and tutorial state. She has a four-pose directional walk atlas for future movement, with no new wandering/pathing.
8. **NPC presets:** existing `NPC_APPEARANCES`/entity aliases identify the authored NPC. A renderer-only `npcId` selects her atlas through the shared preview/atlas pipeline; player payloads cannot submit NPC metadata. Adding future authored NPCs requires a preset, atlas and explicit module registration, not a second character renderer.
9. **Assets:** runtime files are in `public/assets/characters/player/masculine/`, `player/feminine/`, `shared/` and `npc/mara/`. Generated masters, registration and deterministic crop/mask/export script are in `art-source/characters/desert-grower-v02/`. Shared directional hair/headwear/satchel modules are reused by both player bodies. V1 assets remain intact. Exact built-in imagegen edit/generation prompts are in [CHARACTER_SYSTEM_V2_PROMPTS.md](../art-source/CHARACTER_SYSTEM_V2_PROMPTS.md).
10. **Performance:** pose sources are 640 x 896 (20 cells of 128 x 224), cosmetics 96 x 512. Twelve runtime files total 1,446,541 bytes (1.38 MiB); three pose sheets, two masks and seven cosmetics use about 12.25 MiB decoded. World caches downsample each look to a 320 x 448 atlas with 64 x 112 frames: 560 KiB decoded per distinct look. Display size, bottom-center origin, `(0,13)` art offset, 54 x 54 container, radius 27 and accepted depth remain intact. Compositing happens once per look; per-frame work selects an atlas frame. The animated kit uses more memory than V1's static kit (about 672 KiB of sources and 112 KiB per look), while keeping source masters out of the shipped assets. No new dependency, API polling or socket is added. These are dimension/byte estimates, not physical-phone FPS measurements.
11. **Staging Worker:** `cactigrow-staging`, version `3ac9ff79-6d2b-4739-a3c4-2fb23f475fdb`, deployed at `2026-10-07T10:25:18.645423Z` and active at 100%, on [dev.cactigrow.com/world](https://dev.cactigrow.com/world). The guarded staging wrapper was used. Production, schema, grants, identity, Access, DNS and binding configuration were untouched; no live player reset or tutorial command was performed.
12. **Tests:** Starting 29/29 with disposable PostgreSQL and full actual Chrome flow; World 19/19 with PostgreSQL; Characters 10/10; actual Phaser browser 1/1 with 26 physical transitions, real canvas click, four keyboard directions, minimap movement, saved masculine/feminine/legacy remote animation, Mara and listener cleanup. All have zero skips/errors. Eleven affected regression commands pass (178 checks including Characters): Worker, characters, minimap, navigation, multiplayer client, realtime, client API, menu, reconciliation, chat and Dev Tools. Production/staging local builds, lint, client/Worker types, guarded staging dry run, asset/authority invariants and whitespace checks pass. Existing bundle-size and PostgreSQL concurrent-query deprecation warnings remain.
13. **Acceptance:** generated sources and actual composited/browser views are reviewed by the agent. Human staging acceptance is pending for both creator bodies, multiple clothing/hair looks, four walk directions using click/keyboard/minimap, Mara/player distinction, Starting Spawn, Farm and Town. Physical-phone and authenticated two-account staging acceptance are separate from disposable browser fixtures.
14. **Files:** the complete V2-only inventory below contains 15 modified and 27 added files against the captured pre-V2 baseline. All 100 original dirty files remain; the original 132,536-byte context prefix, nine V1 character source/assets, 18 world/building art hashes and exact LDtk project are preserved. Existing uncommitted Starting/World/Art V1 work and unrelated files are retained.
15. **Git:** no commit or push. HEAD remains `3499e542713c673eef572087a8ed86d46f6bdf37`; manual visual acceptance is required before either action.

## Compatibility

No schema migration, live reset, forced creator, grants or role change. Body 0 and hair 0/1 retain their existing indices; hair 2/3 append Wavy crop / Long braid. Fresh and full-reset staging accounts receive the choices through the existing name gate. Existing completed accounts retain their state, with omitted modules resolving deterministically.

Older open V1 tabs should reload before using V2 saves. The V1 validator rejects body 1 and hair 2/3; a future rollback after V2 appearances have been saved must retain the expanded validator bounds. Do not deploy an old strict validator over those saves.

## Requested coverage

| Requirement | Evidence |
| --- | --- |
| Masculine selection persists | Actual API/PostgreSQL body 0 save, GET, new service read, idempotent replay and overwrite rejection in `server/starting/starting.integration.test.mjs` |
| Feminine selection persists | Actual API/PostgreSQL body 1 save with braid, GET, service reload and replay checks; Chrome save/refresh/Farm appearance |
| Existing accounts fall back safely | Shared appearance bounds/defaults, legacy checkpoint persistence and established-account compatibility tests |
| Creator preview updates | Actual Chrome pixel signatures for both bodies and four hair choices; equal body controls; Back retains choices; one save |
| Movement starts walking | Pure displacement tests plus actual Phaser moving-state and four gait-frame assertions |
| Stop returns idle | Physics/interpolation stop tests and actual idle atlas-frame assertions, including blocked UI keyboard |
| Direction updates facing | Four real keyboard directions with retained idle facing and diagonal tie tests |
| Keyboard and click share animation | Four actual keyboard directions and a camera-derived real canvas click, checking all four gait frames, physical arrival and retained idle-facing through the same observer |
| Minimap shares animation | Actual minimap walk/stop assertions plus unchanged minimap/navigation regressions |
| Remote appearance loads and animates | Public whitelist tests, remote interpolation/state tests, actual Town browser avatar assertions and existing two-client transport tests |
| Mara is an authored female NPC | Preset body 1 and unique atlas/pixels versus the same player modules |
| Mara uses the shared renderer | Shared pose format, interaction-facing idle and unchanged entity registration, verified in actual Phaser |
| Mobile creator works | Actual Chrome at 320, 360 and 390 CSS pixels for both bodies and outfit page, with visible preview and no horizontal overflow |
| Starting regressions | Actual API/PostgreSQL and full Chrome name, reset, guide, harvest, Path 1, Farm Nursery/Garden/research/breeding, highlights, refresh and Travel flow |

## Release evidence

Final deployed entry is `index-D0d2ZJUN.js`, stylesheet `index-CWd5G9Z_.css`, world chunk `LdtkWorldPage-DbL-fRbb.js`. Authenticated Chrome reloaded the matching bundle and retained the user's current Starting Spawn Step 1 / Talk to Mara, level and balance. Live verification was read-only after reload; no name/appearance submission, movement, reset or tutorial command was issued by the agent. The user's account had advanced from the old empty name form before this release; that user activity was preserved.

The isolated staging metadata preflight returned HTTP 200 for a read-only transaction and verified `cactigrow_staging` / `cactigrow_staging_runtime` with required existing privileges. This is database/configuration proof, distinct from general application health acceptance. No migrations or grants were needed. Deployment ID: `aa7cd3f0-a085-4b00-9a79-41836e00ee4d`; previous staging Worker: `3c01fe75-0b79-47df-81c7-e1771c13b836`.

Preservation: LDtk SHA-256 `4f4313e5dad8c339764d684eba6153069f0ff3b57fa68c9484f8846a089fc04d`, version `4f4313e5dad8c339`; accepted atlas SHA-256 `9b1885ecad13b75562ae687faaebccf8abf25b1b92dfa0acc40520338d9f6393`. All eleven Areas' dimensions/topology/IntGrid/entities and 18 world/building art files match the V2 baseline. All nine V1 character sources/runtime files are byte-identical. Frozen asset validation found 60 unique authored body poses and 120 unique poses across six composed looks, valid alpha and transparent corners. All twelve built runtime assets matched the frozen export hashes.

Evidence is local ignored work output:

- [Live staging view](../.wrangler/character-v2-work/live-staging-final.jpg)
- [Final composed looks and four directions](../.wrangler/character-v2-art/character-v2-contact-sheet.png)
- [Masculine creator](../.wrangler/character-v2-work/creator-masculine-desktop.png), [feminine creator](../.wrangler/character-v2-work/creator-feminine-desktop.png), [320px outfit](../.wrangler/character-v2-work/creator-outfit-320.png)
- [Authored Mara](../.wrangler/art-direction-work/character-v2-mara-facing.png), [Farm](../.wrangler/art-direction-work/character-v2-farm.png), [Town](../.wrangler/art-direction-work/character-v2-town.png)
- [Browser movement/transition results](../.wrangler/world-browser/result.json), [Starting/World/appearance acceptance](../.wrangler/character-v2-work/validation-evidence.json), [asset dimensions/alpha/hashes](../.wrangler/character-v2-art/asset-verification.json), [deployment](../.wrangler/character-v2-work/deployment-final.json)

Export reproduction uses Pillow and `python art-source/characters/desert-grower-v02/prepare-assets.py`. The exporter registers authored poses, isolates cell fragments, derives coherent material masks and creates lossless runtime files; it does not fabricate gait frames. Shared cosmetics attach to each authored pose's recorded head/torso anchors. Browser preview assets load once; previews repaint on selection, while world atlases are cached per look.

## V2 file inventory

Relative to the captured pre-V2 working tree: 15 modified files and 27 added files. Art V1, Starting Experience and World Foundation changes already present before this task are not counted as new V2 work.

Modified:

- `PROJECT_CONTEXT.md`
- `docs/ART_DIRECTION_V1.md`
- `package.json`
- `server/starting/starting.integration.test.mjs`
- `server/starting/startingUiAcceptance.mjs`
- `shared/characters/appearance.test.ts`
- `shared/characters/appearance.ts`
- `src/characters/characterArt.ts`
- `src/features/starting/AppearanceSetup.tsx`
- `src/features/starting/starting.css`
- `src/game-world/LdtkAreaScene.ts`
- `src/game-world/PlayerCharacter.ts`
- `src/game-world/RemotePlayers.ts`
- `src/game-world/TownTestScene.ts`
- `src/game-world/world.browser.test.mjs`

Added:

- `art-source/CHARACTER_SYSTEM_V2_PROMPTS.md`
- `art-source/characters/desert-grower-v02/desert-equipment-directions-master-v02.png`
- `art-source/characters/desert-grower-v02/desert-grower-feminine-poses-master-v02.png`
- `art-source/characters/desert-grower-v02/desert-grower-masculine-poses-master-v02.png`
- `art-source/characters/desert-grower-v02/desert-hair-directions-master-v02.png`
- `art-source/characters/desert-grower-v02/desert-mara-idle-master-v02.png`
- `art-source/characters/desert-grower-v02/desert-mara-poses-master-v02.png`
- `art-source/characters/desert-grower-v02/export-report.json`
- `art-source/characters/desert-grower-v02/prepare-assets.py`
- `art-source/characters/desert-grower-v02/registration.json`
- `docs/CHARACTER_SYSTEM_V2.md`
- `public/assets/characters/npc/mara/desert-mara-poses-v02.webp`
- `public/assets/characters/player/feminine/desert-grower-feminine-pigments-v02.png`
- `public/assets/characters/player/feminine/desert-grower-feminine-poses-v02.webp`
- `public/assets/characters/player/masculine/desert-grower-masculine-pigments-v02.png`
- `public/assets/characters/player/masculine/desert-grower-masculine-poses-v02.webp`
- `public/assets/characters/shared/desert-field-satchel-v02.webp`
- `public/assets/characters/shared/desert-hair-cropped-v02.webp`
- `public/assets/characters/shared/desert-hair-long-braid-v02.webp`
- `public/assets/characters/shared/desert-hair-tied-back-v02.webp`
- `public/assets/characters/shared/desert-hair-wavy-crop-v02.webp`
- `public/assets/characters/shared/desert-hat-cap-v02.webp`
- `public/assets/characters/shared/desert-hat-straw-v02.webp`
- `src/characters/characterMotion.test.ts`
- `src/characters/characterMotion.ts`
- `src/characters/characterRegistration.generated.ts`
- `src/game-world/remoteCharacterMotion.test.ts`

Unrelated baseline files preserved byte-for-byte: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md` and `local-ai-benchmark-report.txt`. All baseline files remain. Exact task-relative hashes and preserved context prefix are captured in `.wrangler/character-v2-work/inventory-final.json`. Validation logs/screenshots remain local ignored evidence.


## Accepted staging baseline checkpoint - 2026-10-07

The user accepted this milestone as part of the current staging visual/world development baseline and explicitly authorized committing/pushing the accepted work. This supersedes earlier visual-acceptance and commit/push hold language in this historical implementation report. Outstanding device/performance and other unperformed verification remain documented limitations. See PROJECT_CONTEXT.md, Accepted staging visual/world development baseline. Future development is staging only; no production deployment, database or configuration change is authorized by this checkpoint.
