"""Deterministically package generated Settlement V1 raster masters.

The four preserved source sheets are generated artwork. This exporter only
crops, proportionally resizes, and registers cells; it does not paint/recolor
pixels, infer gameplay collision, or edit any accepted desert/building assets.
Run from the repository root with a Pillow-capable Python environment.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / ".wrangler/art-python"))
from PIL import Image, ImageChops, ImageDraw, ImageFilter

CELL = 128
COLUMNS = ROWS = 8
BASELINE = 122
SOURCES = [
    "world-settlement-ground-v01-master-r02.png",
    "world-settlement-edges-v01-master.png",
    "world-settlement-farm-props-v01-master.png",
    "world-settlement-town-props-v01-master.png",
]
NAMES = [
    *[f"packed-earth-{n}" for n in range(4)],
    *[f"swept-dirt-{n}" for n in range(4)],
    *[f"cultivated-soil-{n}" for n in range(4)],
    *[f"stone-paver-{n}" for n in range(4)],
    "low-stone-H", "low-stone-V", "low-stone-corner-nw", "low-stone-corner-ne",
    "low-stone-corner-sw", "low-stone-corner-se", "drainage-H", "drainage-V",
    "timber-fence-H", "timber-fence-V", "timber-gate-post", "stone-gate-post",
    "irrigation-H", "irrigation-V", "irrigation-elbow", "irrigation-tee",
    "water-barrel", "closed-crate", "crate-stack", "soil-sack",
    "pot-stack", "woven-basket", "watering-can", "hand-tool-bundle",
    "propagation-table", "seedling-tray", "wheelbarrow", "soil-bag-stack",
    "compost-bin", "empty-raised-bed", "cactus-raised-bed", "small-shade-canopy",
    "bench-horizontal", "bench-side", "lantern-post", "botanical-noticeboard",
    "public-water-trough", "public-cactus-planter", "modest-cloth-awning", "cactus-display-stand",
    "stone-threshold", "wood-threshold", "paver-border-H", "paver-border-V",
    "bed-border-H", "bed-border-V", "drain-mouth", "coiled-irrigation-hose",
]
# Visible content envelopes, in world units when the 128-square prop frame is
# displayed at 128-square. These are proportional fits, never independent axes.
ENVELOPES = [
    (116, 34), (44, 106), (100, 62), (100, 62), (100, 62), (100, 62), (116, 26), (36, 106),
    (116, 60), (58, 108), (60, 118), (90, 118), (116, 15), (15, 108), (94, 75), (104, 75),
    (52, 62), (46, 42), (62, 64), (36, 44), (40, 52), (46, 36), (45, 45), (54, 45),
    (104, 55), (66, 28), (94, 66), (62, 48), (56, 58), (106, 48), (106, 60), (116, 108),
    (94, 52), (48, 65), (42, 104), (72, 98), (104, 48), (60, 75), (116, 94), (86, 68),
    (100, 24), (100, 20), (116, 22), (26, 106), (116, 24), (26, 106), (48, 32), (56, 30),
]
# Two neighboring Farm subjects have touching low-opacity source shadow/leaf
# pixels. Inspected bounds split the wheelbarrow and raised planter at their
# actual raster separation, retaining each complete meaningful silhouette.
SOURCE_CROPS = {2: {10: (631, 668, 998, 913), 14: (631, 913, 958, 1205)}}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bbox_at(image, threshold=1):
    return image.getchannel("A").point(lambda value: 255 if value >= threshold else 0).getbbox()


def expanded(box, image, pad=3):
    return (max(0, box[0] - pad), max(0, box[1] - pad), min(image.width, box[2] + pad), min(image.height, box[3] + pad))


def isolated_source_bounds(source, overrides):
    """Locate complete alpha silhouettes, including ones crossing grid lines.

    Generators keep the requested row/column ordering but occasionally let a
    barrel/table extend beyond its nominal cell. Connected-component bounds
    isolate the actual raster subject rather than cutting at a guessed grid.
    The crop retains original alpha; this is not background removal/repainting.
    """
    alpha = source.getchannel("A").tobytes()
    width, height = source.size
    visited = bytearray(width * height)
    candidates = {}
    for start, value in enumerate(alpha):
        if value < 8 or visited[start]:
            continue
        visited[start] = 1
        stack = [start]
        pixels = []
        count = 0
        left, top, right, bottom = width, height, 0, 0
        while stack:
            pixel = stack.pop()
            pixels.append(pixel)
            x, y = pixel % width, pixel // width
            count += 1
            left, top, right, bottom = min(left, x), min(top, y), max(right, x + 1), max(bottom, y + 1)
            neighbors = []
            if x: neighbors.append(pixel - 1)
            if x + 1 < width: neighbors.append(pixel + 1)
            if y: neighbors.append(pixel - width)
            if y + 1 < height: neighbors.append(pixel + width)
            for neighbor in neighbors:
                if not visited[neighbor] and alpha[neighbor] >= 8:
                    visited[neighbor] = 1
                    stack.append(neighbor)
        if count < 256:
            continue
        col = min(3, int((left + right) / 2 * 4 / width))
        row = min(3, int((top + bottom) / 2 * 4 / height))
        slot = row * 4 + col
        if slot not in candidates or count > candidates[slot][0]:
            candidates[slot] = (count, (left, top, right, bottom), pixels)
    components = dict(candidates)
    for slot, bounds in overrides.items():
        # The only overridden subjects share one connected source silhouette;
        # isolate its wheelbarrow/planter portions using the inspected bounds.
        component = components.get(slot, components[10])
        candidates[slot] = (component[0], bounds, component[2])
    if len(candidates) != 16:
        raise ValueError(f"Expected16 isolated source subjects, found slots {candidates}")
    subjects = {}
    for slot, (_, bounds, pixels) in candidates.items():
        box = bounds if slot in overrides else expanded(bounds, source)
        crop = source.crop(box)
        mask_bytes = bytearray(crop.width * crop.height)
        for pixel in pixels:
            x, y = pixel % width - box[0], pixel // width - box[1]
            if 0 <= x < crop.width and 0 <= y < crop.height:
                mask_bytes[y * crop.width + x] = 255
        # Retain the original antialiasing around the selected subject. Other
        # source subjects inside a rectangular crop are excluded, not painted.
        mask = Image.frombytes("L", crop.size, bytes(mask_bytes)).filter(ImageFilter.MaxFilter(7))
        crop.putalpha(ImageChops.multiply(crop.getchannel("A"), mask))
        subjects[slot] = (box, crop)
    return subjects


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=REPO / "art-source/world/settlement")
    parser.add_argument("--output", type=Path, default=REPO / "public/assets/world/tiles/world-settlement-master-v01.png")
    parser.add_argument("--manifest", type=Path, default=REPO / "world/settlement-master-v01.json")
    parser.add_argument("--review", type=Path, default=REPO / ".wrangler/settlement-art-work/settlement-atlas-review.png")
    args = parser.parse_args()
    atlas = Image.new("RGBA", (CELL * COLUMNS, CELL * ROWS))
    frames = []
    source_records = []
    for sheet_index, filename in enumerate(SOURCES):
        path = args.source / filename
        source = Image.open(path).convert("RGBA")
        extrema = source.getchannel("A").getextrema()
        source_records.append({"path": path.relative_to(REPO).as_posix(), "sha256": sha256(path), "width": source.width, "height": source.height, "alphaRange": list(extrema)})
        if sheet_index > 0 and extrema[0] != 0:
            raise ValueError(f"Expected true transparency in {filename}: alpha {extrema}")
        isolated = isolated_source_bounds(source, SOURCE_CROPS.get(sheet_index, {})) if sheet_index > 0 else None
        for source_id in range(16):
            col, row = source_id % 4, source_id // 4
            box = (round(col * source.width / 4), round(row * source.height / 4), round((col + 1) * source.width / 4), round((row + 1) * source.height / 4))
            source_cell = source.crop(box)
            tile_id = sheet_index * 16 + source_id
            if sheet_index == 0:
                # Crop only the two-pixel cell edge to avoid generator dividers;
                # material remains authored raster, with no color/texture edits.
                cell = source_cell.crop((2, 2, source_cell.width - 2, source_cell.height - 2)).resize((CELL, CELL), Image.Resampling.LANCZOS)
                if cell.getchannel("A").getextrema() != (255, 255):
                    raise ValueError(f"Ground material {tile_id} must be opaque")
                content_box = [2, 2, source_cell.width - 2, source_cell.height - 2]
            else:
                box, content = isolated[source_id]
                content_box = list(box)
                content.thumbnail(ENVELOPES[tile_id - 16], Image.Resampling.LANCZOS)
                cell = Image.new("RGBA", (CELL, CELL))
                cell.alpha_composite(content, ((CELL - content.width) // 2, BASELINE - content.height))
                if bbox_at(cell, 8) is None:
                    raise ValueError(f"Blank exported cell {tile_id}")
            slot = ((tile_id % COLUMNS) * CELL, (tile_id // COLUMNS) * CELL)
            atlas.alpha_composite(cell, slot)
            bounds = bbox_at(cell, 8)
            frames.append({"tileId": tile_id, "name": NAMES[tile_id], "category": "ground" if tile_id < 16 else "edge" if tile_id < 32 else "prop", "sourceSheet": sheet_index, "sourceCell": source_id, "sourceCrop": list(box), "sourceContentCrop": content_box, "atlasRect": [*slot, CELL, CELL], "alphaBounds": list(bounds) if bounds else None, "alphaRange": list(cell.getchannel("A").getextrema()), "footBaseline": CELL if tile_id < 16 else BASELINE, "origin": [0.5, 1] if tile_id < 16 else [0.5, BASELINE / CELL]})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.output, optimize=True, compress_level=9)
    manifest = {
        "identifier": "CactiGrowSettlementMasterV1",
        "runtimePath": "/assets/world/tiles/world-settlement-master-v01.png",
        "tileSize": CELL, "columns": COLUMNS, "rows": ROWS, "samplingInset": 1,
        "ground": {"packed-earth": list(range(0, 4)), "swept-dirt": list(range(4, 8)), "cultivated-soil": list(range(8, 12)), "stone-paver": list(range(12, 16))},
        "edges": {NAMES[n]: n for n in range(16, 32)},
        "props": {NAMES[n]: n for n in range(32, 64)},
        "propDisplay": {"width": CELL, "height": CELL, "preserveAspect": True, "footBaseline": BASELINE, "originX": 0.5, "originY": BASELINE / CELL, "collision": "none; independently authored gameplay geometry only"},
        "repeatJoin": {"names": [name for name in NAMES[16:] if name.endswith(("-H", "-V"))], "note": "Isolated art strips; use actual frame alphaBounds when repeating. Transparent margins require overlap for visual continuity; no gameplay geometry is inferred."},
        "sources": source_records,
        "frames": frames,
        "export": {"sha256": sha256(args.output), "encodedBytes": args.output.stat().st_size, "decodedRgbaBytes": atlas.width * atlas.height * 4, "width": atlas.width, "height": atlas.height, "mode": "RGBA", "operation": "deterministic subject isolation, crop, proportional LANCZOS resize, alpha registration; retained authored pixels unchanged before resize; no repaint/recolor"},
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    # Local review only: frames retain the exact exported pixels over a neutral
    # checkerboard, with labels outside each cell. This is never shipped.
    review = Image.new("RGB", (COLUMNS * 160, ROWS * 164), "#ded1b8")
    draw = ImageDraw.Draw(review)
    for frame in frames:
        x, y = (frame["tileId"] % COLUMNS) * 160, (frame["tileId"] // COLUMNS) * 164
        for yy in range(0, CELL, 16):
            for xx in range(0, CELL, 16):
                draw.rectangle((x + xx, y + yy, x + xx + 15, y + yy + 15), fill="#ede1c9" if (xx + yy) // 16 % 2 else "#c9bca5")
        cx, cy, _, _ = frame["atlasRect"]
        cell = atlas.crop((cx, cy, cx + CELL, cy + CELL))
        review.paste(cell, (x, y), cell)
        draw.text((x, y + 130), f'{frame["tileId"]} {frame["name"]}', fill="#332b21")
    args.review.parent.mkdir(parents=True, exist_ok=True)
    review.save(args.review)
    print(json.dumps({"atlas": str(args.output), "sha256": manifest["export"]["sha256"], "encodedBytes": manifest["export"]["encodedBytes"], "decodedRgbaBytes": manifest["export"]["decodedRgbaBytes"], "frames": len(frames), "review": str(args.review)}))


if __name__ == "__main__":
    main()
