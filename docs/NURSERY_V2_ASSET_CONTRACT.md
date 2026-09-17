# Nursery V2 production asset contract

Status: **locked, human-approved production exterior benchmark.** The main asset is integrated into the canonical Farm; its artwork, scale, registration, active collider, door/player relationship, interaction, path, return spawn, player-over-building depth, and shadow-free presentation have passed walk-around review. Do not resume visual micro-tuning without an actual gameplay defect or explicit redesign request. The active collision remains visible under `?worldDebug` for diagnostics.

Nursery V2 is the first building produced under the CactiGrow Building Art Standard V2. **This is a game-world building asset, not a standalone isometric illustration.** Gameplay geometry is already approved; the artwork must conform to it.

## Approved world geometry

| Contract | Approved value |
| --- | --- |
| Building center | `(650, 390)` |
| Logical placement footprint | `560 × 260`, non-colliding |
| Physical player collider | `500 × 150` centered at `(650, 420)` |
| Door | `(680, 520)` |
| Interaction center | `(680, 525)` |
| Keyboard radius | `90` |
| Touch radius | `140` |
| Approach point | `(680, 550)` |
| Path endpoint | `(680, 555)` |
| Main exterior display | `620 × approximately 430` world units |
| Main exterior origin | `(0.5, 1)` |
| Main exterior anchor / ground baseline | `(650, 520)` |
| Door visual target | approximately `92 × 170` world units |
| Lighting and grounding | upper-left key; restrained foundation-edge shading in the main asset |

The `560 × 260` logical placement footprint reserves property space only. It is not the visible building foundation and never blocks the player. The physical stone foundation represented in the painting must correspond closely to the `500 × 150` collider centered at `(650, 420)`. Walls, roof, restrained perspective, and transparent canvas may extend upward or outward without changing collision.

## Locked visual direction

- Stylized hand-painted 3D in the approved CactiGrow style.
- Clean semi-cartoon forms, medium environmental detail, restrained texture noise, and mature/cozy presentation.
- Compatible with the fixed elevated camera at approximately 35 degrees downward.
- Long rectangular greenhouse with its front/south facade facing primarily toward the player.
- Long facade reads mostly horizontally across the screen with restrained perspective.
- No dramatic diagonal or isometric orientation.
- Substantial low stone foundation with a clean, mostly horizontal front ground edge.
- Warm timber frame and dark metal brackets/connectors.
- Translucent greenhouse glass, visible glass roof, operable roof vents, and practical ventilation fan.
- Warm hanging grow/work lights.
- Organized wooden grow benches integrated inside the greenhouse.
- Young San Pedro as the taller vertical plant forms.
- Young Peyote in organized trays as smaller globular forms.
- Terracotta pots and trays integrated into the interior.
- Human-scale wooden/glass front door slightly right of center.
- Clean silhouette readable at mobile exploration and property-overview zoom.
- Warm natural desert lighting from upper-left with restrained cool glass notes.

The main exterior must already read as one complete glass greenhouse. Do not split it into two complete base and glass buildings. Do not rely on a foreground layer to complete the facade, glazing, foundation, or roof.

## Excluded content

The main exterior contains no baked terrain, path, rocks, grasses, agaves, decorative landscaping, signs, text, labels, or detached exterior props. Interior benches, pots, trays, plants, lights, and ventilation equipment are part of the greenhouse and may be included. Exterior environmental assets are produced and placed separately.

## Default asset package

1. `farm-nursery-greenhouse-main-v02.webp` — complete greenhouse exterior, including its finished glazing, visible integrated interior, and restrained immediate foundation grounding.

No foreground asset is required initially. A future `farm-nursery-greenhouse-foreground-v02.webp` may be authorized only if gameplay testing proves that a small, specific roof lip, lintel, or similar region needs selective foreground occlusion. It must contain only those pixels and never duplicate the complete building.

## Main exterior canvas and registration

The approved `farm-nursery-greenhouse-main-v02.webp` is now loaded as one Phaser sprite. Its normalized 1860 × 1290 transparent lossless WebP canvas displays at exactly 620 × 430 world units with origin `(0.5, 1)`, anchor `(650, 520)`, and baseline Y `520`. The visible alpha bounds are 1740 × 766 at source `(60, 524)`; runtime placement uses full-canvas registration, not the alpha bounds. The sprite renders beneath the local player. No separate shadow, glass, or foreground layer is loaded. The independently authored active collider is one 540 × 145 rectangle centered at `(665, 382.5)`, with bounds X `395–935` and Y `310–455`. The right edge remains at X `935`; the door approach at `(680, 550)` remains south of the front edge. The earlier 500 × 150 geometry target in the table remains a reference, not the active collider. `?worldDebug` shows the active collider's exact bounds for walk-around verification.

| Property | Contract |
| --- | --- |
| Filename | `public/assets/world/farm/nursery/farm-nursery-greenhouse-main-v02.webp` |
| Recommended source canvas | `1860 × 1290` pixels, RGBA; approximately 3× the `620 × 430` runtime target |
| Runtime display | `620 × 430` world units unless final alpha inspection justifies a very small height correction |
| Origin | `(0.5, 1)` |
| Anchor | `(650, 520)` |
| Ground baseline | source canvas bottom edge maps to world Y `520` |
| Door registration | door threshold/ground position at world `(680, 520)`; source-space horizontal center approximately X `1020`, with the threshold on the bottom baseline |
| Foundation target | visible physical ground contact corresponds closely to the `500 × 150` collider centered at `(650, 420)` |
| Alpha | true transparency; no matte, baked background, checkerboard, halo, or opaque corner pixels |

Reserve at least 60 source pixels of transparent safety at the left, right, and top where the silhouette permits. The physical foundation/threshold must meet the bottom baseline rather than float above transparent padding. Keep antialiasing inside the canvas and inspect the outermost pixels for clipping or color fringe. Roof and restrained side-wall perspective may extend beyond the logical or collision footprint inside the transparent canvas.

## Export requirements

- Export the main asset as WebP with alpha in the sRGB color space.
- Use lossless WebP for the first production delivery, including lossless alpha.
- Strip unnecessary EXIF, XMP, thumbnails, and editor metadata while retaining the ICC/sRGB color intent needed for consistent browser display.
- Preserve straight, clean transparent edges without a white, black, or colored matte.
- Keep the layered source master outside the runtime folder; the runtime folder receives normalized exports only.
- Do not resize or crop the normalized main asset after anchor approval without updating this contract and registration together.

## Exact image-generation brief: Nursery V2 main exterior

> **THIS IS A GAME-WORLD BUILDING ASSET, NOT A STANDALONE ISOMETRIC ILLUSTRATION.** Create one complete Level 1 cactus greenhouse exterior for CactiGrow as a transparent-background production sprite. Use stylized hand-painted 3D with clean semi-cartoon forms, medium environmental detail, warm natural desert lighting, believable simplified construction, restrained texture noise, mature cozy presentation, and a clean readable mobile-scale silhouette.
>
> The asset must be compatible with a fixed elevated three-quarter game camera looking downward at approximately 35 degrees with mild perspective and no camera rotation. The greenhouse must face primarily forward/south toward the player. Compose a long rectangular greenhouse whose front facade reads mostly horizontally across the image. The rectangular ground footprint must be immediately understandable and easy to align with simple gameplay collision. **Do not create a dramatic diagonal or standalone isometric composition.** Do not rotate the entire greenhouse so its long footprint runs diagonally across the canvas.
>
> Paint a substantial low stone foundation whose physical ground contact corresponds to a clean rectangular `500 × 150` world-unit collider. The front foundation edge should read as a clean, mostly horizontal ground edge. The larger `560 × 260` logical property footprint is invisible metadata and must not be depicted as a platform, tile, slab, or collision boundary. Walls, roof, and restrained perspective may extend upward and slightly outward beyond the physical foundation.
>
> Use warm timber framing with dark metal brackets and connectors, translucent clear or slightly cool greenhouse glass, a clearly visible pitched glass roof, simple operable roof vents, a practical ventilation fan, and warm hanging grow/work lights. Include organized wooden grow benches inside. Populate them specifically with young San Pedro cactus as the taller vertical forms and young Peyote as small globular plants in organized terracotta pots and trays. Keep the interior readable through the glass without excessive glare or detail noise.
>
> Place one human-scale wooden/glass front door slightly right of center on the south facade. The door should visually target approximately `92 × 170` world units, with its threshold/ground position aligned to world position `(680, 520)` when the complete sprite is displayed at `620 × approximately 430` world units with bottom-center origin `(0.5, 1)` and anchor `(650, 520)`. The door threshold and physical foundation must meet the ground baseline cleanly.
>
> Light the greenhouse from the upper-left with warm natural desert daylight, subtle warm bounce from wood and stone, restrained cool notes in the glass, and clear readable material separation. Ground the structure with slightly darker foundation edges and restrained contact shading immediately where the foundation meets the ground. Do not add a broad cast shadow extending across the terrain, and do not produce a separate shadow asset.
>
> Output only the complete greenhouse on a transparent RGBA canvas. No terrain, no path, no rocks, no grasses, no agaves, no decorative landscaping, no signs, no text, no labels, and no detached exterior props. Do not add a scenic ground patch or illustration backdrop. Do not split the greenhouse into separate complete base and glass images. The one main exterior must already look like a finished glass greenhouse.
>
> Recommended normalized canvas: `1860 × 1290` pixels, approximately 3× runtime resolution. Keep at least 60 transparent pixels of safety at the left, right, and top where possible. The foundation and threshold meet the bottom ground baseline. Preserve clean alpha edges with no matte, halo, clipped roof, or opaque corner pixels.

## Visual acceptance checklist

- Reads immediately as a Level 1 cactus greenhouse at gameplay and mobile overview scale.
- Front/south facade is dominant and mostly horizontal.
- Rectangular footprint is clear; the building is not dramatically diagonal or isometric.
- Stone foundation visually corresponds closely to the approved `500 × 150` collider.
- Logical `560 × 260` placement footprint is not depicted as visible geometry.
- Door is slightly right of center, human-scaled, and registered to `(680, 520)`.
- Main sprite is a complete greenhouse without requiring a duplicate glass/base layer.
- Roof, glazing, timber, metal, vents, fan, lights, benches, San Pedro, Peyote, and terracotta elements remain readable without clutter.
- No terrain, path, environmental props, signs, text, or detached items are baked in.
- Alpha is clean at 100%, 50%, and mobile-scale inspection against both light and dark backgrounds.
- Main source canvas, runtime display, origin, anchor, and baseline match this contract.
- Foundation grounding remains subtle, connected to the structure, and legible at desktop exploration, full-property overview, phone portrait, and short phone landscape sizes.
