# San Pedro V1 plant asset contract

Status: **SOURCE ART HUMAN APPROVED; TECHNICAL INTEGRATION COMPLETE; RUNTIME VISUAL HUMAN APPROVED.** Four cleaned Normal San Pedro masters are preserved outside `public`, and their production WebPs are registered for the shared React/Phaser plant renderer. The reviewed stage-relative scale, Garden display, neutral preview, and temporary Nursery pot presentation are approved. Unavailable art and unsupported expressed features still use the existing fallbacks.

## Identity and visual stages

Use the existing species ID and visual key `echinopsis-pachanoi` from `src/data/species.ts`; common name San Pedro, scientific name *Echinopsis pachanoi*. Do not create another species identity.

| Visual stage | Current Nursery presentation interval | Art target on common canvas |
| --- | --- | --- |
| Seedling | 0.15 to below 0.40 | Tiny rooted sprout, early columnar gesture. |
| Juvenile | 0.40 to below 0.65 | Clearly recognizable upright San Pedro, emerging ribs. |
| Developing | 0.65 to below 1 while `isMature === false` | Near-final column with growing mass and stronger ribs. |
| Mature | `isMature === true` | Full readable column, confident ribs, restrained natural branching if used. |

Before these four canonical artwork stages, progress 0 to below 0.15 is **Germinating**: an occupied pot only, with no cactus, seed, visible soil, or shadow. Germinating is a Nursery presentation state, **not** a fifth canonical plant artwork stage. At `isMature === true`, Nursery shows **Ready to Collect** with mature artwork. The gameplay stage can read `mature` earlier, but neither the artwork nor this contract changes collection eligibility. A collected specimen uses mature visual art.

## Art direction

Match the locked CactiGrow style: stylized hand-painted 3D with clean semi-cartoon forms, medium detail, tactile materials, believable botanical construction, restrained texture noise, warm natural desert lighting from upper left, and a clean silhouette at mobile/overview scale. Use an upright columnar gesture, distinct longitudinal ribs with broad rounded valleys, sparse short spine clusters rhythmically placed on rib areoles, and blue-green to warm-green plant color. Younger growth may be brighter. Mature growth gains height and basal mass; any branching must read as San Pedro rather than generic saguaro arms.

Keep one consistent camera/light/view family across stages, compatible with the Farm's fixed elevated three-quarter view (about 35 degrees down, restrained perspective). The plant should sit naturally beside the approved Farm/Town art. Avoid photorealism, flat vector or pixel art, generic low-poly shapes, childlike exaggeration, extreme saturation, noisy micro-detail, and photographic backgrounds. Review every stage both close and at actual world size.

## Plant-only transparency and registration

Each asset is **only the cactus**, isolated on a genuine RGBA transparent canvas. Do not bake in a pot, planter, Garden bed, soil mound, bench, terrain, rocks, grass, landscaping, scenery, UI, label, readable text, checkerboard, backdrop, ground plane, or cast shadow. No glow, halo, aura, or bloom. A small natural stem/root transition at the very base is acceptable. Garden soil integration, the Nursery-owned pot/front-rim occlusion, and neutral React preview framing are separate presentation layers.

This plant-only boundary follows the newer [`PLANT_RENDERING_SYSTEM_V1.md`](PLANT_RENDERING_SYSTEM_V1.md) decision where older Art Bible wording groups pots or pot assignment with specimen composition. Pots are presentation context, not an intrinsic genetic or plant-art layer.

Use the same canvas and a single authoritative planting baseline for every stage:

- Approved cleaned source: **1024 x 1536 px RGBA PNG** for each stage. These preserved source canvases have unequal painted bounds and are not bottom-registered; normalization applies only to production copies.
- Production export: **512 x 768 px transparent lossless WebP** for each stage. The approved cleaned masters need stage-specific **uniform** scaling and bottom-center placement before the final 50% canvas downscale. Keep the aspect ratio and complete visible alpha.
- Planting baseline: normalized 1024 x 1536 working canvas `(512, 1536)` and production `(256, 768)`, at bottom center. Visible stem/base alpha may reach the final pixel row (`y = 1535` working canvas / `y = 767` production); do not add arbitrary transparent padding below it. Keep the emergence point centered on `x = 512` working canvas / `x = 256` production.
- Texture origin: **`(0.5, 1)`**. The origin registers the shared canvas bottom center to a Garden display anchor, Nursery pot emergence point, or React preview baseline. The scene may add context-specific occlusion, but must not correct individual stage registration by hand.
- Leave at least **96 px normalized working canvas / 48 px production** transparent side padding around the mature silhouette and at least **160 px working canvas / 80 px production** above its tallest painted point. Earlier stages naturally have more transparent space above and beside the plant. Do not stretch each visible plant to fill the canvas.
- Keep anti-aliased alpha edges clean, with no opaque fringe, baked checkerboard, detached pixels, or clipped spines. For any future atlas, preserve this registration and add the Art Bible's runtime extrusion/padding outside the asset frame.

These canvases preserve four-stage scale through **progressively occupied alpha bounds**, not different renderer scale multipliers. The 1024 x 1536 masters provide ample close-inspection source resolution while the half-size runtime exports avoid four unnecessarily large textures. Lossless WebP preserves transparent edge quality and matches the successful building export workflow; verify actual browser/Phaser decode before approval. Retain the PNG masters as source art outside Vite's `public` runtime tree.

## Relative growth and initial display scale

All four production textures should initially display with the same **512 x 768 source-frame aspect ratio**. For Garden review, start with a **53.333 x 80 world-unit canvas** at each locked display anchor, origin `(0.5, 1)`. These are proposed *plant* values, not changes to the Garden's locked 640 x 360 building sprite, six anchor coordinates, collider, navigation, or local-player depth. Garden plants must remain potless and rooted visually in their existing beds. World visuals remain above the Garden exterior and below the local player.

Target **visible plant** bounds within the normalized 1024 x 1536 working canvas (measure meaningful alpha, ignoring isolated near-transparent noise):

| Stage | Visible height target | Approx. visible width | Approx. visible Garden height at 80-unit canvas |
| --- | ---: | ---: | ---: |
| Seedling | 360-440 px | 120-200 px | 19-23 world units |
| Juvenile | 680-760 px | 260-360 px | 35-40 world units |
| Developing | 1000-1080 px | 420-560 px | 52-56 world units |
| Mature | 1280-1360 px | 620-760 px | 67-71 world units |

All heights measure upward from the same bottom baseline; they are not independently normalized. The mature plant should remain well within the 140-unit spacing between Garden columns and read clearly across the 65-unit back/front anchor offset. Mild foreground overlap can be reviewed in play, but the plants must not overwhelm the locked Garden structure or obscure its entrance. These are first-pass sizes for human runtime tuning, not a license to move the locked Garden anchors. At the current max Farm zoom of 1.5, a 71-unit mature silhouette is roughly 107 screen pixels tall; the 768-pixel production export and 1536-pixel master support this and larger focused React inspection without upscaling the source.

React `PlantVisual` uses a 72-pixel Garden card preview, a 100-pixel Plant Details preview, and a shared 72-pixel production-art canvas in Nursery. The Nursery keeps its earlier stage-sized SVG fallbacks when approved art is unavailable. The shared texture canvas preserves distinct painted stage heights; the simple front-facing Nursery pot overlaps only the cactus base. It has no visible soil or pot/ground shadow. The future walkable Nursery interior will need authored pot anchors but no separate San Pedro plant master.

## Exact files

Use `art-source/plants/species/echinopsis-pachanoi/` as the authoritative preserved-master directory, outside Vite's `public` runtime tree. The original supplied masters remain for provenance; the human-approved cleaned review files were copied byte-for-byte to the `*-master-clean.png` paths below. Each cleaned source is 1024 x 1536 sRGBA with genuine transparent pixels. Ship only normalized WebPs from the plant asset hierarchy. Each stage has one Normal base asset:

| Stage | Preserved PNG master | Production WebP loaded by future manifest |
| --- | --- | --- |
| Seedling | `art-source/plants/species/echinopsis-pachanoi/san-pedro-seedling-v01-master-clean.png` | `public/assets/plants/species/echinopsis-pachanoi/plant-echinopsis-pachanoi-seedling-base-v01.webp` |
| Juvenile | `art-source/plants/species/echinopsis-pachanoi/san-pedro-juvenile-v01-master-clean.png` | `public/assets/plants/species/echinopsis-pachanoi/plant-echinopsis-pachanoi-juvenile-base-v01.webp` |
| Developing | `art-source/plants/species/echinopsis-pachanoi/san-pedro-developing-v01-master-clean.png` | `public/assets/plants/species/echinopsis-pachanoi/plant-echinopsis-pachanoi-developing-base-v01.webp` |
| Mature | `art-source/plants/species/echinopsis-pachanoi/san-pedro-mature-v01-master-clean.png` | `public/assets/plants/species/echinopsis-pachanoi/plant-echinopsis-pachanoi-mature-base-v01.webp` |

The production normalization trimmed only transparent canvas surrounding the approved alpha, resized each complete cactus uniformly to approximately 400, 720, 1040, and 1320 source-canvas pixels high, centered it horizontally, placed the visible base on the bottom baseline, and downscaled the full transparent canvas to 512 x 768. It did not stretch, recolor, sharpen, or add effects. The decoded WebPs are VP8L lossless with alpha. Their nonzero-alpha bounds are respectively `117 x 200 at (197,568)`, `183 x 360 at (164,408)`, `204 x 520 at (154,248)`, and `284 x 661 at (114,107)` on the 512 x 768 canvas. All four touch the bottom pixel; visible heights on an 80-unit Garden canvas are approximately 20.8, 37.5, 54.2, and 68.9 world units.

`src/data/plantVisualAssets.ts` registers the four production paths with deterministic texture keys `plant-echinopsis-pachanoi-{stage}-base-v01`. The shared descriptor resolves the Normal stage asset. Expressed visual features without art retain a partial-support fallback; missing assets or other species retain the fallback renderer. The production assets and their runtime presentation have passed human review.

Do not create empty asset files or placeholder images. The runtime URL for each WebP is its production path beginning at `/assets/plants/...`; `public` is not part of the browser URL.

## Variation and future feature art

The current descriptor derives stable `paletteIndex` (0-2), `formIndex` (0-2), and `scaleBucket` (0-2) from `cloneLineId`, plus `orientationIndex` (0-2) from physical specimen ID. Current React/Phaser fallbacks visibly use only three restrained palette choices, approximately -2/0/+2 degree orientation, and 1/1.025/1.05 scale. `formIndex` is **reserved but not rendered**; do not claim three authored forms already exist. With one approved stage asset, the same mild rotation and scale may be retained after visual review. Tinting should stay within the approved blue-green/warm-green palette and must not flatten painted lighting, wash out ribs, or imply Variegated/Shiny. Avoid horizontal offsets that break the baseline or pot registration. More significant branching, rib, growth-form, or color-pattern differences require authored variants or modules rather than stretching or hue-shifting one image.

Normal base art should have clean alpha, a legible outer contour, separable rib/areole/spine detail, and consistent light direction to support later registered masks/modules. Preserve editable layered source art if available in addition to each flattened PNG master. Variegation needs plant-conforming pigmentation masks; Crested, Monstrose, Melted, Spiral, and Dichotomous can require authored replacement morphology (not a mere tint); dense spination needs a registered spine treatment; Shiny needs a restrained species-respecting separate treatment. Combinations need reviewed compatibility recipes. None of these assets is required or produced by this V1 Normal-base contract, and gameplay feature truth remains in existing state even when a visual module is unavailable. Do not bake pots, soil, or environmental effects into any future canonical plant module.

## Acceptance and later integration

Before accepting each master/export:

1. Confirm San Pedro botanical silhouette, ribs, sparse short spines, stage progression, consistent camera/light, and downsample readability next to approved Farm art.
2. Verify 1024 x 1536 cleaned-source and 512 x 768 WebP dimensions; genuine RGBA alpha; no background, pot, soil, scenery, cast shadow, detached artifacts, clipping, nonuniform scaling, or unexpected color change. Inspect meaningful alpha bounds and the common bottom-center baseline in the normalized production exports.
3. Decode every lossless WebP, inspect edge pixels against dark and light backgrounds, and compare with its downscaled PNG normalization reference. Preserve masters unchanged and record source/export hashes in a later production handoff.
4. Review all four in the locked Garden at normal/overview/mobile zoom and in the existing React Garden/Plant Details and Nursery pot contexts. Confirm stage heights remain distinct, the base sits in soil/pot, the 140-unit columns and 65-unit rows remain readable, and no UI preview distorts aspect ratio.
5. Confirm explicit Garden assignment/clearing, ownership, growth eligibility, and other V1 gameplay remain unchanged. Human approval is required before the fallback is replaced.

The four Normal stage assets are in the manifest and loaded by `FarmTestScene`; Phaser uses a texture when present and keeps its geometry fallback if loading fails. React uses the same resolved path with an image-error fallback. Human runtime review approved their registration, stage-relative scale, Garden placement, neutral preview, and Nursery pot alignment. Preserve the cactus-only assets and reviewed presentation unless an explicit future revision is requested.
