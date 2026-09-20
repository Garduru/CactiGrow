# Plant Rendering System V1 — repository audit and implementation proposal

Status: **FIRST PRODUCTION SPECIES PIPELINE PROVEN; VARIEGATION RUNTIME COMPOSITION V1 HUMAN VISUALLY APPROVED / LOCKED IMPLEMENTATION BASELINE.** Locked production-building contracts remain unchanged. Four Normal San Pedro production stages, the five-state Nursery lifecycle, the temporary Nursery pot presentation, and the supported Variegation compositions are human approved in runtime. Code-drawn plants remain fallbacks for missing or unsupported artwork.

Human runtime testing approved explicit Garden display, the potless Garden presentation, the neutral React preview, the Normal San Pedro artwork and stage-relative scale, and Nursery's simple pot without visible soil or shadow. The proposed body-first handling of expressed mutations, compatible masks/spines, Shiny, partial visual support, and clone-line variation is specified in [`VISUAL_GENETICS_COMPOSITION_MATRIX_V1.md`](VISUAL_GENETICS_COMPOSITION_MATRIX_V1.md). That matrix is architecture guidance, **not implemented runtime behavior**.

## Current system: audit answers A–O

| Question | Repository finding |
| --- | --- |
| A. Canonical owned specimen | `Plant` in `src/types/plant.ts` is the common physical-plant shape. `CollectedPlant extends Plant` with `collectedAt` in `src/game/gameState.ts`; `GameState.ownedPlants` is the Garden collection. A growing plant is the same `Plant` type in a `NurserySlotState`. |
| B. Species | `src/data/species.ts` contains two stable IDs, San Pedro (`echinopsis-pachanoi`) and Peyote (`lophophora-williamsii`). Each `Species` has names, genus, rarity, growth/economy metadata, and `imageKey`. No per-species plant-art manifest exists yet. |
| C. Growth | `Plant.stage` uses `seed`, `seedling`, `juvenile`, `mature`, `flowering`. `calculateNurseryGrowth(plantedAt, now)` in `nurseryModel.ts` derives 0–1 progress over a mock two minutes, returns a stage and `isMature`; collection uses `isMature`, not the stored stage. Collection moves the same specimen ID into `ownedPlants` and sets stored stage to `mature`. |
| D. Mutations | `Plant.geneticFeatures` stores `GeneticFeatureState` entries with feature ID, genotype, expressed flag, expression strength, stability, and origin. Central definitions in `src/data/geneticFeatures.ts` distinguish traits and mutations, compatibility, and `artTags`. `getExpressedGeneticFeatures` already filters visible expression. |
| E. Morphology and pigmentation | Crested, monstrose, melted, spiral, and dichotomous definitions have distinct morphology families/art tags; variegation is a chlorophyll/pigmentation feature. There are no authored visual recipes or masks yet. The five quantitative genetics values are gameplay ratings, not appearance variants by themselves. |
| F. Spines | `dense-spination` is an expressed trait with `artTags: ['dense-spines']` and strength. Species anatomy in the Art Bible also specifies naturally sparse San Pedro spines and near-spineless Peyote. There is no separate spine-count genotype or visual layer in code. |
| G. Shiny | `Plant.specialVariants` holds separate `SpecialVariantState` entries. `resolveShiny` rolls exactly `1 / 4096` for new sexual individuals in `geneticFeatureResolver.ts`; it is not inherited through `geneticFeatures`. The renderer must consume stored state and never roll. |
| H. Stable visual seed | **None is stored.** Physical specimen `id` and genetic `cloneLineId` are stable identities. Bred seed identity and clone line persist when planted; generic stack seeds receive new IDs at planting. No variation seed, pot assignment, palette, or orientation is persisted. |
| I. Clone versus sexual origin | `cloneLineId` identifies genetic individuality; physical `id` identifies the specimen. `CloneLineRegistry` records origin type and counts. Breeding creates a unique `BredSeed` and new clone line, preserves parent IDs/species IDs, and does not consume parents. Vegetative propagation is future work; current generic planted seeds get fresh clone-line IDs with `unknown` origin. |
| J. Reusable sources | Reuse `Plant`, `CollectedPlant`, `BredSeed`, `Species.imageKey`, `getSpeciesById`, feature definitions/art tags, `getExpressedGeneticFeatures`, `calculateNurseryGrowth`, `GARDEN_DISPLAY_ANCHORS`, the narrow `WorldBridge`, and existing world depth/asset-manifest conventions. Reuse growth and eligibility outputs rather than recalculating them in Phaser. |
| K. Existing visual interpretation | `nurseryPresentation.ts` hardcodes `imageKey` → columnar/button/generic and progress → early/mid/late/mature. `NurserySlot.tsx` independently checks Shiny; `PlantDetails.tsx`, Garden filters, and research code each interpret expressed features or Shiny for their respective UI. This is not yet one shared **appearance** projection. Preserve research disclosure logic; it serves a different purpose. |
| L. Existing art/placeholders | No `public/assets/plants` files exist. Nursery uses CSS body/pot/shadow shapes and species-specific CSS, Garden uses text-only specimen cards, Plant Details uses text/badges, breeding uses text/genetic values, and inventory/Marketplace use text. The locked Farm Garden exterior contains six empty display beds; Phaser currently renders no owned specimens on them. |
| M. Garden changes needed | Garden display uses only explicit player assignment of owned specimen IDs to six stable named slots. Empty slots are valid. Application state owns assignments and Phaser receives resolved projections only. Ownership remains unlimited. |
| N. Nursery context | `NurserySlot.tsx` now uses the shared plant-only descriptor and React visual while its presentation owns the pot and bench context. The future walkable interior still needs authored anchors for real six/eight grow slots. |
| O. Documentation/code gaps | The Art Bible's four **visual** stages include `developing`, which is absent from `GrowthStage`; `seed` and `flowering` exist in gameplay but not the four-stage art list. Mock growth reports stage `mature` from about 75% progress while `isMature` and collection become true only at 100%. The Art Bible describes a stable variation seed and aspirational Garden/Nursery world projections; neither is implemented. `getNurseryVisualPhase` currently supplies four CSS phases, but not the named production stages. The Garden display-selection policy is explicitly undecided in `docs/GARDEN_V1_ASSET_CONTRACT.md`. |

These differences are audit findings, **not** proposed changes to breeding, Shiny odds, growth eligibility, genetics, collection capacity, or locked world geometry.

## Implemented boundary and types

Build one pure, deterministic **appearance selector** outside React and Phaser. It accepts a `Plant` plus species/content definitions and an explicit growth visual stage or authoritative growth result. It returns a serializable `PlantVisualDescriptor`, never a Phaser object, DOM element, callback, hidden genotype, or whole `GameState`. React and Phaser consume the same descriptor and asset manifest; only their final drawing methods differ.

Suggested narrow contracts (names are provisional):

```ts
type VisualGrowthStage = 'seedling' | 'juvenile' | 'developing' | 'mature'
type PlantVisualDescriptor = {
  specimenId: string
  speciesVisualKey: string
  visualStage: VisualGrowthStage
  baseRecipeKey: string
  variation: { paletteIndex: number; formIndex: number; orientationIndex: number; scaleBucket: number }
  morphologyRecipeKeys: readonly string[]
  pigmentationRecipeKeys: readonly string[]
  spineRecipeKey?: string
  specialTreatmentKey?: string
  visualRevision: string
}
type GardenDisplayProjection = {
  displays: readonly { anchorId: string; specimenId: string; visual: PlantVisualDescriptor }[]
}
```

This is **plant-only appearance data**, not a new genetic schema. Pots, soil, benches, world shadows, and scene decoration belong to presentation contexts, not to the canonical plant descriptor. The selector reads only *expressed* features and their central `artTags`; non-expressed carriers, genotype, quantitative mutation tendency, research records, treatment provenance, parent IDs, and private ownership history do not enter a viewer-facing world projection. `visualRevision` changes only when inputs relevant to appearance change; current state can derive it rather than persist it. `Species.imageKey` is the bridge to species art config. A missing species or recipe yields a labeled generic fallback without inventing biological facts.

### Deterministic variation

For V1, derive a versioned 32-bit noncryptographic hash from `cloneLineId` for stable *genetic appearance choices* and another from physical `id` for small presentation differences such as slight plant orientation. Use fixed salts for independent palette/form/orientation channels, then clamp indices to species-approved ranges. Never use `Math.random()` in render, React render, scene creation, or the visual selector. Clones would share the genetic pattern while distinct physical specimens may have bounded plant-pose differences; independently generated specimens need not look identical merely because numeric genetics match. A bred seed's IDs already persist into its Nursery plant, so its choices can be previewed without rerolling. Generic seed stacks have no individual identity until planted and should use a species-level seed thumbnail, not a fictitious specimen variation.

Hash algorithm/version and approved variation ranges should be fixed in the visual manifest and covered by deterministic examples when implementation begins. If future player-selected cosmetics or non-derivable appearance become gameplay/persistence requirements, add explicit authoritative metadata with migration then; do not add a redundant mutable seed now. Do not derive genetic appearance from transient array order, timestamps, camera, location, or owner name.

### Four visual stages and current growth

For the existing accelerated prototype, use the authoritative `calculateNurseryGrowth` result. The human-approved Nursery presentation is: progress `[0, .15)` → **Germinating** (occupied pot only, no visible cactus or seed); `[.15, .40)` → **Seedling**; `[.40, .65)` → **Juvenile**; `[.65, 1)` while `isMature === false` → **Developing**; `isMature === true` → **Ready to Collect** with mature artwork. Germinating is Nursery presentation, not a fifth canonical plant artwork stage. Canonical visual artwork stages remain seedling, juvenile, developing, and mature. A gameplay stage of `mature` before `isMature` must **not** force mature art or Collect eligibility. Collected plants use mature art; a future `flowering` gameplay stage still uses mature form unless a separate, approved flowering overlay/state is authored. Long-term server progress or a server-authoritative visual-stage input can replace mock timing without changing rendering APIs. The visual mapping must never decide maturity, growth duration, XP, collection, or breeding eligibility.

### Mutation composition

Resolve a bounded plant-only layer/recipe sequence from the **existing expressed feature states**: species/stage base → selected morphology recipe(s) → pigmentation/mask → species-appropriate spines or expressed dense-spination variant → stored Shiny treatment. Normal uses the base recipe. Crested, Monstrose, and Melted require recognizably distinct authored morphology; Variegated modifies pigmentation; Dense Spination modifies a spine layer; Shiny modifies the final treatment without replacing morphology or pigmentation. Spiral and Dichotomous have their own recipe keys when produced. Expression strength may choose approved discrete visual variants, never a new genetics outcome. Central feature definitions/compatibility remain authoritative; a visual manifest maps their `artTags` to modules and declares supported combined-morphology recipes or a documented visual fallback. Missing composite art must preserve the underlying gameplay feature truth in React text/badges, never erase or relabel it.

For same-genus cross-species offspring, the current gameplay model uses Parent 1's `speciesId` as the temporary display species and retains both parent species IDs. V1 should use that existing species base and a separate hybrid label where appropriate; do not invent a hybrid silhouette or new species ID. Quantitative `size` may eventually influence a bounded visual scale only after art review. `flowering` and `mutationChance` ratings must not automatically paint flowers or mutations.

## Asset and renderer plan

Keep approved runtime assets under `public/assets`, consistent with current world art. Use a typed, data-driven plant visual manifest keyed by `Species.imageKey` and visual stage, with explicit module/recipe references. Asset keys map to paths; gameplay and scene code never synthesize filenames from IDs. A future content pipeline can validate that every species key has required stages and fallbacks and generate a manifest from structured content without hand-editing renderer switches.

Suggested future production asset structure:

```text
public/assets/plants/species/echinopsis-pachanoi/{seedling,juvenile,developing,mature}/...
public/assets/plants/species/lophophora-williamsii/{seedling,juvenile,developing,mature}/...
public/assets/plants/morphology/...
public/assets/plants/pigmentation/...
public/assets/plants/spines/...
public/assets/plants/shiny/...
```

Use the Art Bible's lowercase semantic filenames with version suffixes (for example `plant-echinopsis-pachanoi-mature-base-v01.webp`). Keep layered masters outside the runtime bundle. Record transparent registration and bounding boxes per recipe so stages swap without jumping at an anchor. For V1, explicit file registrations are clearer than dynamic filesystem discovery; later tooling may generate the manifest and atlases from content metadata. Reuse loaded textures across specimens, preload only the active scene's required keys, and provide an obvious fallback if a file or recipe is missing.

Phaser owns Garden world sprite/container creation at the six fixed display anchors, bounded layer order, depth, culling, and optional low-cost animation. It consumes `GardenDisplayProjection` through the existing `WorldBridge` and reconciles by anchor ID/specimen ID/visual revision; it does not read `GameState` or resolve genetics. Plants are rooted visually in the locked Garden beds and may overlay the exterior **without changing its art, registration, or collider**. Match the scene's established local-player depth rule. React owns a `PlantVisual` view of the same descriptor for cards/details and later previews, with accessible labels supplied by the surrounding UI. React can use positioned `<img>` layers or a compact composite asset; it must not duplicate feature interpretation. Avoid drawing a new random variant during rerenders.

Garden display is **explicit user selection only**. Stable named slots `garden-display-back-left`, `garden-display-back-center`, `garden-display-back-right`, `garden-display-front-left`, `garden-display-front-center`, and `garden-display-front-right` map to the locked anchors. Each holds one owned specimen ID or is empty; one specimen cannot occupy two slots. Collection never auto-assigns. Clearing a slot changes only display state, never ownership. Application/domain state owns assignments for future server persistence. Phaser consumes only resolved display projections. The selector returns at most six, handles zero cleanly, and never caps `ownedPlants`. Do not select from filtered React results. Future visitor projections should expose only appearance and permitted labels, not private genetics/research/provenance.

Nursery is the second world consumer: the future interior should map real `nurserySlots` to authored bench/pot anchors and project the same descriptor at the derived visual stage. The current React Nursery uses the same descriptor with a Nursery-owned pot; the walkable interior remains future work. Nursery Level 1/2 capacities remain six/eight and originate from property state, not from art-anchor count.

## Performance, fallback, and useful diagnostics

- Begin with one species and a small, bounded number of layers per plant. Profile six Garden specimens on a representative phone before adding atlases, texture baking, pooling, or shaders. Reuse base/module textures; do not allocate one giant unique texture per specimen.
- Cache descriptors by the relevant stable IDs, visual stage, expressed feature signature, and manifest version. Reconcile only changed displays; a Nursery one-second clock should not trigger asset reloads or unrelated Garden updates. Let Phaser cull out-of-view plant visuals with its scene/camera strategy; use lower-detail world art and higher-detail focused views only when tested.
- Missing base assets show a simple plant-only silhouette fallback in React and a restrained plant-only world placeholder in Phaser. Missing optional modules fall back to the nearest approved base/composite while preserving visible feature labels in UI. Log missing keys once in development; production must not crash a scene or silently imply an unexpressed mutation.
- A development inspector could show specimen ID, visual stage, recipe keys, stable hash channels, anchor, and missing assets under `?worldDebug`. It must not expose hidden genotype/research in a public view. A deterministic snapshot/gallery for one species across four stages and representative valid feature combinations will catch registration and fallback errors without a general-purpose art editor.

## V1 implementation and limits

- `GameState.gardenDisplayAssignments` holds six stable slot IDs with owned specimen IDs or `null`. It initializes empty, changes only through explicit Garden actions, rejects duplicate specimen assignments, and clears an assignment if the specimen is sold to an NPC. It is separate from Garden organization metadata and ready to persist as domain state when a server exists.
- `GardenPage` shows the six display positions and opens Plant Details for an owned specimen. Plant Details permits choosing an empty bed or clearing that specimen's assignment. Clearing never changes ownership. New collections do not assign themselves.
- `createGardenWorldProjection` resolves assignments against current ownership and supplies only specimen ID, anchor coordinates, and a plant-only visual descriptor. `FarmTestScene` reconciles at most six visuals while leaving the approved Garden exterior, anchors, and collider untouched. Empty assignments create no world visuals.
- `createPlantVisualDescriptor` deterministically derives species key, four-stage visual state, stable bounded variation, expressed feature recipe keys, and stored Shiny treatment. It neither rolls genetics nor decides gameplay growth or maturity. React Garden previews and Nursery slots use the same descriptor; Nursery alone supplies its pot, while Garden world visuals have no pot.
- Normal San Pedro has four registered production stage assets and a shared resolved descriptor consumed by React and Phaser. An unsupported optional feature retains the approved species/stage base body and reports partial support plus missing layers; it does not paint the unsupported feature. Missing species/stage art uses the code-drawn plant-only fallback, which is **not production art**. Existing detail text remains the source for feature identity; Garden assignment remains domain state.

### Variegation runtime composition V1

**Human approval:** browser testing approved the mask registration and `yellow-green-v02` treatment for Seedling, Juvenile, Developing, and Mature Pattern A plus Mature Patterns B and C. These combinations are **FULL / HUMAN APPROVED**. Pattern A is the first complete San Pedro pigmentation-pattern lifecycle at 4 of 4 visual growth stages. Seedling B/C, Juvenile B/C, and Developing B/C remain **PARTIAL** because their pigmentation masks do not exist; they retain the compatible approved Normal stage body and report the missing layer.

The shared descriptor resolves a typed Normal-body pigmentation-mask registration by species visual key, stage, feature, pattern family, body family, and version. Seedling Pattern A, Juvenile Pattern A, Developing Pattern A, and Mature Patterns A/B/C use registered 512 x 768 lossless WebP masks. React and Phaser consume the same descriptor and deterministic `yellow-green-v02` pixel compositor: mask alpha blends each underlying body pixel toward muted yellow-green RGB `(201, 211, 111)` using the approved-reference-calibrated luminance scale `0.25 + 1.25 × normalized source luminance`, while retaining body alpha. This preserves texture, ribs, shading, scars, spines, silhouette, and registration while remaining visible at gameplay scale; it adds no glow, shadow, or background.

The first browser review exposed a resolved-but-visually-Normal failure. Developing A had been mistakenly normalized twice during its production-mask export, shifting most coverage down the body, and the V01 treatment scaled the target directly to the darker green luminance, producing too little yellow-green separation. Developing A now uses its already-normalized locked canvas's direct 50% export; Mature continues to use its stage normalization. The V02 cache version prevents stale V01 compositions from winning after the correction.

The approved baseline comprises the body-plus-pigmentation-mask composition architecture, shared deterministic Canvas compositor, React and Phaser composition paths, recipe-based caching, graceful PARTIAL fallback to the compatible Normal species/stage body, `yellow-green-v02`, the current production masks, and current support-state behavior. Future intentional revisions may evolve it, but incidental work must not regress this reviewed behavior.

Composition is cached by body texture key, mask texture key, and treatment version. React caches one asynchronous data-URL promise per recipe. Phaser preloads registered masks and creates one canvas texture per recipe, never per frame. Missing masks leave the approved Normal body visible and contribute a precise missing-layer diagnostic. A resolved mask removes only that pigmentation diagnostic; unsupported morphology, spines, or Shiny continue to keep overall support partial. Gameplay plants currently have no persisted A/B/C field, so normal gameplay does not invent one; the development test tool supplies its explicit pattern as resolver input.
- Assignments remain in-memory like the rest of the current local prototype and **do not survive a full page reload**. Backend persistence is later Alpha work and must validate ownership, slot identity, and one-slot-per-specimen on the server. The future Nursery world interior is not implemented here.

## Decisions and remaining art input

1. **Resolved:** only explicit player assignments appear outdoors; all six slots may remain empty. Assignment is application/domain state separate from ownership and Level 2 organization metadata.
2. **Resolved:** canonical plant appearance has no pot or soil. Garden presentation roots plants directly in beds; the approved temporary Nursery presentation uses a front-facing pot with no visible soil or shadow and slight cactus-base overlap; React previews use a neutral context.
3. **Resolved:** all four Normal San Pedro stages, their scale and registration, and the Nursery five-state/pot presentation passed human runtime review. Mutation art remains future work.
4. **Resolved for V1:** the neutral preview appears in Garden cards and Plant Details; Nursery uses the same plant descriptor with its own pot context.

Implementation does not require changing current breeding, growth, Shiny probability, property capacity, or Farm/Town building contracts in V1.
