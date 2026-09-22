# Town Marketplace / Exchange V1 production asset contract

Status: **HUMAN APPROVED / LOCKED.** The human-supplied master, lossless production WebP, sprite registration, two-rectangle collision, interaction, approach, and Town return passed in-game World Editor tuning. Do not retune Marketplace V1 without an explicit future revision. Shop V1 and the locked Farm exteriors remain unchanged.

## Role and relationship to Shop

The Marketplace / Exchange is Town's physical destination for player-to-player commerce and asynchronous listings. The existing React `/market` interface owns browsing, buying, listing, and market workflows; the Phaser exterior is navigation and presentation, not commerce authority. It is distinct from synchronous Direct Trade. Do not depict invented active listings, buyers, transactions, prices, or player-owned specimens as permanent scenery.

The locked Shop V1 is a smaller, intimate cactus-growing supply storefront for one merchant. Marketplace V1 should feel like a broader, more important community trading institution in the same Southwestern Town. Its extra presence comes mainly from frontage and additional bays, not a much taller roof or larger human-scale fittings. The locked Shop displays at `477.8638941398865 × 340` world units; both buildings must remain believable beside the same approximately `82 × 128` player.

## Authoritative current graybox reference

These were the authoritative graybox values before production integration. They are historical and must not override the approved runtime contract below. The graybox building visual is disabled when the WebP texture loads.

| Current Town property | Value |
| --- | --- |
| Town world | `2200 × 1500` |
| Graybox visual center / size | `(1510, 380)` / `570 × 270`; bounds X `1225–1795`, Y `245–515` |
| Graybox foundation strip | center `(1510, 491)`, size `570 × 48` |
| Graybox door | center `(1545, 447)`, size `88 × 136`; bottom Y `515` |
| Physical collider | one rectangle centered `(1510, 410)`, size `540 × 205`; bounds X `1240–1780`, Y `307.5–512.5` |
| Interaction | center `(1545, 530)`, keyboard radius `110` |
| Pointer/touch selection | radius `270` around the interaction center |
| Approach and Town path endpoint | `(1545, 590)` |
| `marketplace-exterior` return spawn | `(1545, 590)` |
| Destination | `/market`; contextual return brings the player to Town |

The graybox visual rectangle is not a logical placement footprint and must not become collision by inference. No separate logical Marketplace placement footprint is authored yet. Its historical path branched to `(1545, 590)`; the approved path endpoint is `(1510, 590)`.

## Production visual direction

Create **one complete, isolated game-world building sprite**: a substantial permanent Southwestern adobe/stucco trading hall with a broad, mostly horizontal facade, timber beams, terracotta and stone details, and a low coherent foundation. A covered front arcade or shallow veranda with several readable arches or bays should suggest multiple traders and community exchange. Keep the building itself dominant. Integrated restrained pottery, crates, parcel boxes, baskets, merchant shelving, specimen display shapes, and perhaps a simple community listing board may support the story, but they must stay attached to or immediately against the structure. Listing-board papers may be abstract; do not invent legible listing details.

Use CactiGrow's locked stylized hand-painted 3D style: clean semi-cartoon forms, medium environmental detail, tactile materials, believable simplified construction, warm upper-left desert daylight, restrained texture noise, slightly exaggerated game-readable proportions, and a clear mobile/overview silhouette. Keep the Shop's material and architectural language while giving the Marketplace a broader civic-commercial identity. It must not read as a mall, bank, modern stock exchange, warehouse, second Shop, greenhouse, laboratory, residence, medieval fantasy bazaar, or tent field.

## Camera, facade, entrance, and signage

Follow Building Art Standard V2: fixed elevated game view approximately `35°` downward, south/front-facing facade, visible roof depth, shallow building depth, and **very restrained side perspective**. The frontage should read nearly horizontally. Avoid the pronounced diagonal/isometric angle that required revision during Shop production. This is a game-world building sprite, not a standalone architectural illustration.

The approved artwork has an obvious near-centered entrance with a clear threshold and unobstructed approach. The former graybox interaction X `1545` was not retained; the approved interaction is centered at X `1510`. Keep the entrance usable beside the `82 × 128` player and the locked Shop.

Integrate one physical, game-readable sign bearing the exact word **MARKET**. Mount or paint it as part of the architecture, preferably above the main entry. Avoid floating UI, unreadable small text, stock tickers, prices, dollar/crypto symbols, and repeated labels.

## Asset package and transparency

| Asset | Proposed path / rule |
| --- | --- |
| Preserved source/master | `art-source/world/town/marketplace/marketplace-v1-master.png` |
| Production main | `public/assets/world/town/marketplace/town-marketplace-main-v01.webp` |
| Recommended source canvas | landscape `2100 × 1050` RGBA, approximately 3× the proposed runtime envelope; adjust the canvas if generation requires it, preserving useful transparent padding and the full uncropped building |
| Default package | one complete main exterior; no separate roof, facade, awning, foreground, prop, or shadow asset |
| Export | genuinely transparent source; production lossless WebP with alpha after inspection and proportional normalization |

Include the whole roof, sign, side walls, covered frontage, attached displays, and foundation with safe transparent margins. Keep the ground-contact baseline close to the bottom of the canvas, without arbitrary empty space below it. Do not crop visible art or stretch it to fill both canvas dimensions. No sky, horizon, terrain card, colored or black matte, dirt plane, long path, road, detached stall field, or environment backdrop. No separate building shadow and no broad baked directional cast shadow; slight immediate contact/foundation shading within the building is acceptable. Town terrain, paths, and larger landscaping remain separate world art.

## Integrated master and production asset

| Property | Current value |
| --- | --- |
| Preserved master | `art-source/world/town/marketplace/marketplace-v1-master.png`; SHA-256 `0A45FBE587C9DE236E10581B6B3EE48605690D204F8617C6AFA2031AA149EECB` |
| Master dimensions / channels | `1774 × 887`, sRGB RGBA; 2:1 canvas aspect ratio |
| Raw nonzero-alpha bounds | `1726 × 866` at `(28, 21)`; right margin `20`, bottom margin `0` for faint alpha pixels |
| Meaningful bounds at 5% alpha | `1718 × 706` at `(31, 88)`; right margin `25`, bottom margin `93` |
| Alpha/background inspection | Transparent corners and surrounding canvas; no materially visible baked backdrop. Faint fringe alpha at the bottom edge is not meaningful building art. |
| Production asset | `public/assets/world/town/marketplace/town-marketplace-main-v01.webp`; texture key `town-marketplace-main-v01` |
| Production format | Lossless WebP with alpha, full unchanged `1774 × 887` canvas; no crop, repack, resize, recolor, or added shadow. ImageMagick decoded-pixel comparison to master: AE `0`. |
| Runtime display | `700 × 350` world units, exactly proportional to the 2:1 source canvas |
| Approved origin / canvas anchor | `(0.5, 1)` / `(1510, 515)` |
| Building / local-player depth | `40` / `120` |
| Asset layers | One complete main exterior; no separate shadow or foreground layer |

The human-supplied master remains untouched. Its visible foundation sits above the lower transparent canvas margin, so the canvas anchor is not the painted foundation's exact ground-contact Y. The full-canvas conversion preserves every source pixel, including low-alpha edge pixels.

## Human-approved runtime geometry

The approved production display is `700 × 350` world units, origin `(0.5, 1)`, anchor `(1510, 515)`, depth `40`. It preserves the source canvas's 2:1 ratio exactly. The canvas spans X `1160–1860`, Y `165–515`; transparent bottom padding places the painted foundation above the canvas baseline. The local player remains at depth `120`.

Marketplace V1 intentionally uses **two human-approved rectangular colliders**, independent of the transparent canvas. Their stable IDs are authoritative; do not retain World Editor timestamp-generated IDs.

| Collider | Center | Size | Bounds |
| --- | --- | --- | --- |
| `main-lower-structure` — broad lower/main structure | `(1511, 365)` | `666 × 205` | X `1178–1844`, Y `262.5–467.5` |
| `upper-central-structure` — narrower upper center | `(1510, 243)` | `312 × 60` | X `1354–1666`, Y `213–273` |

The approved interaction is `(1510, 468)` with radius `213`; pointer/touch selection radius remains `270`. The approach and Town path endpoint are `(1510, 590)`, and the `marketplace-exterior` return spawn is `(1510, 590)`, south of both colliders. The Marketplace opens `/market` and contextually returns to Town. `?worldDebug` shows both colliders, sprite bounds/anchor, interaction, approach, return, and label. `/town?worldEdit` still exposes temporary geometry previews, including both named colliders; drafts do not change this locked source contract. The graybox building visual appears only as a fallback if the texture is unavailable. Shop V1 and Road to Farm retain their locked/current values.

## Production acceptance record

- Complete uncropped transparent building with no visible background matte, terrain, path, or broad cast shadow.
- Clearly broader trading-hall silhouette than Shop, with compatible human-scale doors, windows, props, and architecture.
- Nearly front-facing south facade under a gentle elevated `35°` view; visible roof volume without dramatic diagonal perspective.
- Centered or nearly centered clear entrance and exactly one legible integrated **MARKET** sign.
- Restrained attached trading details; no detached stall field, fake listings, prices, people, or UI.
- Broad lower/main structure and narrower upper center protected by the two approved rectangular colliders.
- Source master preserved; exported lossless WebP alpha, aspect ratio, full visible bounds, and decode verified before integration.
- Human World Editor walk-around approved the scale, collision, entrance interaction, approach, return spawn, and relationship to Shop V1. Further retuning requires an explicit Marketplace revision.
