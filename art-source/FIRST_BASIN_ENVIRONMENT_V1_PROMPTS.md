# First Basin Environment V1 raster source prompts

Tool: built-in `image_gen.imagegen`; source images are generated raster artwork. Reference inputs are accepted desert and settlement atlases, used only for style. The exporter performs deterministic cropping, proportional resizing, alpha registration, and PNG packing. No accepted artwork is changed.

Runtime contract: CactiGrowFirstBasinExtensionV1, 1024×512, 32 cells of128 pixels; cave grounds0–7, cave connected walls8–23, shared props24–31.

## Selected source provenance

All originals remain at their built-in tool output locations; selected images were copied into the repository unchanged. The three source masters are immutable authored input to `scripts/pack-basin-environment-v1.py`.

| Source master under art-source/world/first-basin | Actual dimensions | SHA-256 |
| --- | --- | --- |
| world-first-basin-ground-v01-master.png | 1774×887 | e52926ea1e4c7cfcecc77a4b57dee3b19482dce220dffc869450b9bd1f26a9fc |
| world-first-basin-cave-walls-v01-master.png | 1254×1254 | aafec03f0da68f7a0b38db46dcb2f57a85deb310cffc2e1d4cfb31a2ae977584 |
| world-first-basin-props-v01-master.png | 1774×887 | f4ee797c38a70ee00296c4b27020adbb6c30417b620cf0f81768ec05c597afce |

Tool output directory: `C:/Users/yourt/.codex/generated_images/01a1158f-faea-77f0-bb0d-c042931da8e9/`.

- Ground: `exec-0662587f-cb14-4f82-8d1f-8fdad4fc9468.png`.
- Walls: `exec-a48b2b6b-724e-4ed7-a82d-4e24f13e9de9.png`.
- Props: `exec-6e84b5f1-3164-48ec-8dc7-6b7da93d2730.png`.

Style reference inputs: `public/assets/world/tiles/world-desert-master-v01.png` and `public/assets/world/tiles/world-settlement-master-v01.png`, both preserved unchanged. The generated prop sheet uses genuine alpha. A few complete subjects extend beyond their logical source cell; deterministic alpha component isolation retains those silhouettes and their original edge alpha before proportional fitting. No source is repainted or recolored.

## Cave ground master

Use case: stylized-concept. Asset type: reusable painterly top-down RPG cave floor material source sheet for CactiGrow First Basin Environment V1.
Input images are STYLE REFERENCES ONLY: the accepted desert atlas and settlement atlas. Generate a NEW distinct cave material sheet, never reproduce or edit those reference images.
Create ONE landscape 2:1 image, 4 columns by 2 rows of equal square logical cells, requested 1536x768. Eight opaque full-bleed material tiles, no labels, no grid borders and no margins. Each row is effectively one continuous equally lit material strip; four subtle variations are distinguished by tiny stone/debris details only, not brightness or color. Keep all four cells in each row the SAME average color and SAME colors on every edge for seamless random repeats. No cell center gradients, no vignette, no rectangular tile brightness quilt.
Row1: dusty cave stone floor, muted medium-light gray taupe limestone with delicate warm sandy dust, a few tiny irregular pale pebbles and faint restrained cracks. Very low contrast, mostly quiet walkable space.
Row2: cave compacted earth floor, medium gray-brown mineral earth, slightly darker than row1 yet clearly readable, smooth and sparsely gritty, subtle warmer ochre-brown dust. Same quiet low contrast.
Style: hand-painted raster game material, readable simple masses, softly textured shading related to warm sand desert family. Cave cooler and more mineral than outdoors, soft neutral ambient with very restrained warm upper-left reflected light. Flat top-down ground, no directional surface shadows or highlights that form seams. Opaque everywhere. No neon, glowing crystals, lava, mushrooms, vegetation, walls, giant stones, objects, people, text, logos, black backgrounds, excessive orange, high contrast noise, repetitive dots, or visible cell boundaries.

## Cave connected wall master

Use case: stylized-concept. Asset type: connected cave boundary wall raster source sheet for CactiGrow First Basin Environment V1.
Input images are STYLE REFERENCES ONLY: accepted desert and settlement atlases. Generate a NEW hand-painted cave rock wall atlas, preserving their readable warm desert family while using cooler muted gray-taupe limestone and umber shadows, very faint warm upper-left cave bounce, no orange saturation. Square image requested1536x1536 with exactly4 columns×4 rows of16 equal square tiles, opaque full-bleed, NO labels/divider lines/grid padding.
Each tile is a top-down with slightly visible south face cavern rock boundary. It occupies the cell as a solid rock mass with a soft irregular edge toward unconnected sides, and reaches the exact edge with continuous rock material toward connected sides. The consistent stone rock top and shaded lower face visually identify blocked boundary cells. These are tiled walls, not individual decorative boulders. Restrained broad forms, shallow stratified limestone slabs, quiet texture. No bright dots or repeated orange cracks. Shadows contained within the cell.
Use the following exact neighbor connectivity positions in row-major order. N means join the cell above, E right, S below, W left:
Row1: isolated rock wall cap (no connections); N only; E only; N+E corner.
Row2: S only; N+S vertical wall; E+S corner; N+E+S three-way.
Row3: W only; N+W corner; E+W horizontal wall; N+E+W three-way.
Row4: S+W corner; N+S+W three-way; E+S+W three-way; N+E+S+W solid intersection.
Where an edge connects, the rock top material should meet the matching next tile seamlessly; corners irregular but coherent. Keep all tiles same scale/palette/lighting with medium-dark cave rocks distinguishable from medium-light walkable cave dusty floor. No complete cave map, no perspective scene, no text, people, plants, crystals, neon, metal, doors, tunnels painted onto the rocks, black rectangles, or UI. Actual collision is authored separately; this is reusable boundary presentation.

## Shared environment props master

Use case: stylized-concept. Asset type: reusable CactiGrow First Basin / cave environment raster props.
Input images are STYLE REFERENCES ONLY: accepted desert and settlement atlases. Create a NEW landscape2:1 source sprite sheet requested1536x768, exactly4columns×2rows of8 individual top-down oblique painterly game prop sprites. Genuine transparent background including gaps and margins. No painted backdrop, ground square, labels or grid.
One complete isolated subject per logical square cell, centered horizontally, resting at a common foot baseline near93% of its cell height. Keep wide transparent margins (at least8% left/right/top and5% bottom), never touch adjacent cells. No silhouette or contact shadow spills into another cell. Small restrained contact shadow on transparent alpha; no broad cast shadows. Consistent upper-left daylight/ambient bounce. Readable painted shapes with muted mineral gray/tan limestone, soft olive/sage cactus greens, warm dusty desert wood, same style family as reference accepted cactus game art.
Row1 left to right:
1 loose mineral rubble: a small low cluster of4–6 irregular warm-gray stones and chips, understated cave/outdoor debris, no crystal shapes.
2 dry root debris: a low weathered root and twig tangle, gentle gray-brown dry wood, not a whole tree.
3 weathered mineral rock: one squat layered limestone boulder with a few dark seams, visually heavier gray-tan stone.
4 damp floor patch: a very subtle irregular cool-gray mineral darkened dust patch with a couple small stones, flat and broad, no blue water or shiny puddle.
Row2 left to right:
5 stratified rock pillar: tall distinctive irregular natural limestone column/outcrop with broad layered top, narrow cracked lower shaft and grounded base stones, recognizable silhouette, pale tan-gray rock, NOT an arch or building. Full tall silhouette inside cell.
6 wild cactus cluster: distinctive natural grove of one taller columnar cactus and3–4 smaller prickly pear and barrel cactus, restrained muted greens and small warm spines, no pots, natural ground cluster.
7 trail cairn: a modest asymmetrical three-stone cairn beside a short sun-worn blank wood trail stake, no arrow or writing, weathered believable hiking marker, no quest glow.
8 rockslide barrier debris: broad dense low pile of large angular layered stones mixed with two weathered broken timber braces, visibly route-blocking rubble, no fences across the frame and no text.
No people, buildings, production machinery, neon, crystals, collectibles, flowers, fake quest signage, invented inscriptions, giant round cast shadows, cartoon outlines, black/white backdrops, or extra objects. Preserve alpha transparency.
