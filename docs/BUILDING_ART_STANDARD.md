# CactiGrow Building Art Standard V2

Status: authoritative geometry and asset standard for future world buildings.

This standard preserves CactiGrow's approved stylized hand-painted 3D art direction while making gameplay geometry the starting point for building production. Buildings use clean semi-cartoon forms, medium environmental detail, warm natural desert lighting, believable simplified construction, restrained texture noise, readable silhouettes, and mature, cozy presentation. Materials remain tactile timber, stone, glass, metal, terracotta, and desert surfaces. Avoid photorealism, generic low-poly work, flat vector or pixel art, children's-cartoon proportions, extreme saturation, and excessive micro-detail.

## Camera and orientation

All buildings use the locked elevated three-quarter camera: approximately 35 degrees downward, mild perspective, fixed yaw, no free rotation, and the existing world coordinate system. Artwork conforms to this camera; the camera never changes to rescue an individual asset.

Major buildings normally use this authored orientation:

- front faces south, toward the player;
- back faces north;
- left faces west;
- right faces east.

The primary facade reads mostly horizontally across the screen. Doors normally occupy the south/front facade. Restrained side-wall visibility may communicate depth, but dramatic diagonal or isometric building compositions are unsuitable for standard gameplay buildings.

## Geometry-first contract

Before concept or production art begins, define and approve:

- logical world footprint width and depth;
- physical ground collider;
- front-door world position;
- interaction center and keyboard/touch radii;
- automatic-movement approach point;
- path connection;
- world display width and approximate height;
- sprite origin and ground-contact baseline.

Major buildings begin from a simple rectangular or square ground footprint. Artwork is composed around the approved geometry. Do not infer collision afterward from a painted silhouette, roof, transparent canvas, or alpha bounds.

## Four independent geometries

Every building and placeable world object has four independently authored geometries:

1. **Placement footprint:** logical cells or property space used for edit/build occupancy, overlap validation, exclusion zones, and future server validation. It never creates player collision automatically.
2. **Physical collision:** simple bodies that block the player's feet at solid ground-contact geometry. A rectangular building normally uses one clean rectangular collider, with at most one additional simple body when an entrance recess or projection requires it.
3. **Interaction zone:** localized activation geometry for a door, station, or contextual action. It remains independent from placement and collision.
4. **Visual sprite bounds:** rendering canvas that may contain roofs, awnings, signs, plants, antennas, trim, or transparent padding. Sprite bounds never define collision.

Avoid zigzag collision, stair-step approximations, numerous overlapping bodies, roof-derived collision, and canvas-derived collision. Author the ground footprint, front door, and player approach before generating final art.

## Occlusion and asset package

The default building package is:

- `building-main.webp`: one complete exterior participating in simple Y-aware world sorting.

An optional `building-foreground.webp` is allowed only for a narrow, specific occluder such as a roof lip, archway, doorway lintel, tree canopy, glass edge, or awning. It contains only pixels intended to pass in front of the player. A second complete building is never used as a permanent foreground layer, and the player must not be sandwiched between duplicate full-building sprites.

When the player's feet are north/behind the authored ground-sort boundary, the main building may occlude the player. When the player's feet are south/in front, the player renders above the building. Keep this rule simple enough to reuse across Farm, Town, and later multiplayer scenes.

## Building grounding

CactiGrow buildings do not require or normally ship a separate `building-shadow.webp`. The main asset should meet the terrain cleanly through its foundation and threshold. Subtle grounding may be painted into the immediate foundation treatment through slightly darker foundation edges, restrained contact shading at the structure's base, and material shading on the foundation itself. Do not bake a broad cast shadow extending across terrain into the building sprite. Environmental terrain lighting may provide broader cohesion separately.

## Registration and scale

Each asset records its transparent source canvas dimensions, origin, world display dimensions, ground-contact baseline, logical footprint, and door position. Registration and world scale are invariant; unrelated buildings do not need identical pixel canvases.

Use the current temporary avatar target of approximately `82 × 128` world units as the initial scale reference. Doors comfortably accommodate one player with slightly exaggerated readable clearance. Building height supports gameplay readability without producing excessive empty footprint or oversized scenery. Path width, story height, props, thresholds, and handles should remain consistent with the same player reference.

## Organic world composition

Simple building geometry provides predictable gameplay anchors. Organic character comes from separately authored curved paths, terrain painting, fencing, rocks, grasses, cacti, planters, pots, benches, lights, decorations, landscaping, signs, and future player-placeable objects. Do not bake those surroundings into a major building sprite.

The future Farm placement grid remains hidden in normal play and visible only in edit/build mode. Major buildings retain authored positions and camera-compatible orientations initially. Smaller supported objects may later use logical cell footprints and fixed-step rotation after server validation. Arbitrary rotations of major buildings require an explicit asset system capable of readable alternate facades.

## Nursery V2 application

Nursery V2 is the first human-approved production exterior benchmark under this standard. Its long rectangular Level 1 greenhouse has a south-facing front facade, restrained three-quarter perspective, slightly right-of-center entrance, visible glass roof and front glass wall, modest side-wall visibility, substantial low stone foundation, warm timber, dark brackets, translucent glass, roof vents, ventilation fan, warm work lights, organized benches, young San Pedro and Peyote, and terracotta pots or trays.

Nursery V2 building art excludes terrain, paths, rocks, agaves, grasses, decorative pots, landscaping, and signs. Those remain separate world assets. Its integrated artwork and walk-tested runtime geometry are locked; the original geometry proposal below is historical context. The active refined collider is recorded in [`NURSERY_V2_ASSET_CONTRACT.md`](NURSERY_V2_ASSET_CONTRACT.md). Home is next and has its own proposed dimensions in [`HOME_V1_ASSET_CONTRACT.md`](HOME_V1_ASSET_CONTRACT.md).

### Approved Nursery V2 geometry contract

The following original proposal guided Nursery V2 production. The integrated asset and active collider have since been approved through human walk-around review; use the Nursery V2 asset contract for their current values.

| Contract | Approved value |
| --- | --- |
| Building center | `(650, 390)` |
| Logical placement footprint | `560 × 260` |
| Physical player collider | `500 × 150` |
| Physical collider center | `(650, 420)` |
| Door | `(680, 520)` |
| Interaction center | `(680, 525)` |
| Keyboard radius | `90` |
| Touch radius | `140` |
| Approach point | `(680, 550)` |
| Path endpoint | `(680, 555)` |
| Building display width | `620` |
| Approximate display height | `430` |
| Sprite origin | `(0.5, 1)` |
| Sprite anchor / ground baseline | `(650, 520)` |
| Door visual target | approximately `92 × 170` world units |
| Grounding | restrained foundation-edge shading in the main asset; no separate cast-shadow asset |

Artwork must be designed around this contract. The physical stone foundation's visible ground contact should correspond closely to the `500 × 150` collider centered at `(650, 420)`. The `560 × 260` placement footprint is property occupancy metadata, not the visible foundation and not player collision. Walls, roof, restrained perspective, and transparent sprite bounds may extend upward or outward beyond both gameplay shapes.

The authoritative production specification and image-generation brief are in [`NURSERY_V2_ASSET_CONTRACT.md`](NURSERY_V2_ASSET_CONTRACT.md).

## Nursery V1 historical lessons

Nursery V1 proved transparent WebP normalization, typed loading, atomic fallback, texture registration, placement/collision separation, interaction geometry, and the need for clean foundation grounding. Its runtime implementation and assets are removed.

Do not restore its split full-building composition, player-relative depth workarounds, irregular diagonal geometry, collision approximation, or asset paths. Nursery V2 and its contract are authoritative.
