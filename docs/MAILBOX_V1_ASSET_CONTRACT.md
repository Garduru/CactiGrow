# Mailbox V1 production asset and Farm integration

Status: **HUMAN APPROVED / LOCKED.** The source image, runtime scale and placement, compound collision, and omnidirectional interaction passed human Farm walk-around review. Do not revise Mailbox V1 without an explicit future revision request.

Mailbox is a small physical Farm mail station, not a major building or an explorable interior. It opens the existing `/mail` experience for persistent asynchronous mail. Its roof and sign can rise above the player while the station remains clearly smaller than Home, Nursery, Genetics Lab, and Garden.

## Asset measurements and normalization

| Property | V1 value |
| --- | --- |
| Authoritative master | `art-source/world/farm/mailbox/mailbox-v1-master.png` |
| Master SHA-256 | `04DED3CD880E4257908E2F392233B75CB9A5932EA4BC8F31C71A5D33D7182C43` |
| Master dimensions / color | 1536 × 1024, sRGB RGBA |
| Raw nonzero-alpha bounds | 1395 × 1024 at `(0, 0)` |
| Bounds at 5% alpha | 1284 × 1010 at `(109, 9)`; not used for cropping |
| Production asset | `public/assets/world/farm/mailbox/farm-mailbox-main-v01.webp` |
| Production canvas | 1536 × 1024, lossless WebP with the master alpha and full canvas preserved |
| Production raw / 5% bounds | Identical to the master |
| Pixel validation | Decoded production WebP has zero differing pixels against the master (ImageMagick AE metric `0`) |

The master is unchanged. Production normalization is a lossless format conversion at native dimensions: no crop, scaling, matting, background removal, recolor, new elements, foreground duplicate, or separate cast-shadow sprite. The accepted source already includes its own decorative stone, plants, packages, lantern, and ground treatment. These are visual only and do not create separate collision.

## Approved Farm registration

| Property | Runtime value |
| --- | --- |
| Texture key | `farm-mailbox-main-v01` |
| Display size | 300 × 200 world units; exact 3:2 source ratio |
| Origin | `(0.5, 1)` |
| Anchor / canvas baseline | `(1120, 1640)` |
| Sprite canvas bounds | X `970–1270`, Y `1440–1640` |
| Building / local-player depth | `40` / `120` |
| Lower footprint collider | Center `(1117, 1586)`, size `247 × 104`; bounds X `993.5–1240.5`, Y `1534–1638` |
| Upper wooden-structure collider | Center `(1124, 1491)`, size `174 × 90`; bounds X `1037–1211`, Y `1446–1536` |
| Interaction center / keyboard radius | `(1120, 1575)` / `160`, accessible from all four sides |
| Touch selection | Radius `150` around interaction center `(1120, 1575)` |
| Click/tap side approaches | Front `(1120, 1665)`; back `(1120, 1435)`; left `(965, 1575)`; right `(1275, 1575)` |
| Path endpoint | No dedicated Mailbox path branch exists; click/tap moves toward the nearest reachable side approach |
| Exterior return spawn | `mailbox-exterior` at `(1220, 1665)` |
| Route | `/mail` |

The `82 × 128` temporary player is the scale reference. A 200-unit station height leaves the roof/sign above the avatar; 300-unit width remains below every major Farm production asset. Human tuning established two rectangles: a lower physical footprint and an upper wooden-structure collider. Mailbox is an intentional compound-collider exception to the simple-building guideline. Individual decoration and the full roof overhang have no separate collision.

Mailbox has no doorway or required front entrance. Pressing E from any side opens `/mail` when the player is within the 160-unit radius and outside collision; the nearby interaction prompt follows the player rather than staying at the front/right return position. Clicking or tapping from farther away selects the nearest of the four side approaches rather than forcing the front/right return coordinate. The canonical return spawn remains `(1220, 1665)`, south of the lower collider. These values are the human-approved V1 configuration.

`?worldDebug` shows the sprite bounds and anchor, both labeled colliders, interaction center and radii, four labeled side approaches, and return spawn. Normal play shows none of these markers.

## Completed human runtime review

- Compare Mailbox station size with the player and all four locked Farm exteriors at normal and overview zoom.
- Test E and the interaction prompt from front, back, left, and right while standing outside collision.
- Click/tap from each side and confirm the player chooses that side's reachable approach instead of crossing the station.
- Walk around every side; verify the player cannot cross the main or upper wooden structure and is not unnecessarily blocked by decoration.
- Tap/click the station, enter `/mail`, and return to the Farm at `(1220, 1665)` without overlap or an awkward gap.
- Inspect the accepted V1 background/alpha presentation against Farm terrain at normal zoom, without treating the source as a new transparency gate.

Mailbox V1 is locked. Changes to its artwork, registration, compound collider, interaction, approaches, or return spawn require an explicit future Mailbox revision.
