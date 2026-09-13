# CactiGrow project context

## Product and architecture

CactiGrow is an independent cactus-growing game built with TypeScript, React, Vite, React Router, and ESLint. The old Base44 game is a gameplay and visual reference only. CactiGrow must operate and evolve independently of CactiSwap.

Do not build CactiGrow on Base44. Growth, genetics, breeding, nursery, Garden, inventory, marketplace, progression, achievements, game data, Farm world, saves, and admin/content configuration must remain independent. Future CactiSwap identity or shared-currency integration must live behind a replaceable service/adapter. Do not scatter Base44 calls through gameplay or UI code.

Do not add major dependencies without a clear need. React handles the HUD, inventory, plant details, commerce, settings, achievements, dialogs, and collection management. Consider Phaser only when Farm/Nursery scenes actually need layered animation, object interaction, drag/drop, or world navigation; never make the entire application Phaser-based.

## Navigation and gameplay direction

- Farm is Home and the primary navigation world, with no separate dashboard or permanent world navbar.
- Click physical Farm locations to enter Nursery, Garden, Shop, and Marketplace.
- Nursery handles planting seeds, growth, collecting mature plants, capacity and upgrades; trays, benches, and pots can come later.
- Garden replaces the player-facing Collection name. It will display prized plants, expose the full collection, and open specimen details.
- Breeding starts at Garden > plant details > Breed > second parent > workflow. It is not a primary destination.
- Selling starts at plant details, through NPC sales or marketplace listings. Marketplace handles buying, player listings, and eventual trade history.
- Inventory belongs in the HUD, showing total seed count. The current inventory route is acceptable until a compact panel is useful.
- The bottom-right utility menu contains only Achievements, Grow Log, Settings, Help, and CactiSwap. Never put world destinations there.
- Interior screens provide a small Back to Farm link. Maintain real routes and working browser history/deep links.
- Canonical routes: `/` (Farm), `/nursery`, `/garden`, `/market`, `/shop`, `/inventory`. `/farm`, `/collection`, and `/marketplace` redirect to canonical destinations. The existing `/breeding` workflow placeholder remains unpromoted.

## Visual direction

Preserve the warm cactus/desert identity: near-black/dark brown surfaces, burnt orange/copper accents, muted tan secondary text, rounded cards, and serif major headings. Avoid giant empty spaces, oversized navigation, clutter, and stretched mobile/dashboard layouts. Use desktop/tablet width intelligently and remain responsive down to 320px.

Use one compact supplied CactiGrow logo, without separate emoji branding or a tagline. **Explicit user-approved exception:** the full supplied logo may retain its embedded "by CactiSwap" credit in the HUD. Do not add another permanent CactiSwap control to the HUD.

The compact HUD retains mock tokens, Inventory/Seeds, level, username, and XP. Aim for approximately 56px desktop height and allow narrow-screen wrapping. Keep the utility panel about 160px wide with short desktop rows, modest padding, and accessible touch targets.

## Current foundation and immediate scope

Use the existing feature-based organization (`src/features`), shared layout/UI components, types, styles, and centralized data. Early models include Species, GrowthStage, Plant, PlantGenetics, InventoryItem, and PlayerProfile; these may evolve. Species data stays centralized in `src/data/species.ts`; do not duplicate values across features. Long term, content should be editable without rewriting feature code.

The current pass refines the shell, replaces temporary GameNav with a simple React/CSS/SVG Farm world, and renames Collection to Garden. Farm locations have separate metadata and visual rendering so artwork can be replaced. Feature screens and utility functions remain placeholders. Do not begin gameplay systems, backend, or deployment as part of this pass.

## Later roadmap

1. Core shell, routes, Farm navigation, Garden naming, responsive layout.
2. Domain systems: species, plants, growth, seeds, nursery slots, inventory, Garden, plant details.
3. Genetics, traits, mutation, parent selection, offspring, and lineage.
4. Shop, NPC selling, marketplace, currency costs/rewards, and transaction history.
5. XP, levels, achievements, objectives, unlocks, and Farm expansion.
6. API, authentication, persistence, server-authoritative actions, and anti-cheat validation.
7. Optional CactiSwap identity/shared-currency adapter.
8. Final world artwork and interactions; Phaser only if justified.
9. Deployment, PWA, optional mobile packaging and desktop/Steam support.

Likely later technologies are Cloudflare Workers, PostgreSQL, Cloudflare R2, Tauri, and Capacitor or similar. These are directions, not instructions to install, connect, or deploy anything now.

## Working conventions

Inspect existing code before editing. Prefer small typed components, readable names, shared configuration, and separation of gameplay logic, rendering, and external integrations. Make incremental visible changes; avoid unrelated rewrites, premature abstractions, duplicated constants, and unnecessary dependencies. Preserve uncommitted user work. Remove `.gitkeep` when a directory gains actual files.

After meaningful edits, run `npm run build` and `npm run lint`, fix introduced errors, and report changed files and validation results. Check relevant responsive navigation and accessibility in the browser. Do not commit automatically.
