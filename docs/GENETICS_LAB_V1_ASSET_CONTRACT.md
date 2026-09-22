# Genetics Lab V1 production exterior asset contract

Status: **LOCKED / HUMAN APPROVED.** The final human walk-around approved the current Genetics Lab V1 production exterior, `500 × 360` scale, sprite placement and door alignment, and four-rectangle collision for the current production-alpha presentation. The candidate master and lossless production WebP remain unchanged. Minor collision polish is deferred. Nursery V2 and the original long Home V1 are also locked production exteriors.

## Locked runtime integration

| Property | Approved runtime value |
| --- | --- |
| Texture | `farm-genetics-lab-main-v01` from `public/assets/world/farm/lab/farm-genetics-lab-main-v01.webp` |
| Display / origin | `500 × 360` world units / `(0.5, 1)` |
| Sprite anchor / foundation baseline | `(2382, 1355)` / Y `1355` |
| Visible door alignment | Measured door center approximately `+38` world units from sprite center, placing it near X `2420` |
| Authored door threshold | `(2420, 1355)` remains the gameplay reference; artwork was shifted left to meet it |
| Physical collision | Four human-approved axis-aligned rectangles, detailed below |
| Interaction / approach / exterior return | Unchanged at `(2420, 1425)` with existing radii, route, and navigation |
| Interaction radius / touch selection | Keyboard `165` around `(2420, 1425)`; touch `285` around layout center `(2420, 1210)` |
| Path / route | Existing west spur ends `(2180, 1210)`; `/lab` route and Farm return remain unchanged |
| Building / local player depth | `40` / `120`; player renders above the complete Lab sprite |

| Region | Bounds | Center | Size |
| --- | --- | --- | --- |
| Lower main body/foundation | X `2152–2612`, Y `1190–1325` | `(2382, 1257.5)` | `460 × 135` |
| Central dome/upper structure | X `2310–2515`, Y `1090–1200` | `(2412.5, 1145)` | `205 × 110` |
| Right technical/antenna structure | X `2505–2612`, Y `1096–1200` | `(2558.5, 1148)` | `107 × 104` |
| Left rooftop AC/utility unit | X `2188–2260`, Y `1148–1200` | `(2224, 1174)` | `72 × 52` |

The final human walk-around accepted these side clearances and the stepped upper silhouette. The lower body's front remains at Y `1325` and rear at Y `1190`. The AC represents only the left rooftop utility mass; the dome and right technical rectangles protect the taller central and right structures. `?worldDebug` derives four distinct outlines and exact bounds labels from the active collider definitions. Sprite bounds, door threshold, interaction, approach, and exterior spawn markers remain. No cast shadow or foreground layer is used. Stop collision micro-tuning for this production-alpha benchmark; minor polish can happen later if a specific defect warrants it.

## Pre-integration authored Farm geometry

These values came from `farmWorldLayout.ts` and the former `FarmTestScene.ts` graybox renderer. The logical layout, interaction, and path values remain current; the graybox visual and physical collider have been replaced by the locked integration above.

| Item | Layout value / former graybox value |
| --- | --- |
| Farm world | `3000 × 1900` |
| Lab world center | `(2420, 1210)` |
| Graybox dimensions / physical collider | `430 × 290`, centered `(2420, 1210)`; X `2205–2635`, Y `1065–1355` |
| Graybox door visual | `82 × 134`, centered `(2420, 1288)`; threshold approximately `(2420, 1355)` |
| Interaction center | defaults to approach point `(2420, 1425)` |
| Keyboard interaction radius | default `165` world units |
| Touch selection | radius `285` around graybox center `(2420, 1210)`; there is no separate Lab touch-interaction radius |
| Approach point | `(2420, 1425)` |
| Existing path spur endpoint | `(2180, 1210)`; west of Lab, not the door or approach point |
| Exterior return spawn | `lab-exterior` at `(2420, 1425)` |
| Route | `/lab` |

The Lab sits in the southeastern Farm, east/southeast of Home and south of Garden. The existing path branches from `(1500, 1080)` through `(1940, 1200)` to the western spur endpoint `(2180, 1210)`. The Lab door faces south, with clear approach space toward Y `1425`; the east property fence is at approximately X `2910`, and the south fence at Y `1810`. Keep the authored interaction and return behavior intact. A production path connection from the western spur around to the south-facing door should be reviewed during a separately authorized world-layout pass; this document does not move the path.

## Proposed V1 production geometry

| Item | Proposal for art and later in-game review |
| --- | --- |
| World center / logical plot | `(2420, 1210)`; retain the current `430 × 290` authored plot as non-colliding metadata initially |
| Main exterior runtime display | `500 × 360` world units |
| Origin | `(0.5, 1)` |
| Sprite anchor / ground baseline | `(2420, 1355)`; canvas bottom maps to Y `1355` |
| South/front door threshold | approximately `(2420, 1355)`; centered on the facade |
| Proposed single physical collider | X `2215–2625`, Y `1100–1325`; `410 × 225`, center `(2420, 1212.5)` |
| Existing interaction / approach / spawn | remain `(2420, 1425)` for initial integration review |
| Existing interaction / touch radii | remain `165` from approach and `285` from Lab center for initial review |
| Existing path spur endpoint | remains `(2180, 1210)` until a separate path review |
| Local-player presentation | depth `120`, above the complete building; no player grounding shadow |

The table above is the **pre-integration proposal**, not the locked registration. The active sprite and approved compound collision are recorded at the top of this document. The 30-unit gap between the lower body's south edge and door threshold leaves room to stand at the entrance; the existing approach/spawn is 70 units south of the threshold. The Lab's four rectangles respond to its specific silhouette; they do not make compound collision a default for future buildings.

## Building identity and visual contract

Create a small private **cactus genetics and propagation research facility** that belongs beside the approved Nursery V2 and long Home V1. Use CactiGrow's stylized hand-painted 3D, clean semi-cartoon forms, medium environmental detail, warm upper-left desert light, mature proportions, tactile materials, restrained texture noise, and readable mobile-scale silhouette. Follow the fixed elevated three-quarter camera, approximately 35 degrees downward, with mild perspective and a primarily south-facing horizontal facade.

Give the Lab its own functional identity: a warm stucco/masonry shell, darker timber or metal structural details, selective windows or glazed sections, a distinctive centered working entrance, restrained integrated ventilation/utility equipment, warm interior task lights, and glimpses of cactus specimens, propagation trays, microscope or measurement equipment **inside**. It should read as controlled botanical research without becoming a greenhouse, residence, hospital, generic office, industrial plant, sterile white facility, or futuristic sci-fi set. Keep the footprint rectangular, roof modest and connected, and exterior detail restrained so collision and walking lanes remain clear. Future Lab-tier visual variants may elaborate equipment without altering this V1 entry geometry unless separately approved.

The Lab door should sit between the approved Home and Nursery in perceived scale: visually usable by the `82 × 128` reference player, without the long Home's earlier undersized-door concern or compact V02's oversized-door concern. Initial **visual** target is approximately `75–85 × 130–145` world units for the usable leaf/opening at the proposed runtime size. At 3× source scale that is roughly `225–255 × 390–435` pixels. Check the actual art in-game against both approved exteriors before locking; these are design targets, not a reason to stretch artwork or enlarge the whole Lab dramatically.

## Asset and registration contract

| Property | Proposed target |
| --- | --- |
| Source/master PNG | actual `genetics-lab-v1-master.png`, transparent sRGB RGBA, preserved unchanged |
| Source/master canvas | actual `1478 × 1064` pixels; normalization measurements below |
| Production WebP | `public/assets/world/farm/lab/farm-genetics-lab-main-v01.webp` |
| Production canvas | actual `1500 × 1080` pixels, transparent sRGB RGBA, lossless WebP with alpha |
| Runtime | `500 × 360`, origin `(0.5, 1)`, anchor `(2382, 1355)`; locked registration |
| Ground registration | visible front foundation/threshold meets bottom-center canvas baseline; no arbitrary clear strip below |
| Padding | aim for at least 45–60 source pixels at left, right, and top around meaningful art; keep all antialiasing inside canvas |

Fit the complete meaningful Lab silhouette uniformly. Preserve proportions; never stretch width and height independently or crop roof, integrated utilities, foundation, or doorway. If a generated source differs from the target canvas, preserve the master, inspect raw and meaningful alpha bounds, remove only detached near-invisible alpha noise when clearly justified, then normalize deterministically onto a transparent production canvas. Choose any small canvas revision from the actual accepted art measurements and document the revised registration before integration. Verify WebP decoding, alpha, lossless export, no clipping, and a clean silhouette against light and dark backgrounds. Do not bake terrain, Farm path, landscaping, broad cast ground shadow, or detached exterior props. The default package is **one complete main WebP**; no separate building shadow, duplicate glass layer, detached roof, or foreground layer. Add a narrowly scoped extra layer only after a demonstrated gameplay need.

## Copy/paste image-generation brief

> **THIS IS A GAME-WORLD BUILDING ASSET, NOT A STANDALONE ISOMETRIC ILLUSTRATION.** Create one complete, small Level 1 cactus Genetics Lab exterior for the CactiGrow Farm. Isolate the building on a genuinely transparent sRGB RGBA background. Target a 1500 × 1080 transparent source canvas with safe top and side padding and a bottom-center front foundation/door-threshold baseline. The architecture must be designed for a proposed 500 × 360 world-unit display, origin (0.5, 1), anchor (2420, 1355), with a centered south-facing entrance and a simple rectangular physical mass near X 2215–2625, Y 1100–1325. The invisible Farm plot and collision are gameplay data, not painted tiles or platforms.
>
> Match the approved Nursery V2 and original long Home V1 as members of the **same world**: stylized hand-painted 3D, clean semi-cartoon forms, medium detail, warm natural upper-left desert lighting, tactile materials, restrained texture noise, mature believable construction, and strong readability beside an 82 × 128 world-unit player at mobile zoom. Use the fixed elevated three-quarter camera looking down about 35 degrees, mild perspective, primarily south/front-facing facade, mostly horizontal front foundation, and a simple rectangular footprint. Avoid dramatic diagonal/isometric orientation and large projecting roof wings.
>
> Make this unmistakably a **specialized cactus genetics and propagation research facility** rather than a residence or greenhouse: warm stucco/masonry structure, darker timber or metal framing, selective glass windows, warm task lighting, subtle integrated vents/utilities, and controlled views of cactus specimens, propagation trays, and modest botanical measurement or microscope equipment **inside**. Keep the interior hints organized and the exterior uncluttered. Make the front door human-scaled and game-readable, visually around 75–85 × 130–145 world units beside the player, neither tiny nor dominating the facade. Ground the building with a clean connected foundation and a clear bottom-center threshold. The complete main image must read as a finished building without another layer.
>
> **Exclude:** terrain, path, landscaping, rocks, grasses, exterior decorative cactus clumps, people, text, signage, labels, UI, environment backdrop, broad cast ground shadow, detached props, separate roof, detached foreground layer, duplicate glass/building layer, hospital or generic office cues, giant industrial machinery, sterile white sci-fi, cyberpunk lighting, and childish proportions. Deliver only the isolated complete building with true alpha, no matte, no clipped edges, and no arbitrary transparent padding below its foundation.

## Acceptance checklist

### Visual review

- [x] Human review approves the Lab's distinct cactus research identity beside Nursery and Home.
- [x] Art, `500 × 360` scale, door alignment, and front/side/rear collision passed the final production-alpha walk-around.
- [x] The current path, approach, and navigation remain usable without geometry changes.

### Technical review

- [x] Preserve the original source master and record actual dimensions, hashes, alpha, meaningful bounds, and normalization steps.
- [x] Transparent production canvas with useful top/side padding, bottom-center threshold baseline, clean alpha, and no meaningful clipping.
- [x] Uniform scaling; lossless WebP decodes and pixel-matches the normalized master copy without color or proportion changes.
- [x] One complete main exterior with no detached shadow, terrain, path, landscaping, duplicate layers, or foreground occluder.
- [x] Phaser texture key/path, runtime size, origin, anchor, depth, collider, interaction, and `?worldDebug` agree with the locked registration.
- [x] The Lab route and exterior return remain wired to the current Farm navigation and spawn geometry.

## Actual V1 candidate measurement and normalization

The manually supplied source is `art-source/world/farm/lab/genetics-lab-v1-master.png`, SHA-256 `40a6d51406753d21826aa114872a74f2a716b81434382d4fabb92880120677ad`. It remains unchanged. It is **1478 × 1064**, sRGB PNG with RGBA/8-bit alpha. Raw nonzero alpha spans `1456 × 994` at `(0, 0)`: faint detached pixels reach the left and top source edges. At a 5% alpha threshold, the connected meaningful Lab artwork spans **1412 × 816** at `(39, 150)`, aspect ratio approximately **1.7304:1**, leaving source transparent padding L `39`, R `27`, T `150`, B `98` pixels. The meaningful silhouette touches no edge, though the side padding is narrower than the original 45–60 px aim. Sub-5%-opacity detached edge noise is visually meaningless and was removed only in the production copy.

The artwork is broad and low relative to its canvas: a left glazed propagation wing, central entrance and research dome, and right research room with integrated tank, pipework, vent and antenna. Planters and technical elements are visually connected to the building. The lowest visible foundation/central step is near source Y `965–966`; the glazed door sill is around Y `930–940`, roughly 25–35 px above the outer step. That foundation/step establishes the normalized bottom-center ground baseline.

Visual pixel inspection estimates the double glass door leaf at approximately source X `745–975`, Y `663–929`, or **230 × 266 px**. This is about **16.3%** of meaningful building width and **32.6%** of its height. The larger framed architectural opening is approximately X `724–993`, Y `645–937`, or **269 × 292 px** (19.1% width, 35.8% height). These are visual estimates, not exact segmentation. The opening is centered near source X `859`, about 120 px right of the meaningful-art center and about 120 px right of source-canvas center.

The production copy removes only alpha below 5%, crops to meaningful bounds `1412 × 816+39+150`, scales uniformly to **1410 × 815** within integer rounding, and places it bottom-center on a **1500 × 1080** transparent canvas. Final nonzero-alpha bounds are **1410 × 815 at `(45, 265)`**, leaving padding L `45`, R `45`, T `265`, B `0`. No meaningful artwork was cropped, stretched, recolored, or given a shadow, terrain, or effect. The resulting `public/assets/world/farm/lab/farm-genetics-lab-main-v01.webp` is sRGB RGBA-compatible lossless WebP with alpha; it decodes and matches the normalized PNG pixel-for-pixel (`0` differing pixels). The source and production aspect ratios differ by less than 0.03% from integer rounding.

At the **locked** `500 × 360` runtime display, the door leaf is estimated at **77 × 89 world units**, and the outer opening/frame at **90 × 97**. The `82 × 128` reference player is roughly as wide as the door leaf but noticeably taller than it. Human in-game review accepted the current visual relationship despite the earlier theoretical `75–85 × 130–145` target.

The active `500 × 360` display makes the meaningful building about `470 × 272` world units. The normalized door/opening center lies approximately 115 px right of production-canvas center, or about **38 world units right of the sprite anchor** at this size. The runtime anchor is shifted from the earlier proposed X `2420` to X `2382`, aligning the visible door near the existing X `2420` gameplay point. Human review approved this scale and registration. The initial single collider X `2177–2587`, Y `1100–1325` was replaced after walk-around feedback by the four locked regions above. The existing west path spur still ends at `(2180, 1210)`, not at the south door.

The master and production WebP remain unchanged. Phaser loads the production texture in place of the former Lab graybox. Path, interaction, navigation, sprite registration, and gameplay geometry remain unchanged from the reviewed implementation. The Lab V1 exterior is locked for the current production-alpha presentation; minor collision polish is deferred.
