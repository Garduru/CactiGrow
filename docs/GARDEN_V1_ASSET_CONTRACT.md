# Garden V1 production asset and Farm integration

Status: **HUMAN APPROVED / LOCKED.** Garden V1 passed in-game runtime review. The production asset, runtime registration, exterior collider, entrance/navigation coordinates, and six collection-display anchors below are the approved Garden V1 contract. Change them only through an explicit future Garden revision, not incidental cleanup.

## Gameplay boundary

**Nursery = plant and grow.** Seeds go into Nursery slots, plants grow there, and growing capacity is six slots at Level 1 and eight at Level 2. A future explorable greenhouse interior will map those slots to physical bench anchors and derive growing visuals from Nursery state. The locked Nursery V2 exterior is unchanged.

**Garden = collect, display, inspect, breed.** The React `/garden` screen manages the full owned specimen collection, including specimen inspection and breeding access. The Farm Garden is an exterior collection destination and may eventually display a curated subset. Its six empty beds are *collection display anchors*, not planting, growing, Nursery, or ownership slots. Neither growing capacity nor Garden ownership is limited by their count. The player walks around the exterior, not between the beds.

## Preserved master and normalized production image

| Property | Value |
| --- | --- |
| Preserved master | `public/assets/world/farm/garden/garden-v1-master.png` |
| Master size/color | 1671 × 941, sRGBA, sRGB, transparent |
| Master SHA-256 | `051A529F39ACAB60E70205C507B1BF4CFFF4132D147A3F7BF2C4C59066CFB267` |
| Raw nonzero-alpha bounds | 1657 × 906 at `(0, 35)`; faint edge alpha reaches left and bottom |
| Meaningful bounds (alpha at least 5%) | 1640 × 689 at `(15, 113)` |
| Production asset | `public/assets/world/farm/garden/farm-garden-main-v01.webp` |
| Production format/canvas | Lossless WebP, 1920 × 1080, sRGBA/sRGB with transparent background |
| Production visible bounds | 1830 × 769 at `(45, 311)`; padding left/right 45, top 311, bottom 0 |
| Normalization | Remove only alpha below 5%, crop to meaningful bounds, scale uniformly to 1830 px wide, and register bottom-center on canvas. Integer rounding changes the X/Y ratio by about 0.023%; no nonuniform resize was requested. |
| Decode check | Lossless WebP decode compared pixel-for-pixel with the normalized PNG: zero differing pixels. |

The master remains unchanged. The artwork is one complete Garden structure with six empty primary beds. Existing decorative vegetation outside the primary beds is part of the approved source image; no player-owned specimen was added. No cast shadow, plant sprite, or foreground duplicate was created.

## Runtime registration and collision

| Property | Current runtime value |
| --- | --- |
| Texture key | `farm-garden-main-v01` |
| Display | 640 × 360 world units |
| Origin | `(0.5, 1)` |
| Anchor / ground baseline | `(2390, 560)` |
| Sprite canvas bounds | X `2070–2710`, Y `200–560` |
| Depth | Building depth `40`, below local player depth `120` |
| Exterior collision | One approved rectangle centered `(2390, 420)`, size `600 × 220`; bounds X `2090–2690`, Y `310–530` |

The collision protects the visible structure and is independent of the transparent canvas. There are no individual bed or plant colliders and no internal walkable area. The former Garden graybox was 590 × 300 at center `(2390, 410)`, with 27 generic dots; its visual and collider have been removed. The current art registration and exterior collider passed human walk-around review.

The existing Garden layout, route, and return behavior remain: path endpoint and approach `(2390, 630)`, keyboard interaction radius `165`, touch selection radius `330` around layout center `(2390, 410)`, exterior return spawn `(2390, 630)`, and destination `/garden`. The visible front entrance is centered toward the existing approach. No registration or navigation adjustment was necessary for this first review.

## Approved collection-display anchors

These are renderer metadata only. They do not select plants, mutate `ownedPlants`, change Garden capacity, or cause growth.

| ID | World coordinate |
| --- | --- |
| `garden-display-back-left` | `(2250, 390)` |
| `garden-display-back-center` | `(2390, 390)` |
| `garden-display-back-right` | `(2530, 390)` |
| `garden-display-front-left` | `(2250, 455)` |
| `garden-display-front-center` | `(2390, 455)` |
| `garden-display-front-right` | `(2530, 455)` |

Current V1 flow: owned Garden collection -> explicit player assignment of specimen ID to one of six named display slots in application state -> narrow viewer-appropriate Garden renderer projection -> six locked physical anchors -> Phaser plant-only visuals. Approved Normal San Pedro stages use production art; other species, missing assets, and unsupported visual features retain fallbacks. Empty slots are valid; collection never automatically assigns a specimen. One specimen cannot occupy multiple slots. Clearing a display assignment preserves ownership. Assignments are in-memory and do not survive a full page reload. The full collection remains in React `/garden` even if more than six specimens are owned. Garden plants root directly in soil with no intrinsic pot. Private genetics and provenance must not leak to future visitors.

## Human runtime approval

- Walk the left, right, rear, and front edges. Confirm no invisible gap feels excessive and the player cannot walk through visible structure.
- Approach the visible front entrance and enter `/garden`; return to the Farm and confirm the exterior spawn feels natural.
- Compare Garden scale, silhouette, and baseline against the locked Nursery, Home, and Genetics Lab at normal and overview zoom, including phone-sized viewports.
- Use `?worldDebug` to inspect sprite bounds, exterior collider, interaction/approach/return markers, and six labeled **DISPLAY** anchors. None should appear in normal play.
- Confirm all six primary beds stay empty and the Garden collection, Nursery growing slots, breeding, player depth, and movement still behave as before.

Garden V1 is **human approved and locked**. Preserve its asset, display size, origin, anchor, depth, collider, entrance/navigation coordinates, and all six display anchors exactly as recorded. Explicitly assigned owned specimens now render at those anchors; this does not loosen the exterior contract.
