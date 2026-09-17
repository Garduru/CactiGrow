# Home V1 production asset contract

Status: **proposed art and geometry contract; not approved for runtime integration.** Home remains a Farm graybox until its artwork and walk-around geometry pass human review. Nursery V2 is the locked production benchmark for quality, registration, readability, and the review workflow, not a template for Home dimensions or greenhouse features.

## Existing Farm geometry (current runtime)

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

The current graybox collision, interaction, path, and return spawn remain unchanged in this contract-only pass. The Farm is `3000 × 1900`. Home occupies the north-center of the property, with the Nursery to the northwest, Garden to the northeast, and the central path approaching Home from the south. Keep the door and approach aligned on X `1500`. Do not bake the path or surrounding property into the sprite.

## Proposed Home V1 production geometry

These values define the **art target for review**, not active Phaser values. Any change from the graybox to this geometry requires a separate authorized integration and walk-around pass.

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

## Main asset canvas, registration, and export

- Production file: `public/assets/world/farm/home/farm-home-main-v01.webp`.
- Source/master canvas: **1500 × 1080 pixels, RGBA**, exactly 3× the proposed `500 × 360` runtime display. Keep a layered working master outside the runtime asset folder; the runtime path receives only the normalized export.
- Compose the entire isolated residence within the transparent canvas. Scale uniformly and preserve aspect ratio. Never stretch width and height independently or crop visible roof, masonry, or threshold.
- Register the door threshold at source `(750, 1080)`, mapping to world `(1500, 800)` when rendered bottom-center. The painted foundation and door threshold should meet the bottom baseline. Keep transparent safety padding at the sides and top, preferably at least 45 source pixels where the silhouette permits; do not force bottom padding beneath the threshold.
- Aim for a visible door about **276 × 510 source pixels** (`92 × 170` world units), readable against the temporary `82 × 128` world-unit avatar. The doorway should comfortably accommodate that avatar and visually echo Nursery V2's approved door/player scale relationship without copying Nursery's overall size.
- Export one complete exterior as lossless WebP with clean alpha and sRGB color intent. No opaque matte, fringe, checkerboard, accidental background pixels, metadata clutter, broad baked cast shadow, or separate building-shadow file.
- The default package is this **single** `farm-home-main-v01.webp`. A small foreground occlusion asset is not part of V1; consider one only after a specific tested gameplay need. Do not split the complete building into duplicate layers.

## Exact image-generation brief: Home V1 main exterior

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

- [ ] Human review confirms Home feels like a mature, cozy cactus-grower's desert residence in the locked CactiGrow style, at close and mobile/overview zoom.
- [ ] Facade faces south, foundation reads mostly horizontally, and restrained perspective leaves obvious walkable sides.
- [ ] Complete building and its roof fit inside the transparent canvas; the front door is clear, centered, and properly scaled against the avatar and approved Nursery V2 door reference.
- [ ] Visible foundation cooperates with the proposed single physical collider; the player can stand close to the sides and directly in front of the door without appearing to enter solid masonry.
- [ ] No baked terrain, path, landscaping, text, detached props, cast shadow, or duplicate building layer.

### Technical

- [ ] Source canvas is exactly `1500 × 1080` RGBA; export decodes as lossless WebP with true alpha and no clipped visible pixels.
- [ ] Uniform scale preserves source aspect ratio; runtime display is `500 × 360`, origin `(0.5, 1)`, anchor `(1500, 800)`.
- [ ] Door threshold registers at source `(750, 1080)` / world `(1500, 800)`; path endpoint and exterior spawn stay `(1500, 870)`.
- [ ] Artwork, proposed collider, and door are checked together in `?worldDebug` and by human walk-around before replacing the graybox.
- [ ] Future integration retains local-player depth `120`, debug physics geometry, independent collision, movement, camera, interactions, and other Farm locations.

No artwork, runtime asset, Phaser integration, or collider change is authorized by this document alone.
