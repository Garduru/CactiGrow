# Homepage redesign and menu cleanup

Released 2026-10-05 from current main `62f526d674514a120c026a34847d8d78913fa78f` plus the scoped working-tree changes below. Existing Chat/Mail V2 production acceptance was confirmed by the user and the live production deployment history; no older baseline was used.

## Menu

Removed only Menu → Other → Visit CactiSwap. Other retains Help, Settings, Sign Out (existing confirmation), Developer Tools (development/staging only), and Admin Tools (existing authorized-staff permission gate). There is no leftover separator or spacer. Existing Farm/Town host, player position, session and presence tests pass. No CactiSwap integration internals changed. The existing logo retains its embedded credit.

## Homepage and exact copy

Flow: hero, four pillars, specimen/genetics showcase, world teaser, social teaser, final Play CTA, footer. Removed the placeholder The game anchor. Header contains logo and a modest Play CactiGrow link; hero and final section share the dominant Play CactiGrow button style. All Play links target `/play` and preserve explicit local query options.

Hero: **Grow a collection. Build a legacy.** Supporting copy: “Raise unique cactus specimens, uncover their genetics, build your Farm, and explore a growing online world.” Supporting line: “Your Farm is only the beginning.”

| Pillar | Copy |
| --- | --- |
| Cultivate | Plant seeds, raise individual cactus specimens, and build a collection that stays with you. |
| Research | Study your specimens to uncover traits, understand their genetics, and find breeding potential. |
| Explore | Walk your Farm, follow the road to Town, and find your place in a world that is growing. |
| Connect | Meet other growers, make friends, chat, and keep in touch through Mail. |

**Every specimen has a history.** This section explains physical specimen identity, species, genetics, clone lines, parent lineage for bred specimens, permanent clone-line research knowledge, Favorites, Garden organization and parent selection. It uses actual Mature San Pedro game artwork and centralized species names, without inventing a screenshot, player record, numerical genetic result or research state.

**Take the road into Town.** Mentions the Nursery, Garden, Lab, Town, Shop and Marketplace. Farm and Town are described as the beginning of a growing world; no completed future Zones/Areas, expeditions or Farm visits are promised.

**A familiar name. A new friend.** Mentions profiles, Friends, Local/Town/World chat, online DMs and persistent Mail with seeds, currency or eligible specimens attached. Direct trade is not advertised as implemented.

Final: **What will you grow?** “Your first specimen is the start of your story.” Footer: “An independent cactus-growing game.”

## Presentation and assets

Preserves near-black/dark brown surfaces, terracotta CTA, tan text, cactus-green details, serif headings and game-inspired borders. Artwork/text alternate with restrained spacing, dividers and panels. Below 700px the hero, specimen/world and social sections stack. Pillars use four desktop columns, two tablet columns and one below 380px. The specimen explanation comes before its art on phones.

| Website file | Reused game artwork | Size |
| --- | --- | --- |
| `public/assets/website/nursery-v01.webp` | Nursery V2 `farm-nursery-greenhouse-main-v02.webp` | 82,608 bytes |
| `public/assets/website/town-shop-v01.webp` | Town Shop V1 `town-shop-main-v01.webp` | 139,058 bytes |
| `public/assets/website/san-pedro-v01.webp` | Mature Normal `plant-echinopsis-pachanoi-mature-base-v01.webp` | 23,882 bytes |

These are website-only WebP exports made with the installed ImageMagick: proportional downscale, metadata stripping and quality 86–88. The Nursery export removes only transparent surrounding canvas to avoid a large empty hero area. Game/source files and all locked sprite registration, scale, collision and navigation remain unchanged. The original three runtime assets total 2,855,052 bytes; website copies total 245,548 bytes (about 91% smaller). Hero loads with high priority; lower artwork is lazy loaded with intrinsic dimensions. Existing `/cactigrow-logo.png` is reused unchanged. No new dependencies, stock imagery or generated art.

## Files changed

- `src/components/layout/UtilityMenu.tsx`: remove the one external link.
- `src/features/website/OfficialHomePage.tsx`: homepage structure, copy, art and Play links.
- `src/features/website/website.css`: scoped responsive presentation.
- `src/app/websiteRouting.test.ts`: updated page/CTA checks; SSR-only snapshot adapter for existing browser-only chat history.
- `src/features/menu/gameMenu.runtime.test.ts`: verify exact remaining Other entries and no external link.
- `public/assets/website/{nursery,town-shop,san-pedro}-v01.webp`: optimized artwork exports.
- `PROJECT_CONTEXT.md`: correct stale Chat/Mail production hold, menu inventory and release record.
- `docs/HOMEPAGE_REDESIGN.md`: this report.

No gameplay, social/Mail, Admin/Dev internals, RBAC/auth, server/shared code, schema, movement, Shop/Marketplace, genetics, breeding, HUD reconciliation or viewport-restoration implementation changed.

## Validation

Passed:

- `npm run build:staging` and `npm run build` (production).
- `npm run lint`, `npm run worker:types:check`, `git diff --check`.
- `npm run test:website`: 2.
- `npm run test:menu`: 8, including retained Farm/Town host/session/presence and input boundaries.
- `npm run test:chat`: 12, including actual Worker/DO Local/Town/World/DM routing and isolation.
- `npm run test:devtools`: 6, including actual menu/provider gates across four build modes.
- Production Admin menu/panel staff visibility test: 1.
- Live HUD authority reconciliation regression tests: 6.
- Both staging/production Admin viewport tests: 2, rerun with the installed Chrome executable; no skips in this rerun.
- Mail contract tests: 2. The unchanged Mail SQL integration skipped because its isolated database module environment was not configured; this is not new live Mail acceptance.
- Actual headless Chromium, production-shaped local build and live production at widths 320, 360, 390, 700, 850, 1440: no document/internal horizontal overflow, all three art images and logo decode, six sections render, hero CTA visible, Play click navigates to `/play`, no homepage API requests or JS exceptions. Desktop/mobile screenshots inspected for hero, specimen, world/social and final sections.
- Live production `/` and `www` load; health 200; anonymous bootstrap/social/Mail/admin reads 401; Dev Tools 404. All 12 checked HTML/CSS/JS/logo/homepage asset responses match the production build by SHA-256.

The existing large-chunk warning remains. No authenticated browser session was available via the browser tools, so live staging UI/menu acceptance and new authenticated production gameplay acceptance are not claimed. Existing integration/DOM tests verify the menu gates and lifecycle preservation. Physical iPhone/Safari acceptance remains manual.

## Releases and Git

Staging first, using fresh staging assets and guarded `npm run deploy:staging`: **637ebb2f-94c1-4465-9b11-9cc740c0abac**. Previous staging version: **83f39699-2a0c-4194-a708-6647bbc8c901**. Anonymous homepage, `/play`, `/nursery`, health and V1/V2/V3 projection probes still return 302 to the existing Access team domain; this confirms protection, not authenticated page acceptance.

Production after local/staging validation, using a separately validated production-mode build of the same source and guarded `npm run deploy:production`: **efdb925c-176c-41cb-ba9b-44303a26448d**. Previous accepted V2 version: **6ad899c7-c470-4909-9dc1-86a87074367b**. The same source/art/CSS is used; environment build flags intentionally preserve production Dev Tools exclusion and authentication behavior. Existing bindings/auth/DNS remain unchanged; no migration or grants were run.

Base commit: **62f526d674514a120c026a34847d8d78913fa78f**. `HEAD...origin/main` was **0 / 0** at preflight. These changes remain uncommitted; no new commit or push was explicitly instructed, and neither was performed. Deliberately preserved/excluded unrelated untracked files: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, `local-ai-benchmark-report.txt`. Validation scripts, screenshots and deployment/hash logs are in ignored `.wrangler/`.

Intentionally deferred: physical-device testing, new authenticated live menu/gameplay acceptance, unimplemented world content, direct trading and any gameplay/system redesign.
