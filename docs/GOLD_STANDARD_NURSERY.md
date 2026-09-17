# Nursery V1 historical lessons

Status: retired and removed from runtime.

Nursery V1 established the approved CactiGrow material and mood direction: stylized hand-painted 3D with clean semi-cartoon forms, medium environmental detail, warm natural desert light, readable silhouettes, restrained texture noise, and practical early-game grower construction. Its warm timber, dark metal connectors, low stone foundation, clear or slightly cool glazing, roof vents, ventilation fan, warm work lights, organized benches, terracotta containers, young San Pedro, and young Peyote remain useful visual lessons.

The experiment also exposed constraints that Building Standard V2 resolves:

- Dramatic diagonal/isometric compositions conflict with simple authored footprints, south-facing entrances, paths, and collision.
- Logical placement footprint, physical collision, interaction geometry, visual bounds, and shadow bounds must remain independent.
- A complete main exterior is safer than stacking two complete building images around the player.
- Contact shadows need their own approved registration and must visibly connect to the foundation.
- Landscaping, paths, terrain, and detached props must remain separate from major-building art for depth, reuse, collision, and future customization.
- Production assets need explicit origins, ground anchors, runtime display sizes, source canvases, alpha margins, and typed registration.

The Nursery V1 base, glass, shadow, composition code, debug switch, collision workarounds, depth constants, manifest, and original-export backups have been removed. Do not restore or tune them.

Nursery V2 is the authoritative, human-approved Nursery exterior. Its production main asset is integrated in the canonical Farm, with the final walk-tested collider documented in [`NURSERY_V2_ASSET_CONTRACT.md`](NURSERY_V2_ASSET_CONTRACT.md). Follow that contract and [`BUILDING_ART_STANDARD.md`](BUILDING_ART_STANDARD.md); do not restore Nursery V1 runtime work.
