# Home V1 production asset contract

Status: **LOCKED / HUMAN APPROVED.** The original long Home V1 exterior, `540 × 388.8` runtime scale, registration, and five-rectangle collision passed final human walk-around review. Do not change Home artwork, scale, placement, or collision without a demonstrated gameplay defect or explicit redesign request. Compact V02 was rejected in-game; its design history remains below, but its obsolete files were removed. Nursery V2 remains locked.

## Locked active Home V1

| Property | Approved value |
| --- | --- |
| Production asset | `public/assets/world/farm/home/farm-home-main-v01-long.webp` |
| Runtime display | `540 × 388.8` world units |
| Origin / anchor / baseline | `(0.5, 1)` / `(1500, 800)` / Y `800` |
| Local player | depth `120`, above all Home artwork |
| Main lower body | X `1246–1754`, Y `645–760` |
| Left roof/wing | X `1246–1410`, Y `615–650` |
| Right roof/wing | X `1590–1754`, Y `615–650` |
| Central upper roof/gable | X `1380–1620`, Y `575–650` |
| Chimney | X `1560–1616`, Y `540–590` |

The existing Home door interaction, approach, Farm path, exterior return spawn, and navigation remain unchanged. This small compound of axis-aligned rectangles is a **Home-specific approved exception** to the usual single-rectangle building preference: it prevents the always-on-top local player from appearing to stand in the roof or chimney. It does not establish compound collision as the default for future buildings.

## Farm geometry before V02 integration (historical graybox)

| Item | Current value |
| --- | --- |
| Home world center | `(1500, 650)` |
| Graybox / logical placement footprint | `430 × 300`; bounds X `1285–1715`, Y `500–800` |
| Active physical collider | `430 × 300` centered at `(1500, 650)`; same bounds as the graybox |
| Graybox front door | centered at `(1500, 733)`, `82 × 134`; front threshold approximately `(1500, 800)` |
| Keyboard interaction center / radius | `(1500, 870)` / `165` |
| Current touch selection | `280`-unit radius around Home center `(1500, 650)` |
| Approach point | `(1500, 870)` |
| Path endpoint | `(1500, 870)`; main north/south Farm path terminates there |
| Exterior return spawn | `home-exterior` at `(1500, 870)` |

The former Home graybox visual and `430 × 300` collider have been replaced. The Farm is `3000 × 1900`. Home occupies the north-center of the property, with the Nursery to the northwest, Garden to the northeast, and the central path approaching Home from the south. The existing interaction, approach, path, and return spawn remain unchanged at `(1500, 870)`; the door and approach remain aligned on X `1500`.

## Historical compact V02 geometry proposal (superseded)

The table records the initial V02 proposal, not current runtime geometry. The locked long-house geometry is above. The interaction values in this historical proposal were never activated; the existing Home interaction center/radius and touch selection remain unchanged.

| Item | Proposed value |
| --- | --- |
| Authoritative world center | `(1500, 650)` |
| Logical placement footprint | `430 × 300` centered at `(1500, 650)`; X `1285–1715`, Y `500–800`; non-colliding metadata |
| Physical collider | **one** `400 × 175` rectangle centered at `(1500, 662.5)` |
| Physical collider bounds | left `1300`, right `1700`, rear/top `575`, front/bottom `750` |
| Front door threshold | `(1500, 800)` on the south/front facade |
| Keyboard interaction center / radius | `(1500, 805)` / `90` |
| Touch interaction center / radius | `(1500, 805)` / `140` |
| Automatic-movement approach point | `(1500, 870)`; retained |
| Path endpoint | `(1500, 870)`; retained |
| Exterior return spawn | `home-exterior` at `(1500, 870)`; retained |
| Main sprite runtime display | `500 × 360` world units |
| Sprite origin | `(0.5, 1)`; bottom center |
| Sprite anchor / ground baseline | `(1500, 800)`; canvas bottom at world Y `800` |
| Visible front door target | approximately `92 × 170` world units, with threshold at `(1500, 800)` |
| Local-player presentation | above the entire building at depth `120`; no player grounding shadow |

The proposed collider is narrower and shallower than the placement footprint so the player can walk close to the painted foundation. Its front edge is 50 world units north of the door threshold, matching the successful Nursery V2 principle of allowing a natural position in front of the entrance. The artwork must make that spacing visually credible: the solid ground-contact foundation should cooperate with X `1300–1700`, Y `575–750`, while the doorway and threshold remain readable at Y `800`. The transparent canvas and roof can extend beyond those bounds without creating collision. Do not infer collision from alpha, roof, or canvas bounds. Review the actual painted foundation before activating the proposed collider; if it cannot be matched cleanly, revise the proposal with explicit human approval rather than adding irregular collision bodies.

## Historical compact V02 canvas and design targets

- Locked runtime file: `public/assets/world/farm/home/farm-home-main-v01-long.webp`.
- Production canvas: **1500 × 1080 pixels, RGBA**, exactly 3× the proposed `500 × 360` runtime display. The approved V02 source master retains its native `1478 × 1064` canvas; the runtime path receives the normalized export.
- Compose the entire isolated residence within the transparent canvas. Scale uniformly and preserve aspect ratio. Never stretch width and height independently or crop visible roof, masonry, or threshold.
- Register the door threshold at source `(750, 1080)`, mapping to world `(1500, 800)` when rendered bottom-center. The painted foundation and door threshold should meet the bottom baseline. Keep transparent safety padding at the sides and top, preferably at least 45 source pixels where the silhouette permits; do not force bottom padding beneath the threshold.
- Aim for a visible door about **276 × 510 source pixels** (`92 × 170` world units), readable against the temporary `82 × 128` world-unit avatar. The doorway should comfortably accommodate that avatar and visually echo Nursery V2's approved door/player scale relationship without copying Nursery's overall size.
- Export one complete exterior as lossless WebP with clean alpha and sRGB color intent. No opaque matte, fringe, checkerboard, accidental background pixels, metadata clutter, broad baked cast shadow, or separate building-shadow file.
- The final package is the single locked long-Home WebP. A small foreground occlusion asset is not part of V1; consider one only after a specific tested gameplay need. Do not split the complete building into duplicate layers.

## Original long V01 art measurement and normalization checkpoint

The first-generation source below is the locked production master, and its runtime export is `farm-home-main-v01-long.webp`. The rejected compact V02 files were removed; the comparison and rejection remain documented below.

The supplied `art-source/world/farm/home/home-v1-master.png` is preserved unchanged as the source artwork. It is **1478 × 1064 RGBA**, not the proposed 1500 × 1080 master size. Its raw nonzero-alpha bounds are `1440 × 1045` at `(22, 19)`, leaving 22 px left, 16 px right, 19 px top, and 0 px bottom. Sparse, very low-opacity detached pixels extend to the bottom edge; they are not part of the visible foundation. At a 5% alpha threshold the single connected building occupies `1435 × 754` at `(24, 145)`, leaving 24 px left, 19 px right, 145 px top, and 165 px bottom. This meaningful silhouette has an aspect ratio of approximately **1.903:1**. The visible building itself does not touch the source canvas edge; the raw alpha noise does touch the bottom edge.

The current long-house export is **1500 × 1080 RGBA, lossless WebP with alpha**. Normalization removed only sub-5%-opacity detached alpha noise, cropped to the meaningful building bounds, scaled uniformly to `1410 × 741` within integer pixel rounding, and placed it bottom-center on the 1500 × 1080 canvas. Its nonzero-alpha bounds are `1410 × 741` at `(45, 339)`: 45 px of transparent padding on each side, 339 px above, and **0 px below**. The original master PNG is unchanged (SHA-256 `7c2fd56e18fc1040714b8bece0172efd8d5d6001afc546d079b370896d313890a`).

The first-generation normalization used sprite origin `(0.5, 1)` and anchor `(1500, 800)`. The canvas bottom / visible stone step is the deterministic ground baseline at world Y `800`, not the source PNG's bottom edge. The painted wooden door sill is approximately 35 normalized pixels above that step; the door and entrance are centered near source X `750`. The approximate visible outer door/frame in the master is X `660–825`, Y `570–862` (about `165 × 292` px), measured visually; this is an estimate, not a segmentation-derived exact rectangle. After normalization it is roughly `162 × 287` px. Its bottom is near normalized Y `1045`, while the integrated stone step reaches Y `1080`.

**Approved scale, collision under review:** The long house increased uniformly by 8% from `500 × 360` to **`540 × 388.8`**. Human in-game review approves this size. Origin `(0.5, 1)` and anchor/baseline `(1500, 800)` remain fixed. Its normalized door is approximately **58 × 104 world units** beside the `82 × 128` player. The meaningful building spans approximately `508 × 267` world units, with visible side foundation edges near X `1246–1754`. The prior single provisional collider spanned X `1246–1754`, Y `645–755`, size `508 × 110`, center `(1500, 700)`. Human review found that shallow body allowed the depth-120 player to appear on top of the roof and chimney while walking behind Home. Keep the approved scale and use the intentional Home-only compound exception below; no depth sorting, roof occlusion, or new art layer is involved.

### Locked Home-only compound collision

Five simple axis-aligned static Arcade rectangles overlap to block the solid body, roof masses, and chimney while retaining the previous front and side clearance. This is an intentional, human-approved Home exception to the Building Art Standard's usual single-rectangle preference because the local player always draws above building art.

| Region | Bounds | Center | Size |
| --- | --- | --- | --- |
| Main lower body and front foundation | X `1246–1754`, Y `645–760` | `(1500, 702.5)` | `508 × 115` |
| Left roof/wing | X `1246–1410`, Y `615–650` | `(1328, 632.5)` | `164 × 35` |
| Right roof/wing | X `1590–1754`, Y `615–650` | `(1672, 632.5)` | `164 × 35` |
| Central upper roof/gable | X `1380–1620`, Y `575–650` | `(1500, 612.5)` | `240 × 75` |
| Chimney | X `1560–1616`, Y `540–590` | `(1588, 565)` | `56 × 50` |

These rectangles form continuous overlap, without pixel-derived or stair-step collision. Final human walk-around approved all five bodies, including the main-body front edge at Y `760` and chimney top at Y `540`. The door threshold remains near `(1500, 800)` and approach/return remains `(1500, 870)`. The outer side bounds remain X `1246–1754`. `?worldDebug` derives labels from each active rectangle and retains sprite, interaction, approach, and spawn markers.

## Compact V02 candidate and production normalization (rejected in-game)

Human visual review initially approved the compact V02 candidate's design direction. Its source and copied master matched SHA-256 `31c886e7d779083295f6e3c39ca975425cb6ad9f531f80ddf90fced9ce739f08`. Subsequent in-game review rejected this version because the building felt too small and its door too large. Its intermediate source, copied master, and normalized export were removed after the original long Home was locked; these measurements remain historical design evidence.

The V02 PNG is `1478 × 1064`, sRGB RGBA. Raw nonzero alpha spans `1362 × 970` at `(0, 63)`, indicating faint detached pixels reach the left edge and bottom area. At a 5% alpha threshold the single meaningful building spans `1212 × 915` at `(133, 71)`, aspect ratio `1.3246:1`, with transparent margins L `133`, R `133`, T `71`, B `78` pixels. The meaningful silhouette touches no canvas edge. Only sub-5%-opacity alpha noise was removed for production; visible color and artwork were not changed.

Visual pixel inspection estimates the actual wooden door leaf at approximately X `632–849`, Y `553–948`, or **217 × 395 source pixels**. That is about **17.9%** of meaningful building width and **43.2%** of its height. The larger trimmed architectural opening/frame is roughly X `599–879`, Y `523–950`, or **280 × 427 pixels** (23.1% width, 46.7% height). These are hand-measured boundaries rather than exact segmentation; the frame, glass upper panel, and stone sill make a single numeric door rectangle approximate.

Displaying the compact V02 source directly at `500 × 360` would make the wooden leaf about `73 × 134` world units and its outer frame about `95 × 144`. The normalized V02 export fills more of the canvas uniformly: its `1212 × 915` meaningful crop becomes `1351 × 1020` within integer rounding, a scale of approximately `1.115`. At `500 × 360`, the wooden door is therefore about **81 × 147** world units and its architectural frame about **104 × 159**. These calculations explain the earlier normalization decision; human in-game review subsequently rejected the compact building and its oversized-looking door.

The now-deleted compact V02 production export was a `1500 × 1080` lossless WebP with alpha. Its nonzero-alpha bounds were `1351 × 1020` at `(74, 60)`, leaving L `74`, R `75`, T `60`, B `0`. The foundation/step met the bottom-center canvas baseline, origin `(0.5, 1)`, proposed anchor `(1500, 800)`. Resizing was uniform; the one-pixel width rounding was under 0.1% and no meaningful pixels were clipped. The stone step was the ground baseline; the wooden sill was slightly above it. No separate shadow, effects, or new scene layers were added.

The compact V02 runtime test used a meaningful building span of about **450 × 340 world units** with starting collider X `1300–1700`, Y `575–750`. This is historical V02 test geometry; the active long-house test uses the wider collider described above. Door/threshold X `1500`, Y approximately `800`, with approach and return at `(1500, 870)` remain aligned.

## Historical image-generation brief: Home V1 main exterior

> **THIS IS A GAME-WORLD BUILDING ASSET, NOT A STANDALONE ISOMETRIC ILLUSTRATION.** Create one complete exterior of a small upgraded desert home belonging to a cactus grower, isolated on a genuinely transparent background. Follow the approved CactiGrow Nursery V2 production art as the visual-quality, scale-readability, lighting, and clean-registration benchmark, but make this a believable residence, not a greenhouse.
>
> Use stylized hand-painted 3D with clean semi-cartoon forms, medium environmental detail, mature and cozy character, tactile natural materials, warm natural desert light from the upper left, restrained texture noise, and a simple readable silhouette at mobile/world zoom. Show a warm stucco/adobe or similar desert-appropriate exterior, restrained timber accents, a clear stone or masonry foundation, a few readable windows, and subtle integrated cactus-grower personality. A modest built-in porch or threshold is acceptable only if it preserves the single rectangular ground-contact shape and clear walk-around space. Do not use childish proportions or a giant roof overhang.
>
> Match CactiGrow's fixed elevated three-quarter camera, approximately 35 degrees downward with mild perspective and no camera rotation. The residence faces primarily forward/south toward the player. Keep the front facade and foundation mostly horizontal, the footprint plainly rectangular, and side-wall perspective restrained. Do not make a dramatic diagonal or strongly isometric building.
>
> Place one clearly visible, centered south-facing front door whose threshold is at the bottom-center registration point of the transparent canvas. Design its visible size for approximately `92 × 170` world units beside an `82 × 128` reference avatar. Design the solid foundation so it can be protected by one rectangular physical collider near world X `1300–1700`, Y `575–750` when the complete sprite is displayed at `500 × 360` world units, bottom-center origin `(0.5, 1)`, and anchor `(1500, 800)`. The invisible `430 × 300` placement footprint is metadata, not a painted tile, slab, or collision boundary. Leave safe transparent padding around the roof and sides without shrinking the building into an unreadable object.
>
> Deliver the isolated building only: transparent background; **no terrain, path, landscaping, cactus clumps, rocks, grass, signs, text, labels, cast shadow, detached props, people, UI, border, or environment backdrop.** No separate roof, glass, foreground, or shadow layer. The main asset must look complete by itself.

## Acceptance checklist

### Visual

- [x] Human review approves the long Home as a mature desert residence at in-game scale beside Nursery V2.
- [x] South-facing facade, clear door, connected foundation, and walkable sides passed final walk-around.
- [x] Five simple compound collision bodies prevent walking through the lower house, roof, gable, and chimney.
- [x] No baked terrain, path, detached cast shadow, or duplicate building layer.

### Technical

- [x] Original long source is preserved; its `1500 × 1080` lossless WebP export has true alpha and no clipped meaningful pixels.
- [x] Uniform runtime display is `540 × 388.8`, origin `(0.5, 1)`, anchor `(1500, 800)`.
- [x] Door threshold registers to world `(1500, 800)`; path endpoint and exterior spawn stay `(1500, 870)`.
- [x] Artwork, five active collider bodies, and door passed human `?worldDebug` walk-around.
- [x] Integration retains local-player depth `120`, debug physics geometry, independent collision, movement, camera, interactions, and other Farm locations.

The original long Home V1 asset, runtime scale, registration, and compound collision are locked following human in-game review. The rejected compact V02 decision remains documented; its obsolete files were removed.
