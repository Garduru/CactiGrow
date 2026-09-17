# CactiGrow Art and World Bible

Status: authoritative direction for production visual and explorable-world development.

This document defines the target presentation and technical boundary for CactiGrow. The current React and CSS locations remain functional prototypes until replacement scenes meet their gameplay, accessibility, and responsive requirements. Gameplay state stays renderer-independent.

Future building production also follows [`BUILDING_ART_STANDARD.md`](BUILDING_ART_STANDARD.md). That geometry-first standard governs building footprints, orientation, collision, interaction, occlusion, registration, and asset packaging when a prior benchmark conflicts with it.

World depth preserves local-player visibility: terrain and paths sit below environment props, building bodies and details, future remote avatars, interaction prompts, the local avatar, and debug geometry, in that order. During graybox presentation the local avatar stays above every temporary building detail in Farm and Town. Future remote avatars may sort among themselves but never render above the local avatar. Production foreground occlusion is permitted only where narrowly authored by an art contract; a whole building or door must not accidentally hide the local avatar.

## Experience pillars

- **Small, dense places.** Build several authored scenes rather than one seamless open world.
- **Botanical identity first.** A cactus must be recognizable by silhouette, ribs, spines, and growth form before labels appear.
- **Warm, tactile materials.** Soil, terracotta, wood, stone, copper, glass, canvas, paper, and cactus skin should feel painted and handled.
- **World interaction with focused UI.** Movement and object selection happen in the world. Detailed decisions happen in React overlays.
- **Readable composition.** Every scene needs clear paths, landmarks, interaction targets, and quiet visual areas.
- **Replaceable rendering.** Scene art can evolve without changing routes, commands, or authoritative game data.

## Locked art direction

The human-approved production style is **stylized hand-painted 3D with clean semi-cartoon forms**. Use medium environmental detail, clean readable silhouettes, hand-painted material treatment, warm natural desert lighting, believable simplified construction, slightly exaggerated game-readable proportions, restrained texture noise, and clear shapes at mobile and overview scale. Functional grower equipment should feel integrated into the environment. Assets should feel rich without becoming realistic or visually busy.

This definition supersedes broader interpretations of hand-painted 3D that would push CactiGrow toward highly detailed realism. Use recognizable cactus anatomy, grounded proportions, readable spines, visible soil, and detailed but controlled containers and equipment. The result should feel like a premium indie game rooted in a desert growing property.

Avoid photorealism, generic low-poly geometry, voxel or pixel art, plastic mobile-game surfaces, anime styling, neon science fiction, sterile laboratories, generic farming-game motifs, and detail that obscures interaction.

## Camera

Use one **elevated three-quarter camera with restrained perspective**, visually close to an isometric presentation without requiring a mathematically isometric grid.

- Camera yaw remains fixed across all production assets and scenes.
- Camera elevation targets roughly 35 degrees downward from horizontal.
- Perspective is mild. Buildings retain depth, while paths and small objects remain easy to select.
- The camera never freely rotates or pans. Rotation would multiply asset work, complicate occlusion, and weaken visual consistency.
- Players have bounded zoom from a full-property overview to closer inspection while the camera continues following the avatar.
- Desktop uses wheel zoom and mobile uses pinch zoom. Each layout keeps an authored exploration default, and basic interaction never requires zooming.
- The visible area should show one meaningful neighborhood of a location, with short movement between landmarks.
- Interiors use the same view family, with cutaway walls, hidden roofs, or open-sided sets rather than a new camera language.
- Scene composition may shift safe framing for portrait screens, but asset perspective and world coordinates remain unchanged.

### Strict asset perspective rule

Every world object must be reviewed against the approved camera reference before production:

- same three-quarter view and fixed yaw;
- same approximate 35-degree elevation;
- mild perspective, without wide-angle distortion;
- key light from upper left/front-left;
- environmental and non-building cast shadows travel toward lower right/back-right;
- object base planes and immediate grounding must agree;
- transparent objects include adequate padding for their silhouette and selection outline;
- interior and exterior objects share the same apparent scale.

Do not approve assets that only match the palette. Perspective mismatch is a blocking defect.

## Movement and avatar

Use a hybrid movement scheme:

- **Desktop:** WASD or arrow keys for continuous movement; click a reachable point or interaction target for path-assisted movement; Enter or Space activates the focused nearby target.
- **Tablet and phone:** tap a reachable point to move; tapping an interaction target moves into range and activates or presents a concise prompt. A small optional virtual stick may be evaluated after touch testing, but tap-to-move is the default.
- **Keyboard-only:** predictable focus cycling among nearby interactables supplements movement and never requires pointer precision.

A visible avatar is recommended because it establishes scale, direction, ownership, and the feeling of entering a place. The first renderer milestone may use a simple temporary avatar with idle and walk directions. Final character customization, complex animation, and NPC systems are outside this plan.

Movement uses navigation polygons or a small walkable grid, simple collision bounds, and authored interaction radii. It does not require physics simulation.

## World scale

Use an internal world unit where the avatar is about 1.0 unit tall. Treat these as composition ratios rather than real measurements:

| Element | Guideline |
| --- | --- |
| Avatar height | 1.0 unit |
| Door clear height | 1.35 to 1.55 units |
| Main path width | 1.4 to 2.0 units |
| Secondary path width | 0.9 to 1.2 units |
| Greenhouse bench height | 0.45 to 0.55 unit |
| Work surface height | about 0.55 unit |
| Shelf top | 0.9 to 1.2 units |
| Small pot | 0.12 to 0.18 unit |
| Medium pot | 0.20 to 0.30 unit |
| Large pot | 0.35 to 0.50 unit |
| Juvenile cactus | 0.12 to 0.35 unit above soil |
| Mature display cactus | 0.25 to 1.2 units, species-dependent |
| Major building frontage | 4 to 8 avatar widths |

Interaction targets may be larger than visible geometry. Doors need clear approach space. Benches should not hide pots behind the avatar. Large cacti can exceed avatar height where species identity calls for it, but must not block essential routes.

## Lighting bible

All locations share a warm upper-left key light, soft lower-right shadows, warm ambient bounce from soil and wood, and restrained cool notes from sky or glass.

- **Farm:** late-morning desert daylight, warm but not orange-washed; broad soft shadows.
- **Nursery:** filtered sunlight with broken highlights from greenhouse framing; green and amber bounce stays subtle.
- **Garden:** clear warm daylight with enough contrast to read specimen silhouettes.
- **Lab:** daylight remains visible, supported by warm task lamps and restrained neutral equipment lights.
- **Home:** warm window and lamp light with darker wood and textile shadows.
- **Shop:** warm daylight and shaded awning light; readable stock displays.
- **Marketplace:** sunlit outdoor stalls with canvas-filtered shade.

Night, day-night cycling, weather, and dynamic global illumination are deferred. Do not create location palettes that imply unrelated times of day.

## Color relationships

Painted assets should relate to the current UI rather than copy UI hex values literally.

- **Desert soil:** deep umber shadows, warm ochre midtones, sparing sunlit gold.
- **Sandstone:** muted peach, tan, rust, and brown; avoid bright uniform orange.
- **Wood:** aged walnut and sun-bleached edges, with visible painted grain.
- **Terracotta:** rust-red base, dusty orange highlight, dark porous wear.
- **Cactus greens:** olive and blue-green families with species-specific shifts; highlights remain botanical rather than neon.
- **Glass:** desaturated blue-green with warm reflected light; high transparency and restrained glare.
- **Copper and metal:** dark oxidized bases, small warm edge highlights, limited green patina.
- **Canvas and fabric:** cream, dusty tan, faded rust, muted green.
- **Dry vegetation:** straw, olive-gray, and dusty gold.
- **Sky:** warm blue or pale desert cyan supporting orange-brown terrain.
- **Shadows:** deep brown-black, never flat pure black across whole forms.
- **Lab materials:** warm neutral enamel, smoked glass, aged brass/copper, dark wood, and limited cool gray.

## Material bible

- **Cactus skin:** broad painted gradients follow ribs and lobes. Add restrained pores, scars, and age variation at close scale.
- **Spines:** readable clusters and directional rhythm. Use simplified grouped shapes at world scale and finer detail only in focused views.
- **Soil:** coarse dark mix with stones, grit, and a dry top layer. Plants must visibly meet the soil.
- **Terracotta:** porous color variation, dusty rims, chipped edges used sparingly.
- **Ceramic pots:** painted glaze variation, grounded highlights, imperfect handmade shape.
- **Wood:** chunky readable grain, sun wear, dark joins, and softened edges.
- **Metal:** painted or aged surfaces with narrow edge highlights; avoid mirror-like physical perfection.
- **Copper:** warm focal accents, dark seams, restrained oxidation.
- **Glass:** simplified reflections and opacity gradients that do not hide interactables.
- **Stone:** large painted planes, warm edge wear, and believable contact with soil.
- **Fabric and canvas:** broad folds, faded pigment, soft shadowing, visible hems at close range.
- **Paper labels:** warm off-white, slightly uneven edges, concise marks that remain legible at interaction scale.
- **Lab equipment:** tactile knobs, glass vessels, metal frames, ceramic trays, and warm task lighting; never sterile sci-fi panels.

## Cactus art bible

Silhouette is the primary identification layer. Ribs and lobes are secondary. Spines, surface texture, color, and flowers provide closer-range identity.

### San Pedro — Echinopsis pachanoi

- Upright columnar silhouette with a stable vertical gesture.
- Clearly modeled longitudinal ribs with broad rounded valleys.
- Sparse, short spine clusters placed rhythmically along rib areoles.
- Blue-green to warm green variation, with younger growth slightly brighter.
- Mature forms gain height, rib confidence, basal thickness, and occasional restrained branching.
- Avoid generic saguaro arms unless the specimen's authored morphology supports branching.

### Peyote — Lophophora williamsii

- Low rounded button silhouette, visibly wider than tall.
- Distinct lobed or ribbed crown and a slightly depressed center.
- Minimal visible spination; areole texture and woolly details matter more.
- Blue-green, gray-green, or olive variation distinct from the San Pedro palette.
- Mature forms gain diameter and stronger lobe structure rather than columnar height.

### Shared production rules

- A plant must remain identifiable without its label or pot.
- Ribs must survive world-scale downsampling.
- Spine density is represented by grouped readable marks rather than noisy single pixels.
- Color variation is bounded per species and clone line.
- Age and size variation preserve the species silhouette.
- Pot scale follows root mass and growth stage.
- Soil contact, pot rim occlusion, and contact shadow prevent floating sprites.

## Growth-stage assets

Produce **four visual stages**: seedling, juvenile, developing, and mature. Four stages justify production cost because the current Nursery already communicates meaningful progress and the fourth step avoids an abrupt juvenile-to-mature jump.

These are renderer projections derived from existing growth progress. They are not new persisted lifecycle mechanics.

- Seedling: minimal species silhouette, small pot relationship, fragile height or button diameter.
- Juvenile: species identity becomes unmistakable; ribs or lobes are established.
- Developing: near-final form with less mass, fewer branches or pups, and reduced detail.
- Mature: full authored silhouette, strongest rib/lobe and spine readability.

Specimen identity persists across stage swaps through the same specimen and clone-line IDs, variation seed, palette selection, feature stack, pot assignment, and orientation. Stage change replaces or blends visual layers; it never rerolls appearance metadata.

## Genetic-feature visual rules

Use modular composition. Never commission a separate complete plant for every combination.

| Feature | Visual role |
| --- | --- |
| Variegation | Pigmentation mask layered over cactus skin; cream/yellow regions follow form and lighting. |
| Crested | Morphology module replacing the apex or upper growth with a readable fan-like crest. |
| Monstrose | Irregular knobby growth-form module with disrupted ribs; remains distinct from Melted. |
| Melted | Warped, flowing, softened morphology with drooping or fused-looking growth; not a Monstrose recolor. |
| Spiral | Geometry or authored morphology variant that twists ribs around the primary axis. |
| Dichotomous | Split-apex or branching morphology module with two readable growth centers. |
| Dense Spination | Spine layer increases density, cluster size, and silhouette texture while preserving underlying species. |

Apply morphology first, then pigmentation, then spines, then special-variant treatment. Feature definitions remain authoritative for compatibility. The renderer receives an already valid feature stack and does not decide genetic outcomes.

When two morphology features stack, use authored compatibility recipes or bounded parameter combinations. If a pairing cannot be represented well, art metadata may select a supported composite morphology, but it must not change gameplay feature truth.

## Shiny visual rule

Shiny is a separate special-variant layer, never a mutation or genetic-feature substitute.

- Use a species-respecting alternate color grade with richer highlights and a rare warm or pearlescent edge note.
- Add a restrained glint at selection, reveal, or focused inspection rather than continuous sparkles.
- Preserve morphology, pigmentation features, spine structure, and species readability.
- Do not use rainbow cycling, neon emission, full-body glow, or oversized particles.
- A subtle pot-rim or ground reflection may reinforce the state in focused views.

The renderer consumes stored Shiny state. It never rolls or modifies the 1/4096 rule.

## Plant composition architecture

Each rendered specimen is assembled from renderer-friendly metadata:

1. species base and growth stage;
2. stable variation seed for bounded scale, orientation, rib spacing, and color variation;
3. morphology modules;
4. pigmentation masks;
5. spine layer and density modifiers;
6. Shiny color and glint treatment;
7. pot model or sprite;
8. soil surface and labels;
9. contact shadow and optional selection outline.

Use base assets for species/stage silhouettes, overlays for pigmentation and markings, authored geometry/sprite modules for morphology, metadata-driven parameters for bounded variation, and shaders only for inexpensive color grading, masking, highlights, and selection effects. Shaders must degrade gracefully on lower-end mobile devices.

The game state stores biological truth and stable identity. A visual manifest maps that truth to asset keys and safe rendering parameters. Do not store renderer object references in game state.

## Pot system

Plan pots as composable visual assets with type, size, material, color family, wear variant, soil insert, and optional label anchor. Initial implementation may assign pots by location and plant size without adding player choices or gameplay effects. Pot metadata stays presentation-only until a future design explicitly promotes it into gameplay.

Plants, soil, rim occlusion, and shadows must be assembled as one grounded presentation. Large specimens require visually credible container scale.

## Location architecture

Every location is a separate authored scene with its own world projection, asset bundle, navigation bounds, interaction zones, and React overlay entry points. Routes remain the browser/deep-link contract. A location transition may fade, preload the next scene bundle, update the route, and mount the destination scene.

Do not pursue a seamless open world. Separate scenes reduce memory pressure, support mobile, simplify art production, and let locations evolve independently.

### Farm

The Farm is one player's owned cactus property and may later host authorized visitors. It contains Home, Nursery, Garden, Genetics Lab, a physical Mailbox, personal landscaping and display space, a visitor-arrival area, and the Road to Town. Shop and Marketplace are Town facilities. The Farm includes connected paths, property fencing, cactus landscaping, rocks, dry vegetation, tools, irrigation details, signs, staging space, and distant desert scenery. Buildings form distinct silhouettes and progression may swap visual variants using authoritative building level or Lab tier.

The owner and permitted visitors walk between public world targets, but the renderer never grants permissions. Owner-authoritative commands determine planting, collecting, breeding, research, inventory, commerce, organization, and upgrades. The Phaser Farm at `/` is the sole Farm implementation; `/world-preview` is only a legacy redirect.

The small physical Farm Mailbox uses a single production V1 sprite and is **HUMAN APPROVED / LOCKED** under [`MAILBOX_V1_ASSET_CONTRACT.md`](MAILBOX_V1_ASSET_CONTRACT.md). Its human-selected master is accepted as-is, including its existing alpha/background presentation. The Mailbox is a non-explorable utility destination for `/mail`, distinct in scale from the four locked major Farm exteriors. Its lower footprint and upper wooden structure use two approved collision rectangles, an intentional exception to the simple-building guideline. Do not revise its artwork or geometry without an explicit future task.

Farm and Town buildings follow world spatial logic designed for movement first: simple rectangular or square ground footprints, primary facades facing south/toward the player, doors on the front facade, and restrained side-wall perspective. Artwork conforms to approved gameplay geometry. Avoid dramatic diagonal compositions that force collision and pathing to approximate an arbitrary painted silhouette.

### Future Farm placement grid

Farm customization will use a logical placement grid beneath the authored world. Normal play never shows the grid: terrain, paths, planting, shadows, and organic composition visually soften its structure so objects do not appear to sit on obvious square tiles. Edit/build mode may reveal valid cells, snapping, object footprints such as 1×1 through larger rectangles, fixed-step rotation where supported, and clear valid/invalid feedback for mouse and touch.

Authoritative placement data uses an object definition ID, logical grid coordinates, footprint width and height, rotation/orientation, and optional visual variant. Screen or texture pixels are never the persistence model. A defined grid-to-world transform projects validated placement into Phaser coordinates. The server eventually validates ownership, unlocks, property bounds, occupied cells, collision, protected paths and entrances, and major-building exclusion zones; Phaser renders the accepted layout and emits placement intents.

Every Farm building and placeable object keeps four independently authored concepts: its logical placement footprint, physical player-collision bodies, interaction zone, and visual sprite bounds. A placement footprint reserves grid/property cells only and must never create an Arcade Physics collider by itself. Physical collision follows the visible solid ground contact while preserving entrances and walkable approaches. Interaction geometry is authored for usable keyboard, pointer, and touch activation. Visual bounds may extend beyond every gameplay shape for roofs, foliage, and transparent padding. Shared coordinates may align these concepts, but equality between them is never assumed.

Home, Nursery, Garden, and Genetics Lab remain authored, controlled major structures unless later design explicitly changes them. Their plots and exclusion zones may align with the same coordinate system without making the buildings freely placeable. Initial customizable candidates include pots, displays, benches, tables, planters, fences, gates, paths, rocks, landscaping, signs, lights, outdoor furniture, and decorative or trophy objects. This direction does not authorize a build-mode implementation yet.

Placeable art declares a logical footprint separately from its painted bounds. Use bottom-center ground anchors, consistent base-plane scale, and enough alpha space for silhouette and shadow; foliage, canopies, and soft shadows may extend beyond occupied cells without claiming those cells. Collision uses separately authored physical bodies after placement is validated; selection and interaction use their own authored zones rather than transparent sprite bounds.

### Nursery

The Nursery is an explorable greenhouse with:

- primary growing benches;
- an expanded bench section revealed by current property capacity;
- shelving and propagation staging;
- a potting/work surface;
- storage for soil, pots, and tools;
- reserved visual space for later specialized cultivation areas.

Nursery V1 was a retired production-art experiment. Its runtime composition, switch, depth/collision workarounds, and assets have been removed. Its approved visual lessons remain valid, but its diagonal geometry, irregular ground contact, and duplicate full-building layers are not a future building standard. Do not restore or reproduce that implementation.

Nursery V2 will be the first implementation of the Building Art Standard V2. Its geometry contract is approved: building center `(650, 390)`, `560 × 260` non-colliding placement footprint, `500 × 150` physical collider centered at `(650, 420)`, door `(680, 520)`, interaction center `(680, 525)`, approach `(680, 550)`, path endpoint `(680, 555)`, `620 × approximately 430` display, origin `(0.5, 1)`, and anchor/baseline `(650, 520)`. Preserve the warm timber, dark metal, substantial low stone foundation, clear slightly cool glazing, roof vents, practical exhaust fan, warm work lights, organized benches, terracotta containers, young San Pedro, young Peyote, and practical early-game grower character. Recompose these elements as a rectangular greenhouse whose primary facade and entrance face south/toward the player. Production art must follow [`NURSERY_V2_ASSET_CONTRACT.md`](NURSERY_V2_ASSET_CONTRACT.md).

The approved Nursery V2 main asset is integrated in the canonical Farm as a single complete production sprite, replacing only its temporary teal visuals. Its 1860 × 1290 transparent canvas renders at 620 × 430, bottom-center origin `(0.5, 1)`, anchor `(650, 520)`, baseline Y `520`, beneath the local player. Its scale, position, and appearance are visually approved in-game. No separate shadow, glass, or foreground layer is used. Collision remains independently authored as one active 540 × 145 rectangle centered at `(665, 382.5)`, with bounds X `395–935` and Y `310–455`; the right bound stays fixed. No Nursery V1 runtime path remains.

Nursery V2 is the first **locked, human-approved production exterior benchmark**. Its art, scale, registration, current collider, door/player relationship, interaction, return spawn, path, local-player-over-building depth, and absence of building and player grounding shadows have passed review. Revisit them only for a demonstrated gameplay defect or explicit redesign direction; do not continue cosmetic geometry tuning. Carry its readability, registration, and art-pipeline lessons into other buildings without copying its dimensions.

Authoritative Nursery slots map through a layout manifest to physical pot anchors. Level 1 exposes six anchors; Level 2 exposes eight. Empty slots show empty pots or prepared positions. Occupied slots instantiate the specimen's plant composition at the same anchor. No visual position creates capacity independently.

Approaching or tapping a pot highlights it and shows a concise name/state prompt. Activation opens a focused React interaction for planting, growth details, treatment history, or collection. The world updates after the existing command succeeds.

### Garden

Nursery owns planting and growth: its future explorable interior will map six Level 1 or eight Level 2 growing slots to greenhouse bench anchors. Garden owns collected-specimen display and inspection. The physical Farm Garden is an exterior destination, not an internally explorable growing area. Its six empty beds are collection-display anchors only; they do not determine Nursery capacity, Garden ownership capacity, or seed planting. A future narrow renderer projection may display a curated subset of real owned specimens, while the full collection remains available through React `/garden`.

- Level 1: core cactus garden and basic display beds.
- Level 2: visibly organized beds supporting the current organization tools.
- Levels 3–5 reserve space for future breeder, clone-grove, and exhibition presentation without implementing mechanics.

Players can assign or select displayed specimens later without changing ownership semantics. Breeding and detailed specimen work continue in React overlays launched from a selected plant or collection view.

### Genetics Lab

The Lab evolves from a property site into an authored interior whose appearance derives from authoritative tier:

- Tier 0: no accessible building; property site or planning marker only.
- Tier 1: Research Bench and records workspace.
- Tier 2: Microscope Station and tissue-sampling area.
- Tier 3: complete Genetics Lab with Sample Storage, Extraction Station, and Treatment Workspace.
- Tiers 4 and 5: larger, richer facility shells with reserved stations; do not imply unimplemented mechanics.

Players approach physical stations. React handles research records, sample selection, extraction choices, treatment application, requirements, and provenance. World props reflect broad station availability without revealing hidden genetics.

### Home

Home is a compact physical residence centered on a property desk, records, windows onto the Farm, personal shelves, and reserved trophy/display areas. Property Management opens at the desk. Building overview and upgrades remain React UI. Avoid six separate menu props around the room. Future visual progression may enrich materials and displays without inventing mechanics.

The original long Home V1 is a locked, human-approved production Farm exterior; its asset, scale, registration, and Home-specific five-rectangle collision are recorded in [`HOME_V1_ASSET_CONTRACT.md`](HOME_V1_ASSET_CONTRACT.md). Compact Home V02 was rejected; its design history remains documented and obsolete files removed. Nursery V2 is locked. Genetics Lab V1 is also locked after human runtime review; its production asset and four-rectangle collision are recorded in [`GENETICS_LAB_V1_ASSET_CONTRACT.md`](GENETICS_LAB_V1_ASSET_CONTRACT.md). These compound collisions are silhouette-specific exceptions, not a new default. Garden V1 is HUMAN APPROVED / LOCKED under [`GARDEN_V1_ASSET_CONTRACT.md`](GARDEN_V1_ASSET_CONTRACT.md); its asset, scale, registration, collider, entrance/navigation coordinates, and six empty display anchors require an explicit future Garden revision to change. Actual owned-specimen rendering remains future work.

### Shop

The Shop is a public facility in Town with a seed display, pot and soil shelves, shaded exterior stock, counter, labels, and room for a future vendor. Its shared exterior remains coherent for every player. Until purchasing exists, it can remain closed, lightly staged, or provide an intentional unavailable message. Do not simulate stock or NPC behavior.

### Marketplace

The Marketplace or Exchange is an asynchronous listing facility in Town with canvas stalls, display tables, specimen stands, listing boards, and clear walking lanes. Current listings can project to a limited set of display anchors while React presents full listing details and seller actions. It remains distinct from synchronous Direct Trade. Empty stands communicate no listings. Do not create fake buyers or transactions.

### Shared public Town

The first Town presentation graybox is a separate compact `2200 × 1500` Phaser world. It provides a southern Farm arrival/return point, a central public square, and simple south-facing Shop and Marketplace / Exchange buildings in the north. These destinations route to the existing React gameplay pages and return to Town through transient navigation context. The scene shares the Farm bridge and host lifecycle and remains a single-player renderer prototype; multiplayer presence, NPCs, public chat delivery, and server authority are not simulated.

Town is a separate future Phaser scene and CactiGrow's main public multiplayer hub. It can show many online players and support meeting, local world chat, direct-trade initiation, and public facilities. Its initial facilities are Shop and Marketplace/Exchange, with room for a small number of later services. Do not turn Town into an enormous building catalog.

Farm and Town never form one seamless map. The authored transition is Farm → Road to Town → scene transition → shared Town. Town's exit or Return Home action loads the player's Farm. Routes remain the navigation contract while future server authority assigns Town and Farm instances.

Shared Town exteriors remain visually coherent for all players. Player-specific Shop or other facility progression may change available services, React UI, access, or a personal/instanced interior, but cannot give the same public exterior contradictory geometry for different viewers.

## Farm ownership, visiting, and privacy

A future Farm session distinguishes `farmOwnerId`, `localPlayerId`, and viewer role (`owner` or `visitor`). These concepts belong to authoritative session/projection data, not Phaser permissions. Visitors may walk, see public displays and permitted players, chat socially, and inspect explicitly public profile information. They cannot automatically plant, collect, breed, sample, research, extract, treat, organize, move, sell, list, spend, upgrade, or access private inventory and research.

Farm access policy must allow future choices such as Nobody, Friends Only, Invite Only, or Anyone. Entry may begin from a CactiSwap profile, CactiGrow friends list, explicit invitation, or future player interaction. The server checks access, joins the owner’s Farm instance, and places a visitor in the reserved collision-free arrival area near the entrance, Mailbox, and Road to Town. No single relationship type is hardcoded as the only access rule.

World projections expose only viewer-appropriate data. Physical visibility of a cactus never grants hidden carriers, private analysis, research depth, treatment provenance, notes, inventory, or non-public clone/provenance details. Existing genetics and research privacy boundaries remain authoritative.

## Social and economy boundaries

Keep these systems separate:

- **World Chat:** public/local live chat in shared spaces such as Town, presented through a chat panel and brief styled text above the speaking avatar.
- **Direct Message:** private live conversation only while both users are online and available. An offline message is not silently stored as a DM; use Mail instead.
- **Mail:** persistent asynchronous text that can be read later. Initial Mail has no Tokens, specimens, seeds, samples, extracts, inventory items, or other attachments. The Farm Mailbox opens its React workflow.
- **Direct Trade:** synchronous player-to-player exchange after request, acceptance, both offers, review, and both confirmations. The server atomically validates and executes eligible item/specimen and Token ownership changes.
- **Marketplace:** asynchronous listings and offline exchange in Town, independent from Direct Trade.
- **Friends:** relationship and access layer supporting request, accept, decline, removal, appropriate online status, Visit Farm, and live DM entry.

Physical destinations use routes with destination-aware exterior return spawns, even when entered from another interior page. Friends, Direct Messages, and World Chat open in a persistent React overlay or chat dock above the current world or interior and do not change its route. Legacy `/friends` and `/chat` links redirect safely to Farm; Mail remains a separate physical Mailbox workflow.
- **Farm Visiting:** authorized presence in another player's owned Farm instance.

Selecting another player may later offer View Profile, friendship action, Direct Message, Trade, Visit Farm, Report, and Cancel, adjusted for Town versus Farm context and current permissions. CactiSwap profiles may expose Add Friend and Visit Farm through an isolated identity/profile adapter; Base44 never becomes CactiGrow's gameplay or multiplayer authority.

Future server authority covers identity, online presence, synchronized positions, Farm ownership and access, Farm/Town instance membership, friends, chat and DM delivery, persistent Mail, trade sessions and confirmations, ownership, Tokens, items, specimens, duplicate/race prevention, disconnect handling, and required moderation, block, or report controls. Phaser supplies presentation/input and React supplies UI/workflows; neither independently mutates authoritative multiplayer state.

## Renderer responsibility

Adopt **Phaser 3 for the explorable world layer** when implementation begins. It is a suitable match for the existing TypeScript/Vite stack and the intended 2D/2.5D rendered presentation.

Phaser should own:

- scene rendering and layer order;
- camera follow and bounded zoom;
- player movement and simple collision;
- navigation/path assistance;
- interaction zones and selection highlights;
- environmental animation;
- sprite composition, atlases, culling, and pooling;
- location transitions after route intent is accepted.

React should own:

- persistent HUD and utility menu;
- inventory and collection management;
- dialogs, drawers, and focused object interactions;
- Plant Details, breeding, selling, and Marketplace pricing;
- Research Log and Lab workflow UI;
- property management and upgrades;
- settings, accessibility controls, achievements, and reference screens;
- route shell and error states.

The shared game-state/services layer owns commands, validation, formulas, persistence boundaries, IDs, progression, economy, and authoritative outcomes. Neither React presentation nor Phaser scenes duplicate these rules.

## React-to-world bridge

Use a small typed bridge with semantic events and commands. Avoid sharing component instances or the full raw game state.

World-to-application intents may include:

```ts
type WorldIntent =
  | { type: 'enterLocation'; locationId: WorldLocationId }
  | { type: 'inspectNurserySlot'; slotId: string }
  | { type: 'inspectGardenSpecimen'; specimenId: string }
  | { type: 'useLabStation'; stationId: LabStationId }
  | { type: 'openPropertyManagement' }
  | { type: 'openShopCounter' }
  | { type: 'openMarketListing'; listingId: string }
```

Application-to-world messages may include:

```ts
type WorldMessage =
  | { type: 'projectionUpdated'; locationId: WorldLocationId; revision: number }
  | { type: 'interactionResolved'; targetId: string; outcome: 'success' | 'rejected' }
  | { type: 'focusTarget'; targetId: string }
  | { type: 'setInputEnabled'; enabled: boolean }
```

Example flow:

1. Phaser emits `inspectNurserySlot`.
2. React opens the slot interaction using the slot ID.
3. The player chooses Collect.
4. The existing game-state command validates and applies collection.
5. A new Nursery projection is produced with that slot empty.
6. Phaser reconciles the projection and updates the pot anchor.

Modal overlays disable world movement input while leaving rendering active. Closing an overlay restores focus to the originating world target.

## World projections

Add projection functions beside domain selectors, not inside scenes. They expose stable renderer data and a revision/key for reconciliation.

- `FarmWorldProjection`: building ID, asset key, level/tier label, route, enabled state, interaction anchor.
- `NurseryWorldProjection`: slot ID, anchor key, occupancy, species visual key, growth visual stage, visible high-level statuses.
- `GardenWorldProjection`: zone definitions, displayed specimen IDs, species/visual keys, organization presentation, selectable state.
- `LabWorldProjection`: tier, available station IDs, station asset variants, broad stored-item counts where appropriate.
- Later Home, Shop, and Marketplace projections follow the same pattern.

Projections must not expose hidden genetics to the renderer. They should not contain callbacks, DOM state, Phaser objects, or entire domain records.

## Interaction language

All world targets use the same sequence:

1. proximity or pointer hover/focus adds a restrained warm outline or ground highlight;
2. a compact label shows object name and basic state;
3. click, tap, Enter, or Space activates;
4. if out of range, the avatar moves to the interaction anchor first;
5. detailed work opens a React overlay;
6. Escape or Back closes the overlay and restores target focus.

Doors transition locations. Pots and plants open specimen interactions. Benches may focus a group, but individual slots remain authoritative. Lab stations open their matching workflows. The Home desk opens Property Management. Shop counters and market stands open commerce UI when those systems exist.

Do not attach large floating panels to every object. The world shows highlight, concise name, basic state, and a short interaction prompt only.

## Responsive world strategy

### Desktop

- Show the largest authored camera window and longer sight lines.
- Support WASD and click movement together.
- Keep HUD and overlays at their existing readable density.
- Use bounded zoom rather than revealing unfinished scene edges.

### Tablet

- Use the same world coordinates with a slightly closer default zoom.
- Increase interaction radii and target highlights.
- Prefer tap-to-move while preserving optional keyboard input.
- Reframe important landmarks within safe-area and overlay bounds.

### Phone portrait

- Use an authored close zoom and camera look-ahead so the avatar and next landmark remain visible.
- Enlarge interaction targets independently of art scale.
- Keep prompts short and place them away from persistent HUD/utility controls.
- Open detailed React workflows as viewport-fitted sheets or dialogs.
- Do not shrink a whole desktop scene to fit.

### Phone landscape

- Reduce HUD height and vertical prompt footprint.
- Widen camera framing while retaining the same interaction scale.
- Keep world controls clear of safe areas and system gestures.

Each scene declares camera bounds, default zoom per layout class, minimum target size, and overlay-safe regions.

## Performance guardrails

- Target smooth interaction on representative mid-range phones before increasing decoration.
- Use texture atlases for plants, props, and repeated environment pieces.
- Batch compatible sprites and avoid unique materials for every specimen.
- Cull objects outside the camera plus a small preload margin.
- Pool transient highlights, particles, and repeated props.
- Limit continuous environmental animation; prioritize interaction feedback.
- Lazy-load location bundles and unload large textures after transitions when memory pressure warrants it.
- Provide 1x and 2x texture variants where visual testing supports them; avoid loading desktop masters on phones.
- Keep plant composition layer counts bounded and flatten combinations when distant.
- Use lower-detail world representations and higher-detail focused inspection assets.
- Avoid large transparent textures with mostly empty pixels.
- Track scene texture memory, draw calls, active animations, and time-to-interactive as practical budgets during implementation.

Initial targets should be established during the renderer spike: 60 fps on desktop, a stable 30–60 fps range on representative mobile hardware, responsive input, and scene transition loading that can be masked by a short authored fade.

## Asset production standards

### Sources and exports

- Keep layered high-resolution masters outside runtime bundles or in a clearly marked source-art store.
- Produce masters at 2x the largest expected runtime display size unless a gold-standard test proves more is needed.
- Export transparent interactive objects as lossless WebP or PNG according to browser quality and alpha-edge testing.
- Export opaque backgrounds as quality-controlled WebP, with fallback only if required by supported browsers.
- Use texture atlases for repeated props, plant modules, and animation frames.
- Add 4–8 pixels of atlas extrusion/padding at runtime resolution to prevent sampling seams.
- Do not create separate cast-shadow assets for buildings. Use restrained immediate foundation grounding in the main building art; keep broader environmental lighting in terrain or scene layers. Separate shadow effects remain available for non-building objects only when specifically justified.
- Provide mobile resolution variants for large backgrounds and atlases.

### Naming

Use lowercase kebab-case with semantic segments:

```text
plant-echinopsis-pachanoi-seedling-base-v01.webp
plant-lophophora-williamsii-mature-base-v01.webp
morphology-crested-echinopsis-mature-v01.webp
pigmentation-variegation-mask-v02.webp
spines-dense-echinopsis-mature-v01.webp
pot-terracotta-medium-round-v03.webp
world-nursery-bench-expanded-v01.webp
lab-station-extraction-tier-3-v01.webp
```

Asset manifests map semantic keys to files. Gameplay code should never construct file paths from biological state.

## Repository asset structure

Place runtime art under `public/assets` initially so Vite can serve stable paths. Move to imported/hashed bundles where profiling and cache strategy justify it. R2 integration is deferred.

```text
public/assets/
  world/
    shared/
    farm/
      backgrounds/
      buildings/
      props/
    nursery/
      backgrounds/
      benches/
      props/
    garden/
    lab/
    home/
    shop/
    marketplace/
  plants/
    species/
      echinopsis-pachanoi/
      lophophora-williamsii/
    morphology/
    pigmentation/
    spines/
    shiny/
  pots/
  props/
  characters/
  ui/

src/game-world/
  bridge/
  projections/
  renderer/
    scenes/
    entities/
    camera/
    interaction/
    assets/
```

Keep source masters, prompt records, paintovers, and generation contact sheets outside the shipped runtime folders, with versioned references in an art-production workspace.

## Art generation and review workflow

Before batch production, approve six gold-standard references:

1. one Farm building in final camera and lighting;
2. one Nursery interior section with glass, bench, and outside view;
3. mature San Pedro with pot, soil, spines, and contact shadow;
4. mature Peyote with pot, soil, lobes, and contact shadow;
5. one reusable terracotta pot family reference;
6. one Tier 3 Lab station establishing the non-sterile research material language.

Every generation or artist brief must lock:

- CactiGrow stylized hand-painted 3D direction;
- approved camera yaw, elevation, and perspective;
- upper-left key light and shadow direction;
- location palette and material language;
- exact background requirement: transparent object, layered scene, or opaque background;
- expected world scale and neighboring reference object;
- orientation and required clear interaction footprint;
- species anatomy, stage, and feature requirements;
- required alpha padding and output dimensions;
- prohibited styles and artifacts.

Review references for silhouette, camera agreement, lighting, material cohesion, alpha edges, downsample readability, mobile readability, and in-scene scale. Approve a reference sheet and palette/material paintover before producing variants. Batch generation begins only after San Pedro and Peyote are distinguishable without labels and the greenhouse reference proves object layering and walkable readability.

## Incremental migration roadmap

### Phase 0 — documentation and spike preparation

- Maintain this bible and current prototypes.
- Define supported browsers/devices and renderer acceptance checks.
- Prepare a small gold-standard art set and a temporary avatar.

### Phase A — renderer shell

- Add Phaser only when this phase is authorized.
- Mount a renderer surface beneath the existing React HUD.
- Implement route-aware scene lifecycle, resize handling, input suspension, and the typed bridge.
- Prove one temporary room on desktop and phone without gameplay migration.

### Phase B — Farm scene

- Implement camera, movement, collision, six destination zones, building projection, and route transitions.
- Keep `/` as the single canonical Phaser Farm and preserve route, keyboard, touch, and state-derived building behavior.

### Phase C — Nursery scene

- Map six/eight authoritative slots to pot anchors.
- Add plant composition proof for San Pedro and Peyote across four visual stages.
- Open existing React planting, treatment, growth, and collection workflows through bridge intents.
- Retain the React Nursery fallback until lifecycle parity passes.

### Phase D — Garden scene

- Implement display zones and a bounded displayed subset.
- Preserve the React full-collection and specimen-detail workflows.
- Prove large collections do not require every specimen to be active in the scene.

### Phase E — Genetics Lab

- Implement tier-driven interior variants and station availability.
- Connect existing research, sampling, extraction, and treatment React workflows.
- Ensure hidden genetics never enter the world projection.

### Phase F — Home, Shop, and Marketplace

- Add authored small scenes in that order, retaining intentional incomplete-commerce presentation.
- Connect Property Management at the Home desk.

### Phase G — production art replacement and optimization

- Replace approved temporary assets location by location.
- Add atlases, resolution variants, culling, pooling, and scene-specific loading based on profiling.
- Remove a React prototype only after its production scene meets functional, responsive, accessibility, and deep-link parity.

At every phase, the renderer reads projections and emits intents. Existing commands remain authoritative. Migration is reversible until each scene passes acceptance checks.

## Explicitly deferred

- Phaser installation or renderer code;
- production scenes, camera, collision, pathfinding, and avatar implementation;
- final or generated art assets;
- asset hosting or Cloudflare R2 integration;
- new gameplay, pot mechanics, NPCs, buyer simulation, weather, day/night, combat, complex physics, or seamless-world technology;
- changes to formulas, state semantics, progression, economy, genetics, routes, or existing React prototype availability.
