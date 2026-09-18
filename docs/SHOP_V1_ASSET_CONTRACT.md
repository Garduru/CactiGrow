# Town Shop V1 production asset contract

Status: **HUMAN APPROVED / LOCKED.** The human-supplied source, lossless production WebP, runtime sprite registration, single rectangular collider, interaction, approach, and Town return have passed in-game World Editor tuning. Do not retune Shop V1 unless a future task explicitly requests a revision.

## Role and world relationship

The Shop is a permanent, welcoming small-town cactus-growing supply business. It sells growing supplies and items through the existing React `/shop` experience. Its shared Town exterior must read as a merchant storefront for pots, substrate, planters, tools, and propagation supplies, without implying actual stock or NPC behavior in the Phaser world. It is neither the Farm Nursery, where seeds grow, nor the larger future Marketplace/Exchange for player listings and trade. Keep it smaller, more intimate, and more supply-focused than the Marketplace.

## Previous graybox reference

These historical values came from the former Shop graybox. Its building art no longer renders when the production texture loads. The physical collider below has since been replaced by the human-approved rectangle; interaction, approach, and return coordinates happened to remain unchanged.

| Previous graybox property | Value |
| --- | --- |
| Town world | `2200 × 1500` |
| Shop layout center / rectangular main visual | `(650, 360)` / `420 × 250` |
| Main visual bounds | X `440–860`, Y `235–485` |
| Foundation strip | center `(650, 461)`, `420 × 48` |
| Graybox door | center `(650, 417)`, `88 × 136`; bottom/threshold Y `485` |
| Physical collider | one rectangle centered `(650, 390)`, `400 × 190`; bounds X `450–850`, Y `295–485` |
| Interaction | center `(650, 505)`, keyboard radius `105` |
| Pointer/touch selection | radius `210` around the interaction center |
| Approach and Town path endpoint | `(650, 560)` |
| `shop-exterior` return spawn | `(650, 560)` |
| Destination | `/shop`; return context brings the player back to Town |

The Shop has no separately authored logical placement footprint in the current Town layout. The visual rectangle must not be mistaken for a placement footprint or physical collision. Town paths, camera, player scale, navigation, and other facilities are outside this asset contract.

## V1 art direction and silhouette

Produce **one complete isolated game-world building**, in CactiGrow's locked stylized hand-painted 3D style: clean semi-cartoon forms, medium environmental detail, tactile materials, restrained texture noise, believable simplified construction, warm natural desert daylight, and a readable silhouette at mobile and overview zoom. Use Southwestern/desert small-business architecture: warm stucco or adobe walls, timber storefront and modest awning, a low stone foundation, restrained terracotta or weathered warm roofing, clear shop windows, and a visible central or near-central front entrance. A few organized pots, empty planters, soil/substrate bags, crates, small tools, or display shelves can communicate merchandise. Keep them attached to or immediately against the storefront and within one understandable ground footprint. Do not bake loose terrain, a long path, broad landscaping, or detached props into the sprite.

Use the fixed elevated three-quarter game camera, approximately 35 degrees downward, mild perspective, and a primarily south/front-facing facade. The main frontage should read mostly horizontally with only restrained side-wall visibility. Maintain a simple rectangular/square physical base; roof, awning, and sign may extend visually beyond it within transparent bounds. Do not render a diagonal standalone isometric illustration, generic house, greenhouse, lab, bazaar, chain store, futuristic building, or monumental civic exchange.

The integrated physical sign reads **SHOP** and was accepted in the human-reviewed artwork. It is part of the architecture rather than floating UI or repeated branding. The facade and merchandise remain recognizable without relying on the sign alone.

The entrance must look usable beside the current approximately `82 × 128` player and the approved Farm buildings. A centered or nearly centered door with a visible threshold and clear walk-up area is the art target. Avoid a tiny realistic door, an oversized dominating door, deep recesses, obstructing crates or plants, broad steps, and long attached paths. The current door's `88 × 136` graybox shape is a scale reference, not a mandatory finished-art measurement. Do not overfit to a number at the expense of the established player/building relationship.

## Approved production asset and registration

| Property | Current value |
| --- | --- |
| Preserved master | `public/assets/world/town/shop/shop-v1-master.png`; SHA-256 `E20C8CBD29C88415ECBA983A8636B192C78C696F3B1502E3E2749FC5710AF1` |
| Master dimensions / mode | `1487 × 1058`, sRGB RGBA |
| Raw nonzero-alpha bounds | `1405 × 1003` at `(34, 15)`; minimum transparent margins: left `34`, right `48`, top `15`, bottom `40` source pixels |
| Meaningful bounds at 5% alpha | `1394 × 863` at `(41, 99)`; meaningful content ends at source Y `961`, with `96` pixels below it |
| Visible backdrop inspection | Transparent corners and surroundings; no materially baked opaque or semi-opaque backdrop observed |
| Runtime main | `public/assets/world/town/shop/town-shop-main-v01.webp`; texture key `town-shop-main-v01` |
| Production format/canvas | Lossless WebP with alpha, unchanged full `1487 × 1058` canvas; decoded pixel comparison to master: ImageMagick AE `0` |
| Runtime display | `477.8638941398865 × 340` world units; human-approved World Editor values, proportional to the full source canvas within floating-point precision |
| Origin | `(0.5, 1)` bottom-center |
| World anchor / canvas baseline | `(650, 516)`; the meaningful lower artwork sits near world Y `485` after accounting for the source's transparent bottom margin |
| Building / local-player depth | `40` / `120` |
| Asset layers | One complete main exterior; no separate roof, facade, foreground, prop, or shadow layer |

The master is untouched. Production normalization only converted PNG to lossless WebP: no crop, repack, resize, repaint, color adjustment, or added shadow. The approved runtime dimensions preserve the full-canvas aspect ratio within floating-point precision. The approximately 31-world-unit difference between canvas baseline Y `516` and meaningful lower painted bounds accommodates the source's existing transparent bottom margin. The source does not touch a canvas edge with meaningful art. Its sign reads `SHOP`.

The background must be genuinely transparent RGBA: no colored rectangle, matte, sky, horizon, scenery card, terrain plane, or environment backdrop. Use warm upper-left daylight and a shaded awning, consistent with the Art/World Bible. Restrained immediate foundation/contact darkening within the main building is allowed. Do not paint a broad directional ground shadow or ship a separate building-shadow asset. Town ground, paths, and general landscaping remain world-level art.

## Geometry and later integration

Shop V1 uses **one human-approved rectangular collider** centered `(649, 336)`, size `460 × 261`, with exact bounds X `419–879`, Y `205.5–466.5`. The collider is independent of the full transparent canvas, roof, sign, and awning. Do not add bodies or retune this rectangle without an explicit Shop V1 revision.

The approved interaction is `(650, 505)` with radius `105`; pointer/touch selection radius remains `210`. The approved approach/path connection is `(650, 560)`, and the canonical `shop-exterior` return spawn is `(650, 560)`. The production Shop opens `/shop` and returns the player to Town at that spawn. These navigation values did not require retuning.

The human-approved World Editor values have been transferred to authoritative Town configuration. `/town?worldEdit` still exposes the Shop sprite, collider, interaction, approach, and return for temporary previews, but those drafts do not change this locked contract or source configuration. `?worldDebug` shows the production sprite bounds, collider, interaction zone, approach, and Town return diagnostics. The Shop graybox visual is disabled when the production texture loads. Marketplace, Road to Farm, and locked Farm art and geometry are unchanged.

## Original artwork acceptance checklist

- Complete uncropped building, sign, awning, foundation, and attached displays within clean transparent RGBA bounds; no opaque backdrop or edge fringe.
- Matches the approved Farm buildings' elevated camera, fixed yaw, mild perspective, upper-left daylight, tactile material treatment, and mobile-scale silhouette.
- South-facing mostly horizontal rectangular storefront, visibly a supply shop rather than a greenhouse, home, lab, or Marketplace.
- Clear central/near-central door and walk-up ground; natural scale beside the `82 × 128` player.
- Exactly readable integrated `SHOP` sign; restrained merchandise and no unsupported stock or vendor claims.
- No people, vehicles, UI, detached props, baked path/terrain, broad cast shadow, or separate shadow/foreground duplicate.
- Foundation and threshold can register bottom-center without cropping or nonuniform scaling; simple collision can protect the solid body while leaving access clear.
- Human in-game scale, collision, entrance, return, and mobile/overview review passes before any V1 lock.

Shop V1 has passed human runtime review and is now locked at the exact values above. This historical checklist and generation brief do not authorize changing the approved asset or geometry.

## Image-generation brief — Shop V1 main exterior

**THIS IS A GAME-WORLD BUILDING SPRITE, NOT A STANDALONE ISOMETRIC ILLUSTRATION.** Create one complete isolated exterior of the CactiGrow Town Shop: a permanent, welcoming small Southwestern cactus-growing supply storefront. Use the established CactiGrow production style, stylized hand-painted 3D with clean semi-cartoon forms, medium environmental detail, tactile warm stucco/adobe, timber, modest stone and terracotta materials, believable simplified construction, restrained texture noise, slightly exaggerated game-readable proportions, and a mature polished indie-game finish. Warm natural desert daylight comes from the upper left; the awning creates gentle local shade. Make the silhouette clear at phone and overview scale.

Use a fixed elevated three-quarter game view looking about 35 degrees downward, mild perspective and restrained side visibility. Face the main front facade south, primarily toward the player, so its frontage and low foundation edge read mostly horizontally. Keep a compact, straightforward rectangular ground footprint that can use one simple gameplay collider. Show a modest roof and timber storefront or small awning, readable display windows, and an obvious central or nearly central human-scale entrance with a clean threshold and open walk-up space. The same player is approximately 82 × 128 world units; the door should feel naturally usable beside that avatar and the approved CactiGrow Farm buildings, without dominating the facade.

Integrate a single physical mounted or hanging sign with the exact, legible word **SHOP**. Arrange a restrained selection of cactus-growing merchandise directly against the storefront: ceramic pots and empty planters, a few substrate bags or wooden crates, simple hand tools, and a small orderly display of decorative cactus/succulent specimens. The building must read first, with no crowded or detached prop field. This is where players buy growing supplies; it is **not** the Farm's glass greenhouse Nursery where plants are grown. It is a smaller, intimate merchant storefront, **not** the broader future Marketplace/Exchange for player trading. Do not invent people, vendor activity, stock counts, prices, or transaction UI.

Compose the **entire** roof, sign, awning, side walls, attached displays, door, and foundation comfortably inside a target `1440 × 1020` RGBA canvas. Leave useful but not excessive transparent padding above and to the sides. Register the visible front foundation/door threshold close to the bottom-center baseline, without a floating transparent strip below it. Keep all visible art uncropped and preserve the building's aspect ratio. Deliver an isolated building only on a genuinely transparent background, with no sky, horizon, brown or beige backdrop, ground card, terrain, long path, fence, broad landscaping, people, vehicles, UI, or frame. A little darkening within the immediate foundation is acceptable; **no broad cast ground shadow and no separate shadow layer**. The main asset must already be complete without a duplicated roof, facade, glass, foreground, or prop layer.
