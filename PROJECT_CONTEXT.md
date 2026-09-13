# CactiGrow project context

## Product and architecture

CactiGrow is an independent cactus-growing game built with TypeScript, React, Vite, React Router, and ESLint. The old Base44 game is a gameplay and visual reference only. CactiGrow must operate and evolve independently of CactiSwap.

Do not build CactiGrow on Base44. Growth, genetics, breeding, nursery, Garden, inventory, marketplace, progression, achievements, game data, Farm world, saves, and admin/content configuration must remain independent. Future CactiSwap identity or shared-currency integration must live behind a replaceable service/adapter. Do not scatter Base44 calls through gameplay or UI code.

Do not add major dependencies without a clear need. React handles the HUD, inventory, plant details, commerce, settings, achievements, dialogs, and collection management. Consider Phaser only when Farm/Nursery scenes actually need layered animation, object interaction, drag/drop, or world navigation; never make the entire application Phaser-based.

## Navigation and gameplay direction

- Farm is Home and the primary navigation world, with no separate dashboard or permanent world navbar.
- Click physical Farm locations to enter Nursery, Garden, Shop, Marketplace, and Genetics Lab.
- Farm visually prioritizes the property over menu-like labels. Destination names and descriptions do not permanently clutter the scene. Hover, keyboard focus, or selection identifies a building; selecting it opens contextual Building Details, and entering it is a deliberate second action.
- Nursery handles planting seeds, growth, collecting mature plants, capacity and upgrades; trays, benches, and pots can come later.
- Garden replaces the player-facing Collection name. It will display prized plants, expose the full collection, and open specimen details.
- Breeding starts at Garden > plant details > Breed > second parent > workflow. It is not a primary destination.
- Selling starts at plant details, through NPC sales or marketplace listings. Marketplace handles buying, player listings, and eventual trade history.
- Inventory belongs in the HUD, showing total seed count. The current inventory route is acceptable until a compact panel is useful.
- Physical world destinations are Nursery, Garden, Shop, Marketplace, and Genetics Lab. The Lab is a player-owned physical facility, not a utility page; its Research Center, Microscope Station, Extraction Station, Advanced Genetics area, and upgrades exist inside it.
- Utility and reference destinations are Skills, Field Journal, Research Log, Achievements, Grow Log, Settings, Help, and CactiSwap. Research Log remains the player's persistent notebook and reference interface, while the Research Center inside the Lab provides its research summary and access point. Never put physical world destinations in the utility menu.
- Interior screens provide a small Back to Farm link. Maintain real routes and working browser history/deep links.
- Canonical routes: `/` (Farm), `/nursery`, `/garden`, `/market`, `/shop`, `/inventory`. `/farm`, `/collection`, and `/marketplace` redirect to canonical destinations. The existing `/breeding` workflow placeholder remains unpromoted.

## Visual direction

Preserve the warm cactus/desert identity: near-black/dark brown surfaces, burnt orange/copper accents, muted tan secondary text, rounded cards, and serif major headings. Avoid giant empty spaces, oversized navigation, clutter, and stretched mobile/dashboard layouts. Use desktop/tablet width intelligently and remain responsive down to 320px.

Use one compact supplied CactiGrow logo, without separate emoji branding or a tagline. **Explicit user-approved exception:** the full supplied logo may retain its embedded "by CactiSwap" credit in the HUD. Do not add another permanent CactiSwap control to the HUD.

The compact HUD retains mock tokens, Inventory/Seeds, level, username, and XP. Aim for approximately 56px desktop height and allow narrow-screen wrapping. Keep the utility panel about 160px wide with short desktop rows, modest padding, and accessible touch targets.

World buildings may eventually grant passive bonuses and visually evolve as they upgrade. Building bonus definitions must remain centralized and data-driven, while each feature's domain model remains authoritative for its rules. Only implemented bonuses may affect gameplay or appear as active. Future directions include Nursery capacity and cultivation efficiency, Garden capacity and support, Lab research/sample/extraction improvements, Shop stock and purchasing services, and Marketplace listing or fee services; these are not current gameplay effects.

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
8. Final world artwork and interactions; Phaser only if justified. The Genetics Lab building should eventually evolve visually with its facility tier from Research Site through Research Bench, Microscope Station, Genetics Lab, Advanced Genetics Lab, and Research Facility. The planned production direction is stylized, hand-painted 3D; current illustrated world assets remain temporary.
9. Deployment, PWA, optional mobile packaging and desktop/Steam support.

Likely later technologies are Cloudflare Workers, PostgreSQL, Cloudflare R2, Tauri, and Capacitor or similar. These are directions, not instructions to install, connect, or deploy anything now.

Future Genetics systems should keep inherited natural genetics separate from interventions. A future `GeneticExtract` may reference a source specimen, stat, trait, or mutation and carry quality and limited-use data. Seed treatments may influence ranges or probabilities, including rare mutation probability, without rewriting either parent’s historical genetics.

Genetic identity has three distinct layers: `speciesId` identifies botanical species, `cloneLineId` identifies a genetic individual or clone line, and the plant ID identifies one physical specimen. Sexual reproduction always creates a new clone line. Future vegetative propagation creates a new physical specimen while preserving its source clone line.

Traits and mutations use one data-driven genetic-feature system and may stack unless explicit compatibility rules prevent a combination. Melted is a distinct mutation rather than an alias for monstrose. Genetic presence and genotype remain separate from visible expression and expression strength. Shiny is a separate special variant, independent from ordinary mutation tendency, inheritance, and future DNA systems.

Sexual offspring genetic outcomes resolve once when the unique bred seed is created and never reroll during planting, collection, viewing, refresh, or other lifecycle transitions. Inheritance dispatches from centralized feature definitions; provisional CactiGrow inheritance rules are game models, not claims of established botanical genetics. Each spontaneous-capable feature owns its provisional base rate. Mutation Tendency is a bounded modifier with diminishing returns, not a literal percentage, and cannot make rare mutations common. Different mutations may stack unless definition metadata declares a conflict, and Melted remains distinct from Monstrose.

Shiny is rolled independently at exactly 1/4096 for each new sexual genetic individual. It is sexually non-heritable, ignores both parents' Shiny state and Mutation Tendency, and remains stored with the clone line throughout its lifecycle. Future vegetative clones preserve their source genetic identity and special variant rather than rerolling. Field Journal Shiny history is idempotent by clone-line ID. Normal stackable seeds do not receive planting-time Shiny rolls; their future unique genetic identity must be generated authoritatively. Random genetic resolution is currently injectable client-side prototype logic and is intended to move to server authority.

Clone-line counts distinguish total vegetative propagations from active known specimens. Current counts are local prototype observations only; ecosystem rarity and ownership counts will eventually require server authority. Similar independently generated plants do not share a clone line merely because their appearance or quantitative genetics match.

The future Field Journal records permanent species discovery, rarity, discovery source, and meaningful botanical discovery counts. Individual crosses, hybrids, generations, and pedigrees belong in specimen lineage and breeding history rather than creating Field Journal species entries. Future expeditions may discover wild populations and limited founder seeds that return to the Nursery; the Shop should not automatically expose every future species.

Genetics research is permanent player knowledge keyed by clone-line ID. Specimen genetic truth remains separate from research records, and player-facing research UI consumes a centralized knowledge projection rather than raw hidden genetics. Research depth describes study of one clone line; Genetics level describes the player's capabilities. Hidden carrier information has a hard Level 30 boundary and also requires the appropriate clone-line research milestone. Repeated physical specimens from one clone line share knowledge and cannot provide duplicate research XP, while selling a specimen does not erase its historical record. Genetics XP rewards meaningful first research milestones and discoveries only.

Early Genetics progression rewards distinct clone-line observations and idempotent first discoveries of species, genera, visible feature types, Shiny plants, hybrids, and visible multi-feature specimens. Specimen comparison remains useful at Level 5, but only the first valid comparison and first cross-species comparison award XP globally; arbitrary clone pairs are not a repeatable XP source. The intentionally small prototype catalog does not guarantee enough fixed discovery XP to reach Level 10. Future species, mutations, expeditions, wild populations, research contracts, and laboratory discoveries expand the same stable milestone system without changing the OSRS curve or adding grind rewards.

Future research commands may require a lab tier, equipment, consumables, and server authority in addition to Genetics level and research state. Tissue sampling, extraction, genetic intervention, and actual clone verification remain later systems; current specimen comparison must not be presented as DNA verification.

Genetics lab progression is separate from Genetics skill level. Tissue sampling unlocks at Genetics Level 40 and requires a Microscope Station (lab tier 2) or higher. Sampling never consumes a plant, creates a clone, or changes donor genetics, clone identity, features, or Shiny state. Tissue samples live outside seed inventory and permanently preserve donor specimen, clone-line, species, collector, and collection-time provenance. Sample preparation quality is a once-resolved gameplay rating rather than genetic potency.

The provisional 24-hour sampling cooldown is keyed by physical specimen, while research knowledge and first-sampled-clone XP remain keyed by clone line. Repeat samples provide no recurring Genetics XP. Extraction remains deferred, and future economy-sensitive sampling, lab, and extraction outcomes should become server-authoritative.

Tissue samples contain limited extraction material assigned once from their stored quality band: Poor 1 use, Standard 2, Good 3, and Excellent 3. Every valid extraction attempt consumes one use, including failure; invalid attempts consume nothing. Depleted samples remain as provenance history, and extraction never changes the donor's 24-hour physical-specimen sampling cooldown.

Quantitative extraction requires Genetics Level 50 and a Tier 3 Genetics Lab. Its only current targets are Vigor, Growth Speed, Size, Flowering, and Mutation Tendency. Sample quality, extraction quality, and potency are separate stored gameplay values. Extracts preserve sample, donor specimen, clone-line, and species provenance, never carry Shiny, and cannot yet be applied to seeds. Feature or mutation extraction remains a future Level 60 system. Sample creation, uses, extraction outcomes, potency, consumption, and interventions must eventually become server-authoritative.

## Working conventions

Inspect existing code before editing. Prefer small typed components, readable names, shared configuration, and separation of gameplay logic, rendering, and external integrations. Make incremental visible changes; avoid unrelated rewrites, premature abstractions, duplicated constants, and unnecessary dependencies. Preserve uncommitted user work. Remove `.gitkeep` when a directory gains actual files.

After meaningful edits, run `npm run build` and `npm run lint`, fix introduced errors, and report changed files and validation results. Check relevant responsive navigation and accessibility in the browser. Do not commit automatically.
