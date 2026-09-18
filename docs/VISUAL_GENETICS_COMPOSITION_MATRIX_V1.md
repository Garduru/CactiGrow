# CactiGrow Visual Genetics Composition Matrix V1

Status: **ARCHITECTURE / ART-SYSTEM DESIGN ONLY.** This document does not implement a resolver, integrate the reported San Pedro masters, change genetics, or approve mutation art. The existing Plant Rendering System V1 remains the functional fallback. The [Art/World Bible](CACTIGROW_ART_WORLD_BIBLE.md), [San Pedro V1 asset contract](SAN_PEDRO_V1_ASSET_CONTRACT.md), and actual gameplay definitions govern species identity, style, baseline, and genetic truth. The newer plant-only boundary governs where older Art Bible text treats pots as part of a specimen composition.

## Goal and repository boundary

Represent a coherent cactus **body first**, then add only compatible surface and finishing treatments. Author changes to silhouette and areole geometry; reuse registered masks and modules where they genuinely fit; use small deterministic parameters only where painted form survives. Never make one complete image for every cross-product of species, four stages, rib counts, colors, spines, variegation, morphologies, Shiny, and combinations. Nor should independent layers be stacked merely because they exist.

`Plant` stores `speciesId`, physical `id`, `cloneLineId`, five quantitative ratings, `geneticFeatures`, and separate `specialVariants`. A `GeneticFeatureState` stores feature ID, genotype, `expressed`, expression strength, stability, and origin. `getExpressedGeneticFeatures` filters `expressed && expressionStrength > 0`. The sexual resolver uses definitions from `src/data/geneticFeatures.ts`, with recessive allele handling for Variegation and configured presence/inheritance chances for other features. All seven definitions are marked `inheritable`; six mutations allow spontaneous occurrence, while Dense Spination does not. Their definitions currently contain **no populated incompatibility, requirement, or suppression lists**. Thus multiple expressed features can coexist in valid gameplay state, but that is **not** permission to composite their art arbitrarily. No visual recipe may reject, erase, or change gameplay truth.

Shiny lives in `specialVariants`, not `geneticFeatures`: `resolveShiny` rolls `1 / 4096` for a new sexual genetic individual, independently of inherited feature states. Bred seed identity and its feature/variant state persist when planted. Shiny does not inherit sexually; future vegetative copies of a clone line should preserve its stored genetic identity and special-variant truth under their eventual authoritative rules, without rerolling in the renderer. No rendering code rolls odds.

The current shared `createPlantVisualDescriptor` maps expressed `artTags` to arrays of morphology and pigmentation recipe keys, an optional dense-spine key, and an optional Shiny key. It hashes `cloneLineId` for `paletteIndex`, reserved `formIndex`, and `scaleBucket`, and physical specimen `id` for `orientationIndex`. These are **unresolved hints**, not a complete compatibility recipe. `plantVisualAssets` has species silhouettes and empty stage paths; React draws an SVG and Phaser draws geometry. Both currently approximate Variegation with one color and Shiny with one color/outline; they do not depict structural mutations. The Garden projection sends only explicitly assigned owned specimens to its six locked anchors; Nursery owns its pot and stage context; Plant Details uses a neutral preview. A future shared resolver must replace the interpretation, with both consumers rendering the same resolved recipe rather than duplicating feature selection.

## Complete current feature matrix

The table exhausts the seven entries in `geneticFeatureDefinitions` and the one current `SpecialVariantId`. “Combination” means the current definitions impose no pair exclusions; visual support still needs explicit recipes. A feature's `expressionStrength` is gameplay truth, not an instruction to deform pixels continuously.

| Canonical ID / display name | Gameplay classification, family, storage/expression, inheritance | Art tag; primary visual category | Combination and identity rule |
| --- | --- | --- | --- |
| `variegation` / Variegation | Mutation, `chlorophyll`; `GeneticFeatureState`. Recessive two-feature-allele genotype can express after its configured variable-expression roll; strength 35–100. Heritable and spontaneous. | `variegated`; **authored body-compatible pigmentation mask** plus bounded approved pigment palette. | Can coexpress with all currently defined features. Mask selection belongs to clone-line identity; use masks registered to the selected stage/body. A carrier without expression is never painted variegated. |
| `crested` / Crested / Cristate | Mutation, `crest-fasciation`; stored feature state, developmental expression, strength 45–100; heritable probabilistically and spontaneous. | `crested`; **authored body/morphology**, optionally a registered apex module only if its seam and perspective pass review. | May coexpress with other structural mutations today. Needs a curated combined-body or explicit visual-dominance fallback, never an unregistered crest overlay. Clone line keeps form tendency; physical specimen can have tiny pose changes. |
| `monstrose` / Monstrose | Mutation, `monstrose`; developmental expression, strength 40–100; heritable under configured presence chances and spontaneous. | `monstrose`; **authored body/morphology** with irregular mass/ribs and associated areole map. | Same unconstrained gameplay combination space. Not a noise warp or recolor of Normal; mask/spine modules need Monstrose registration. |
| `melted` / Melted | Mutation, `melted`; variable expression, strength 30–100; heritable under configured presence chances and spontaneous. | `melted`; **authored body/morphology** for softened, flowing structure. | Must remain distinct from Monstrose. Concurrent morphologies require an approved combined recipe or documented partial/fallback presentation. |
| `spiral-helical` / Spiral / Helical | Mutation, `spiral-helical`; variable expression, strength 35–95; heritable probabilistically and spontaneous. | `spiral`; **authored body/morphology** or authored rib-structure variant tied to a compatible body. | A tiny orientation rotation is not a helical rib structure. Other body-changing features require specific compatibility. |
| `dichotomous` / Dichotomous | Mutation, `dichotomous`; developmental expression, strength 50–100; heritable under configured presence chances and spontaneous. | `dichotomous`; **authored split-apex/branched body** or a precisely registered structural module. | The two growth centers change silhouette and areole placement; arbitrary mirroring is not sufficient. |
| `dense-spination` / Dense Spination | Trait, `spination`; variable expression, strength 30–90; heritable through configured polygenic presence chances, **not spontaneous** under current definition. | `dense-spines`; **body-compatible modular spine plate/overlay**, or authored dense-spine variant if registration is impossible. | Can coexpress with any current feature. Clone-line choice and expression-strength band select an approved density; attachment must follow that body's actual areoles. No random scattered needles. |
| `shiny` / Shiny | `SpecialVariantState`, not a trait/mutation feature; stored `variantId`, origin and timestamp. Independent `1 / 4096` new-sexual-individual roll, sexually nonheritable. | No `artTag`; **final render effect** on the resolved plant composition. | Coexists with morphology, Variegation, and spines without replacing them. The stored variant is shared across previews/world contexts; renderer never rerolls it. |

The model also stores `vigor`, `growthSpeed`, `size`, `flowering`, and `mutationChance` as 0–100 quantitative gameplay ratings. **None currently has a direct phenotype rendering rule.** `size` may eventually select a tightly bounded size band after art review; it must not double-apply the existing hash-based scale or distort the baseline. Vigor and Growth Speed do not automatically add growth effects, Flowering does not automatically paint flowers, and Mutation Chance is a probability/rating input rather than a visible mutation. Exact values remain available in Plant Details regardless of art support. Hybrid parent species and lineage are metadata; same-genus crosses currently use Parent 1's species ID as the temporary visual base rather than inventing a hybrid silhouette.

**No canonical rib-count, rib-shift, body-proportion, color, pigmentation-quantity, spine-length, or spine-color genetic fields/feature definitions exist today.** `GeneticFeatureFamily` lists broad future categories such as `rib-structure` and `epidermis-color`, but a union member is not a gameplay trait. The species Art Bible describes normal anatomy; `paletteIndex` and `formIndex` are deterministic visual choices, not inherited numeric rib/color genetics. Do not label a fallback band as an exact genotype or add one during this design pass.

## Authoritative body-first composition order

1. Resolve known species `imageKey`, visual stage, expressed feature IDs, stored Shiny, and stable IDs from domain data. Do not use camera, route, collection order, or a fresh random roll.
2. Select one **approved coherent body recipe** for species + stage + expressed structural-feature set. Choose a Normal base, one authored morphology, or an explicitly approved combined morphology. The body recipe declares silhouette, bottom-center baseline, material regions, valid areole/attachment landmarks, and allowed masks/modules. It does not decide whether a feature is expressed.
3. Apply bounded clone-line body-form/scale choices allowed by that recipe. Keep the San Pedro baseline and four-stage registration fixed. Never stretch a Normal PNG into a crest, split apex, or spiral.
4. Select one species/body-compatible base palette or a calibrated bounded color grade. Apply approved pigmentation masks to the body's plant-surface region, preserving lighting and alpha. Masks are not generic screen-space stains.
5. Apply body/stage-compatible sparse or dense spine treatment at authored areole landmarks. Add any independently approved surface modules in a recipe-defined order; reject modules that cannot register to this body.
6. Apply the stored Shiny final material/highlight treatment, if present, without washing out Variegation, ribs, or spines. Do not add context shadows or pots inside the plant recipe.
7. Presentation context places the resolved plant at its baseline: Garden soil, Nursery-owned soil/pot/bench, neutral React preview, or future Marketplace/Lab. Context may occlude the lower stem or provide grounding, but cannot change the phenotype decision.

The resolver emits one serializable **resolved visual recipe** plus support diagnostics. React and Phaser use the same body key, palette, mask, spine, Shiny treatment, registration, and support state. An individual renderer may choose resolution/LOD or an approved low-detail representation, but never independently choose “which mutation wins.” All assets and attachment coordinates are authored per compatible body/stage family and use the San Pedro contract's transparent bottom-center convention.

## Rib structure and color boundaries

**Rib count:** there is no exact count to display at present. Normal San Pedro art must show botanically recognizable longitudinal ribs, and optional curated Normal body forms may suggest broad/typical/narrow rib reads as purely aesthetic clone-line variation. If a real rib-count genotype is added later, gameplay owns the exact integer while a species/morphology profile maps approved ranges to visual bands and compatible authored bodies. Band thresholds and whether the value has phenotype expression would require a separate gameplay/art decision. A 5-rib record must not be falsely presented as a literal 5-rib render if only a broad visual band is supported; UI may show the exact value with visual-support context.

**Rib shifting:** no current state expresses it. If later introduced, use a restrained authored rib-flow/offset variant or body family with consistent shading and areole placement. A shader warp of a painted PNG would smear highlights, spines, and masks and should not be the default. Stage continuity and each structural morphology's supported rib-flow families must be authored; no arbitrary UV displacement or texture rotation can claim an exact biological rib shift.

**Color/pigmentation:** the current three `paletteIndex` values are hash-derived choices, not color genes. Define approved species-aware Normal palette swatches and optional material-region color grades tested against warm lighting and at mobile size. Apply one bounded palette selection, not cumulative hue shifts. Variegation has its own approved chlorophyll-loss palette and mask intensity bands; preserve cream/yellow regions, green tissue, light direction, and contrast. Shiny adjusts a final highlight response without recoloring away Variegation. If future color genetics become real, explicit domain ranges may map into approved bands while preserving exact values in UI; this document does not create those fields.

## Variegation, spines, and developmental morphology

**Variegation:** author a small set of deliberate mask families (for example sectoral, marbled, or rib-following only after art approval) for each supported *body family* and stage. A mask is registered in the plant's local coordinates, clipped to compatible epidermis regions, and selected from the clone-line hash. Use a small bounded strength/coverage band based on expressed state and approved art, not per-pixel random noise. The mask family stays recognizable as that clone develops through stages; do not reroll at each growth step. Normal can use a Normal-body mask; Crested needs fan-compatible masks, Monstrose needs masks on irregular lobes, and Melted/Spiral/Dichotomous need individually reviewed mappings or a documented **PARTIAL** visual until authored. Never project a rectangular Normal mask over a different silhouette.

**Spines:** current San Pedro Normal art direction is sparse, short spines. The four supplied Normal masters must be assessed later to learn whether those spines are already painted into the body; do not assume a separable sparse spine layer exists. Dense Spination selects an approved extra areole-aligned spine plate or alternate body/spine composite for each compatible body/stage and strength band. If the base has painted sparse spines, the overlay must supplement, not double every cluster. An areole/landmark map is the desired attachment contract for future modules. No independent long-spine or colored-spine genotype exists; those are future content decisions, not current `dense-spination` effects. At distant LOD, preserve a denser silhouette texture without drawing hundreds of single-pixel needles.

**Structural development:** `expressed` is stored for the specimen, but a stage recipe may express it subtly while young and more legibly as it grows. A stage must not imply a different genetic truth; Plant Details still lists all expressed features even if the earliest visible form is subtle. Proposed art-review needs:

| Morphology | Seedling / juvenile | Developing / mature | Preferred production approach |
| --- | --- | --- | --- |
| Crested | Subtle widened/flattened growth point, then a small coherent crest. | Clear fan-like crest with correct seam and ribs. | Author all four stage body forms or prove an early shared base plus registered apex modules; avoid sudden unrelated mature replacement. |
| Monstrose | Early rib irregularity becomes recognizable lobing. | Authored irregular body and areoles. | Likely four staged bodies; a later-stage-only effect would cause an abrupt transformation. |
| Melted | Early soft asymmetry develops into flowing fused structure. | Distinct softened body, not Monstrose recolor. | Likely four staged bodies or approved transitional modules. |
| Spiral / Helical | Gentle intentional twist emerges early. | Coherent helical ribs along the whole column. | Stage-specific authored body/rib family; rotation of the complete sprite is not a spiral. |
| Dichotomous | Apex may begin as a single growth point, then visibly divides at a reviewed stage. | Two believable growth centers with compatible ribs/spines. | Early shared body may be valid **only if** onset is approved; author split transition and later-stage bodies/modules. |

These are **art proposals**, not changes to growth timing, expression rolls, or feature eligibility. Which early manifestations are botanically convincing and when a split becomes visible require human approval. All stage families retain a consistent baseline and enough registration for masks/spines. If a combination cannot be supported at a given stage, use an explicit partial/fallback recipe rather than a physically incoherent composite.

## Compatibility recipes and visual support

Gameplay currently permits coexpressed structural features because no definition supplies pair exclusions. Key a visual recipe by species visual key + stage + **sorted expressed structural feature IDs**. A single morphology selects its authored body if available. Two or more structural features require a reviewed combined body/module recipe; a manifest may instead declare an approved **visual-dominance fallback** that shows one body while recording every unrepresented feature. There is no implicit global priority by definition order, alphabetical order, or rarest feature. Do not mark a missing combination impossible in genetics merely because art is missing. Pigmentation and spine modules each declare compatibility with the *selected* body family, not just the species.

| Example requested phenotype | Resolved body | Secondary support | If art is missing |
| --- | --- | --- | --- |
| Normal + Variegation + Dense Spination + Shiny | Normal stage body | Normal-compatible variegation mask, registered dense-spine plate, final Shiny. | Preserve Normal body and any approved secondary layer; report uncovered IDs in dev diagnostics. |
| Crested + Variegation | Crested stage body | Crested-specific mask and spine anchors; Shiny last if stored. | Never stretch a Normal mask onto fan; show Crested body alone and mark Variegation unsupported visually, or use an approved combined composite. |
| Monstrose + Melted | Explicit combined morphology **only if approved**. | Its own pigmentation/spine registration. | Curated visual-dominance or Normal fallback, with both feature IDs retained in state/UI and support level below FULL. |
| Spiral + Dichotomous + Dense Spination | Approved combined body or defined visual-dominance body. | Only compatible areole/spine module. | No independent twist/split/needle stacking; record missing visual roles. |

Define `FULL` when all expressed visual features and Shiny are represented by approved compatible art/effects; `PARTIAL` when a coherent body and some but not all expressed roles are shown; `FALLBACK` when only a species/stage base or temporary silhouette is available. Record supported and unsupported feature IDs, selected recipe key, reason codes, and asset failures in a development-only inspector/log. The player-facing world stays uncluttered; Plant Details can still truthfully list all expressed features. Never silently label a partial image “all traits rendered,” and never depict an unexpressed mutation. Missing texture or WebP decode failure moves to a safe lower support state and keeps the game usable.

## Deterministic individuality and Shiny

Keep the current versioned hash boundary: clone-line ID controls reproducible palette tendency, reserved body/form choice, optional approved mask family, and spine configuration/strength band; physical specimen ID controls only tiny pose/registration-safe differences. Current fallback rotations are -2/0/+2 degrees and scales 1/1.025/1.05; any production-art use must pass human review at Garden and Nursery baselines. The current `scaleBucket` is clone-line driven, not specimen driven; moving it would be a behavior decision outside this document. `formIndex` presently has no visible effect. Do not infer a clone-line's genetic feature from a hash; stored feature states remain authoritative. Clones should resemble their line without needing pixel-identical physical pose. Never use `Math.random()` on render, stage swap, scene mount, or React rerender.

Shiny is a restrained **final material/lighting treatment**: an approved species-aware pearlescent/warm highlight response, with a brief glint at reveal/selection or focused view if desired. It should read at world and React-preview size, degrade gracefully without shaders, and preserve the underlying body, variegation, and spines. Avoid continuous particles, neon glow, or an alternate complete PNG for every phenotype. Apply the same resolved Shiny treatment in Phaser, React, later Nursery, and Marketplace; presentation may adapt motion to reduced-motion settings. The stored `SpecialVariantState` is the sole trigger. Keep the exact `1 / 4096` sexual roll and noninheritance untouched.

## Asset-count example and typed configuration

For illustration only, suppose San Pedro eventually supports four stages, three rib-look bands, three palettes, two spine densities, four variegation masks, six body classes (Normal plus the five existing structural morphologies), and two Shiny states. A naive complete-image cross-product is **4 × 3 × 3 × 2 × 4 × 6 × 2 = 3456 full images**, before multi-morphology pairs. This is not a proposed set of gameplay rib/color genes; it shows why full-image enumeration fails.

The hybrid begins with the **four Normal stage assets** already specified by the San Pedro contract. A selective rollout could later add roughly 10–20 morphology stage bodies/modules (not every structural mutation needs four independent full bodies), 6–18 body/stage-compatible mask plates, 4–12 spine plates, and a few carefully chosen combined morphology recipes: roughly **24–54 authored pieces plus selected composites** rather than thousands of complete phenotypes. Counts are planning estimates, not caps or a claim that the current four masters support these combinations. Quality, body registration, and approved feature coverage determine the actual set.

Suggested typed, data-driven seams (proposed types, **not implemented**):

```ts
type VisualSupport = 'FULL' | 'PARTIAL' | 'FALLBACK'
type Stage = 'seedling' | 'juvenile' | 'developing' | 'mature'
type BodyKey = string

interface BodyAssetRecipe {
  key: BodyKey
  stages: Record<Stage, { textureKey: string; path: string; origin: [0.5, 1];
    canvas: [number, number]; surfaceMaskKey?: string; areoleMapKey?: string }>
  bodyFamily: string
  supportedMaskFamilies: readonly string[]
  supportedSpineFamilies: readonly string[]
}
interface SpeciesVisualProfile {
  speciesVisualKey: string // existing Species.imageKey, not a duplicate species ID
  normalBody: BodyKey
  bodies: Record<BodyKey, BodyAssetRecipe>
  palettes: readonly { key: string; approvedMaterialGrade: string }[]
  morphologyRecipes: readonly { expressedFeatureIds: readonly string[];
    bodyKey: BodyKey; stages: readonly Stage[]; priority: 'exact' | 'approved-dominance' }[]
  masks: readonly { key: string; family: string; compatibleBodyFamilies: readonly string[];
    stages: readonly Stage[] }[]
  spines: readonly { key: string; compatibleBodyFamilies: readonly string[];
    stages: readonly Stage[]; densityBand: string }[]
  shinyTreatmentKey?: string
}
interface ResolvedPlantVisualRecipe {
  specimenId: string
  speciesVisualKey: string
  stage: Stage
  bodyKey: BodyKey
  paletteKey: string
  maskKey?: string
  spineKey?: string
  shinyTreatmentKey?: string
  variation: { orientation: number; scale: number }
  support: VisualSupport
  representedFeatureIds: readonly string[]
  unrepresentedFeatureIds: readonly string[]
  visualRevision: string
}
```

Definitions (`geneticFeatureDefinitions`) remain gameplay truth. A species profile/manifest declares approved art, asset URLs, body-family compatibility, attachment metadata, stage onset, and fallback policy. A pure shared selector takes validated plant appearance inputs and that profile, matches an exact recipe or an explicit reviewed fallback, and emits a narrow serializable result. Do not send raw genotype, hidden research, owner/private lineage, or full `Plant` through the world bridge. A CI/content check should detect missing stage textures, inconsistent baselines, unknown feature IDs/tags, broken recipe references, unreachable combinations, and absent fallback coverage. Species additions then supply content data, approved body families/masks/modules/palettes, and recipes rather than new conditionals in each renderer.

## Responsibilities and implementation sequence

**Domain/application:** owns actual genetics, expression, Shiny, specimen/clone-line IDs, growth eligibility, and explicit Garden display assignments. **Shared selector:** resolves one body-first phenotype, deterministic variation, compatible layers, support state, and visual revision. **Phaser:** preloads approved textures, draws the resolved layers at the world anchor and existing depth, reconciles by slot/specimen/revision, handles LOD/culling and asset failure; it never resolves genetic precedence. **React:** uses the same recipe for neutral previews and Nursery-context pots, presents exact feature names/values independently, and handles image-error fallback. Neither renderer invents mutation outcomes or owns a pot as part of plant genetics.

Recommended separate implementation passes, each gated by art review:

1. Confirm the reported four Normal San Pedro masters are actually available at their approved source path, inspect alpha, registration, stage continuity, and preserve them; do not convert or load them during this architecture pass.
2. Approve a small phenotype reference sheet: Normal, Variegated, Dense Spination, Shiny, each structural mutation across selected stages, and at least two difficult structural combinations. Decide visual dominance/onset and color boundaries before commissioning modules.
3. Add typed species profile and body/recipe manifest, content validation, and a pure shared resolver with deterministic fixture cases for clone resemblance, stage swaps, Shiny, partial support, and multi-feature combinations. Keep domain genetics unchanged.
4. Integrate four approved Normal stage assets with safe preload and React/Phaser fallback, matching the existing San Pedro baseline; review Garden, Plant Details, and Nursery sizes on desktop/mobile. This is a separate authorized runtime task.
5. Author and integrate one body-changing mutation, its stage continuity, body-compatible Variegation mask, and Dense Spination plate as a vertical composition test. Test with and without Shiny and across renderers before broadening art production.
6. Extend only approved body families/composite recipes. Measure atlas/memory cost and mobile readability; keep a development gallery and support diagnostics. Do not mass-generate unreviewed combinations.

## Human decisions still open

- Which early-stage morphology signs and onset points are visually convincing for each expressed structural feature, particularly Dichotomous splitting and Crested emergence?
- Which coexpressed structural pairs merit a combined authored body, and what *explicit* visual-dominance fallback is acceptable for pairs without one? No general priority has been approved.
- Which Normal San Pedro palette grades, Variegation mask families, coverage bands, and Shiny highlights preserve the approved hand-painted material style?
- Can the supplied Normal masters provide separable/registrable areole and epidermis references, or will some spine/mask variants need alternate authored body plates? Inspect actual files only in a later asset pass.
- If exact rib count, rib shifting, color, or additional spine traits become gameplay genes later, what are their domain semantics and approved visual bands? They are **not present now**.
- What frame/LOD and module count keeps the first complex phenotype readable on a representative phone? This needs an actual art/runtime benchmark.

No decision above changes current expression, inheritance, compatibility, Shiny odds, species data, Garden assignments, Nursery growth, or approved building geometry. No artwork or runtime changes are authorized by this document.
