# Character System V2.1

Staging presentation milestone completed on 2026-10-07. Human visual acceptance remains pending. Production was not deployed; no commit or push was performed.

This milestone starts from the existing, uncommitted World Foundation V1, Starting Experience V1, Art Direction V1 and Character System V2 work. It changes creator layout and character composition only. Read `AGENTS.md` and `PROJECT_CONTEXT.md` before further work. The previous V2 report remains a historical record; this report supersedes its mobile layout, modular fitting and Mara presentation.

## 1. Mobile layout changes

The creator occupies the mobile visual viewport, including viewport offsets during contraction or document pan. The title and step indicator sit above a prominent full-body preview. Customization controls have their own scroll area. Back, Next and Finish remain outside that scroll area at the bottom. Short landscape layouts place preview and controls beside each other. Desktop retains a contained panel.

Safe-area insets, responsive two/three-column grids, 48px action targets and the existing copper selection treatment remain visible. Creator-scoped `touch-action: pan-y` restricts pinch while allowing control scrolling. It does not change world zoom or the global viewport meta tag. Listeners and the mobile document scroll lock are removed when the creator closes or becomes desktop sized.

Name selection still comes first. Both appearance pages and Back navigation preserve local choices. Finish uses the existing single authoritative appearance save. No creator choices were removed or added.

## 2. Anchor/compositing architecture

`characterFit.generated.ts` describes each masculine/feminine pose's crown, skull, face opening, protected eye pixels, shoulder, waist and hip. `resolveCharacterComposition` resolves deterministic geometry from these anchors and the selected hair/headwear/accessory. Geometry is independent of palette choices and is shared by the React preview and Phaser atlas composer.

Actual player layer order is:

```text
rearHair
rearAccessory (including the east-facing far-side pouch)
body (existing skin/top/bottom tint composition)
frontAccessory
foregroundArms (remove accessory pixels to expose original posed sleeves/hands)
frontHair
headwear
```

The foreground-arm mask preserves the original body's shading and pigment colors. This is not a second independently colored arm sprite. There are no screen-specific CSS art offsets or changes to appearance persistence.

V01/V02 source artwork, V02 registration, body/pigment atlases and exporter remain byte exact. V03 is a sibling export for improved fitting layers and new Mara art. `prepare-assets.py` reuses the existing normalization algorithm read-only and emits new V03 files.

## 3. Hair/hat fixes

Hair is split into rear nape/tail and front crown/fringe components. Both follow body- and pose-specific head anchors. Headwear clips the crown beneath its opening while retaining appropriate fringe, braid, nape and tied-back details. Hat width follows the actual skull. South-facing brim/crown fit is adjusted separately so the eyes remain visible.

All four hairstyles were reviewed with none/straw/cap, both bodies, both accessory states and all 20 poses. Browser pixel assertions check both protected eye patches for all 80 south-facing body/hair/hat poses, including the downsampled world cells.

## 4. Accessory layering changes

The satchel uses three new parts: rear loop, front strap and hip pouch. A deterministic affine transform maps the strap endpoints to the current pose's shoulder and pouch hook. The pouch follows the posed waist/hip, with separate front/back/profile fitting. East-facing far-side pouch pixels sit behind the body. The near sleeve and hand occlude the front accessory.

This replaces the previous flat pasted-on satchel treatment without adding equipment rules or persistent state.

## 5. Animation alignment

Both bodies retain south/west/east/north rows, with idle plus four authored walking frames per direction. The same fit resolver handles all 20 poses. The creator uses the south idle by default; the world selects frames from a flattened atlas cached once per resolved look.

Source pose canvas remains 128x224; source atlas 640x896. World pose canvas remains 64x112; world atlas 320x448. Existing 54x54 container, origin `(0.5, 1)`, vertical registration `(0, 13)`, depth, collision and camera behavior remain unchanged.

The existing displacement-driven gait, timing, movement inputs, latest-destination replacement, remote interpolation and facing behavior were preserved. The final actual-Phaser acceptance exercised all four keyboard directions, all four walk frames from a real ground click, arrival-to-idle, minimap movement, UI-blocked keyboard input and supported remote saved/legacy appearances.

Preview/world pixel parity is checked with visible premultiplied RGBA contribution. Maximum observed difference was 1.992/255 per channel; raw RGB in nearly transparent edge pixels is not claimed byte exact.

## 6. Mara redesign

Mara is now an authored older female desert field guide with a weathered face, silver eyebrows and narrow silver braids. Her warm rust, sage, ochre and copper palette matches the painterly desert world. The longer open field coat, irregular botanical field hat, scarf, field pouch/notebook, gloves and boots give her a silhouette distinct from a player standing beside her.

The raw source supplies 20 unique poses. The existing Mara entity, position, name, dialogue, tutorial interaction, idle facing and highlight behavior are preserved. No autonomous wandering or new gameplay behavior was introduced.

## 7. NPC-exclusive assets

`public/assets/characters/npc/mara/desert-mara-poses-v03.webp` is a complete bespoke NPC atlas. It includes Mara's face, hair, hat, coat/vest, scarf, field pouch, gloves and boots. These elements are not creator options. The existing renderer selects the NPC atlas through `npcId: 'mara'`, bypassing player palette and cosmetic layers while sharing scale, frame selection, timing and Phaser rendering.

The public appearance contract still accepts only the existing bounded player indices. No NPC identity or asset URL is accepted from player appearance data. Tests confirm player choices cannot alter Mara's pixels and her silhouettes differ from every supported player geometry in all 20 poses. Minimum measured silhouette difference by direction: south 26.73%, west 18.22%, east 24.00%, north 16.46%. This pixel measure supplements, rather than replaces, visual judgment.

Source prompt: `art-source/CHARACTER_SYSTEM_V21_PROMPTS.md`. Raw source: `art-source/characters/desert-grower-v03/desert-mara-poses-master-v03.png`. Runtime Mara SHA-256: `65db8803d66879334135f12b6bece56a6cf44c824cc48aeb8b46d446a78effbb`.

## 8. Visual combination review results

Run the development-only tool with:

```sh
node scripts/character-review.mjs --exhaustive
```

The tool runs only on `127.0.0.1`; no application or production route imports it. It uses the existing local browser harness. Built client assets were searched and contain no review route/tool markers.

The final review generated eight geometry sheets covering 48 body/hair/hat/accessory configurations and every pose (960 pose examples), eight palette sheets with 288 rendered examples, and a separate 20-pose Mara sheet. Agents inspected all final geometry and palette pages and Mara, including a comparison without name labels.

The exhaustive run actually composed all 6,912 player looks across all 20 poses: 138,240 pose composites. It compared full-atlas alpha hashes against the matching geometry reference across palettes, and checked nonempty poses and transparent margins. A further 138,240 pure composition-plan comparisons passed. There were zero final review errors. This does not mean a human individually inspected every composite.

The deterministic exporter was rerun: all 18 derived V03 asset/metadata files matched their frozen hashes. All 20 runtime modules in `public` and staging `dist` matched the frozen manifest. Runtime assets total 1,572,523 bytes. Decoded RGBA memory is 17.75MiB, up 5.5MiB from V2. A cached world-look atlas remains 560KiB. No per-frame composition, new dependencies, polling or realtime transport was added. Physical-phone frame rate has not been measured.

Local evidence, intentionally ignored by Git:

- `.wrangler/character-v21-work/review-final/`: final geometry, palette and Mara sheets; `review-result.json`.
- `.wrangler/character-v21-work/asset-manifest-final.json`, `art-audit-final.json`, `reproducibility-final.json`.
- `.wrangler/art-direction-work/character-v21-mara-label-free-comparison.png`.
- `.wrangler/character-v21-work/creator-mobile-390x844.png` and short portrait/landscape variants.

## 9. Staging Worker

Guarded `npm run build:staging`, `npm run dry-run:staging` and `CACTIGROW_DEPLOY_CONFIRM=staging npm run deploy:staging` completed successfully for `cactigrow-staging` at `https://dev.cactigrow.com`.

- Active version: `ff80f42e-086c-4998-88a6-5074c73d6b33`, 100%.
- Deployment: `e2dd5a4d-be09-49fd-9a2c-7a1acb62925a`, created `2026-10-07T11:26:43.676849Z`.
- Previous version: `3ac9ff79-6d2b-4739-a3c4-2fb23f475fdb`.
- Client entry: `/assets/index-DismN9xc.js`; CSS: `/assets/index-D1HncV0r.css`.
- World chunk: `LdtkWorldPage-CW7kmvX_.js`.

Authenticated live Chrome reloaded the deployed world and confirmed the new entry/CSS and visible new Mara art beside the existing player at Starting Spawn. The visible account remained Staging Tester 2, Level 7, currency 0, tutorial Step 1. No live name/appearance save, tutorial progression, movement or reset was performed during V2.1. Proof: `.wrangler/character-v21-work/live-staging-final.jpg` and `live-staging-final.json`.

Production was not deployed. Access, DNS, bindings, database schema/grants, authentication, economy and gameplay authority were not changed. An anonymous Access redirect is not claimed as an application health-200 check.

## 10. Tests

All completed suites passed with zero skips:

| Check | Result |
| --- | --- |
| Character rules, motion and new composition tests | 14/14 |
| World Foundation (including real disposable PostgreSQL) | 19/19 |
| Starting Experience (real disposable PostgreSQL and full Chrome creator/tutorial/Farm flow) | 29/29 |
| Focused actual-Chrome mobile creator | 1/1 |
| Actual-Phaser world browser acceptance | 1/1 |
| Worker / minimap / navigation / multiplayer client / realtime / client / menu / reconciliation / chat / Dev Tools regressions | 168/168 |
| Exhaustive actual character composition review | 138,240 poses; zero errors |
| Export reproducibility | 18/18 identical |
| Prior art and locked-world preservation | Passed |

The focused mobile test covered 320x568, 320x844, 360x640, 360x800, 390x664, 390x844, 844x390 and 640x360. Native Chrome CDP touch input verified controls-only scrolling. CDP safe-area overrides verified portrait top/bottom and landscape left/right/bottom edges. Visual-viewport contraction/offset was explicitly simulated on the actual browser viewport object, not a physical iOS keyboard test. Desktop restoration, one save and unmount cleanup passed.

The full Starting flow retained name-first routing, both creator pages, Back choices, authoritative save/refresh persistence, slow-device clock fixture, Mara/tutorial material guidance, real Farm/Nursery/Garden/research/breeding, resets and legacy compatibility. The real Phaser test traversed all 26 physical fixture transitions, checked 48 looks/960 poses and 80 eye checks, and exercised six saved/legacy remote projections and listener cleanup.

`npm run lint`, Worker TypeScript, `npm run worker:types:check`, `npm run build`, `npm run build:staging`, `npm run dry-run:staging` and `git diff --check` passed. The production build was local verification only. Existing Vite bundle-size and PostgreSQL concurrent-query deprecation warnings remain.

Evidence logs and results are under `.wrangler/character-v21-work/`; actual Phaser result is `.wrangler/world-browser/result.json`. `validation-final.json`, `regressions.json`, `inventory-final.json` and `deployment-final.json` provide compact summaries.

## 11. Manual acceptance status

Agent visual review of final sheets, actual mobile Chrome screenshots, full-app fixture screenshots and the live staging world is complete. Human visual acceptance is pending. Do not commit/push or promote to production until the user accepts the visuals.

Remaining human review:

- Physical phone/Safari creator: full screen, safe areas, large preview, easy taps, scrolling and keyboard contraction.
- Both bodies and existing hair/headwear/outfit/accessory choices, with particular attention to faces, hat fit, strap occlusion and moving silhouettes.
- Idle and four-direction walking through normal keyboard, ground tap/click and minimap inputs in Starting Spawn, Farm and Town.
- Mara's female/older field-guide identity and distinct silhouette beside players, without relying on the name label.
- Real-device performance, relogin restoration and a real paired-player Town session. Automated persistence and remote fixtures do not replace these checks.

## 12. Files changed

These paths are relative to the V2.1 start snapshot, not to HEAD. The earlier accepted milestones are already uncommitted and must remain separate from this inventory.

Seven existing paths changed:

```text
PROJECT_CONTEXT.md
package.json
server/starting/startingUiAcceptance.mjs
src/characters/characterArt.ts
src/features/starting/AppearanceSetup.tsx
src/features/starting/starting.css
src/game-world/world.browser.test.mjs
```

Twenty-six paths added:

```text
art-source/CHARACTER_SYSTEM_V21_PROMPTS.md
art-source/characters/desert-grower-v03/desert-mara-poses-master-v03.png
art-source/characters/desert-grower-v03/export-report.json
art-source/characters/desert-grower-v03/prepare-assets.py
docs/CHARACTER_SYSTEM_V21.md
public/assets/characters/npc/mara/desert-mara-poses-v03.webp
public/assets/characters/player/feminine/desert-grower-feminine-foreground-arms-v03.png
public/assets/characters/player/masculine/desert-grower-masculine-foreground-arms-v03.png
public/assets/characters/shared/desert-hair-braid-back-v03.webp
public/assets/characters/shared/desert-hair-braid-front-v03.webp
public/assets/characters/shared/desert-hair-cropped-back-v03.webp
public/assets/characters/shared/desert-hair-cropped-front-v03.webp
public/assets/characters/shared/desert-hair-tied-back-v03.webp
public/assets/characters/shared/desert-hair-tied-front-v03.webp
public/assets/characters/shared/desert-hair-wavy-back-v03.webp
public/assets/characters/shared/desert-hair-wavy-front-v03.webp
public/assets/characters/shared/desert-hat-cap-v03.webp
public/assets/characters/shared/desert-hat-straw-v03.webp
public/assets/characters/shared/desert-satchel-front-strap-v03.webp
public/assets/characters/shared/desert-satchel-pouch-v03.webp
public/assets/characters/shared/desert-satchel-rear-loop-v03.webp
scripts/character-review.mjs
server/starting/creatorViewportAcceptance.mjs
src/characters/characterComposition.test.ts
src/characters/characterFit.generated.ts
src/features/starting/appearanceSetup.browser.test.mjs
```

All 128 previously dirty paths remain present; 121 are byte exact and the seven intended overlap paths are listed above. All 49 prior art records are byte exact, including V01/V02 character sources/runtime and locked world/building art. The original 138,358-byte `PROJECT_CONTEXT.md` prefix is preserved exactly; only the V2.1 ASCII section is appended.

LDtk is byte exact: SHA-256 `4f4313e5dad8c339764d684eba6153069f0ff3b57fa68c9484f8846a089fc04d`, world version `4f4313e5dad8c339`. All 11 Areas' topology, fields, collision and entities match the V2.1 snapshot. The world atlas remains SHA-256 `9b1885ecad13b75562ae687faaebccf8abf25b1b92dfa0acc40520338d9f6393`. Explicit unrelated exclusions remain byte exact: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, `local-ai-benchmark-report.txt`.

## 13. Commit/push status

No staging-index changes, commit, push, reset, clean or history rewrite were performed. HEAD remains `3499e542713c673eef572087a8ed86d46f6bdf37`. The working tree retains the existing milestones and the V2.1 files for manual visual acceptance.


## Accepted staging baseline checkpoint - 2026-10-07

The user accepted this milestone as part of the current staging visual/world development baseline and explicitly authorized committing/pushing the accepted work. This supersedes earlier visual-acceptance and commit/push hold language in this historical implementation report. Outstanding device/performance and other unperformed verification remain documented limitations. See PROJECT_CONTEXT.md, Accepted staging visual/world development baseline. Future development is staging only; no production deployment, database or configuration change is authorized by this checkpoint.
