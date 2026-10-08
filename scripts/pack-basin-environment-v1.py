"""Package the generated First Basin V1 raster sources without repainting.

Only the new sibling atlas and its manifest are written. Accepted desert,
settlement, building, and character images are never opened for mutation.
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
COLUMNS, ROWS = 8, 4
BASELINE = 122
SOURCES = [
    ("world-first-basin-ground-v01-master.png", 4, 2),
    ("world-first-basin-cave-walls-v01-master.png", 4, 4),
    ("world-first-basin-props-v01-master.png", 4, 2),
]
PROP_NAMES = [
    "loose-mineral-rubble", "dry-root-debris", "weathered-mineral-rock", "damp-floor-patch",
    "stratified-rock-pillar", "wild-cactus-cluster", "trail-cairn", "rockslide-barrier-debris",
]
PROP_WORLD_SIZES = [160, 160, 192, 160, 256, 224, 160, 224]
PROP_ENVELOPES = [(116, 76), (116, 64), (108, 95), (116, 44), (100, 116), (114, 114), (74, 108), (116, 96)]
NAMES = [*[f"cave-dusty-stone-{n}" for n in range(4)], *[f"cave-compacted-earth-{n}" for n in range(4)],
         *[f"cave-wall-mask-{n}" for n in range(16)], *PROP_NAMES]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_bounds(image, threshold=8):
    return image.getchannel("A").point(lambda value: 255 if value >= threshold else 0).getbbox()


def isolated_props(source):
    """Retain each full authored silhouette even across nominal grid edges.

    Alpha components locate subjects, not new geometry. A small dilation keeps
    each selected source subject's original antialiasing/contact-shadow alpha;
    overlapping rectangles never import pixels belonging to a neighbor.
    """
    alpha = source.getchannel("A").tobytes()
    width, height = source.size
    visited = bytearray(width * height)
    candidates = {}
    for start, value in enumerate(alpha):
        if value < 8 or visited[start]:
            continue
        visited[start] = 1
        stack, pixels = [start], []
        left, top, right, bottom = width, height, 0, 0
        while stack:
            pixel = stack.pop()
            pixels.append(pixel)
            x, y = pixel % width, pixel // width
            left, top = min(left, x), min(top, y)
            right, bottom = max(right, x + 1), max(bottom, y + 1)
            neighbors = []
            if x: neighbors.append(pixel - 1)
            if x + 1 < width: neighbors.append(pixel + 1)
            if y: neighbors.append(pixel - width)
            if y + 1 < height: neighbors.append(pixel + width)
            for neighbor in neighbors:
                if not visited[neighbor] and alpha[neighbor] >= 8:
                    visited[neighbor] = 1
                    stack.append(neighbor)
        if len(pixels) < 256:
            continue
        slot = min(1, int((top + bottom) / 2 * 2 / height)) * 4 + min(3, int((left + right) / 2 * 4 / width))
        if slot not in candidates or len(pixels) > len(candidates[slot][1]):
            candidates[slot] = ((left, top, right, bottom), pixels)
    if set(candidates) != set(range(8)):
        raise ValueError(f"Expected8 isolated prop subjects, got {list(candidates)}")
    subjects = {}
    for slot, (bounds, pixels) in candidates.items():
        box = (max(0, bounds[0] - 3), max(0, bounds[1] - 3), min(width, bounds[2] + 3), min(height, bounds[3] + 3))
        crop = source.crop(box)
        mask_bytes = bytearray(crop.width * crop.height)
        for pixel in pixels:
            x, y = pixel % width - box[0], pixel // width - box[1]
            mask_bytes[y * crop.width + x] = 255
        mask = Image.frombytes("L", crop.size, bytes(mask_bytes)).filter(ImageFilter.MaxFilter(7))
        crop.putalpha(ImageChops.multiply(crop.getchannel("A"), mask))
        subjects[slot] = (box, crop)
    return subjects


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=REPO / "art-source/world/first-basin")
    parser.add_argument("--output", type=Path, default=REPO / "public/assets/world/tiles/world-first-basin-extension-v01.png")
    parser.add_argument("--manifest", type=Path, default=REPO / "world/first-basin-extension-v01.json")
    parser.add_argument("--review", type=Path, default=REPO / ".wrangler/first-basin-work/first-basin-atlas-review.png")
    args = parser.parse_args()
    atlas = Image.new("RGBA", (COLUMNS * CELL, ROWS * CELL))
    frames, source_records = [], []
    next_id = 0
    for source_index, (filename, columns, rows) in enumerate(SOURCES):
        path = args.source / filename
        source = Image.open(path).convert("RGBA")
        extrema = source.getchannel("A").getextrema()
        expected_alpha = (255, 255) if source_index < 2 else (0, 255)
        if extrema != expected_alpha:
            raise ValueError(f"Unexpected source alpha in {filename}: {extrema}; expected {expected_alpha}")
        source_records.append({"path": path.relative_to(REPO).as_posix(), "sha256": sha256(path),
                               "width": source.width, "height": source.height, "columns": columns, "rows": rows,
                               "alphaRange": list(extrema)})
        subjects = isolated_props(source) if source_index == 2 else None
        for source_id in range(columns * rows):
            col, row = source_id % columns, source_id // columns
            box = (round(col * source.width / columns), round(row * source.height / rows),
                   round((col + 1) * source.width / columns), round((row + 1) * source.height / rows))
            raw = source.crop(box)
            tile_id = next_id
            next_id += 1
            if source_index < 2:
                # Remove only generator cell separators. The tile remains
                # authored raster material, with no color or texture edits.
                content_box = (2, 2, raw.width - 2, raw.height - 2)
                cell = raw.crop(content_box).resize((CELL, CELL), Image.Resampling.LANCZOS)
                if cell.getchannel("A").getextrema() != (255, 255):
                    raise ValueError(f"Material cell {tile_id} is not opaque")
            else:
                box, content = subjects[source_id]
                content_box = box
                content.thumbnail(PROP_ENVELOPES[tile_id - 24], Image.Resampling.LANCZOS)
                cell = Image.new("RGBA", (CELL, CELL))
                cell.alpha_composite(content, ((CELL - content.width) // 2, BASELINE - content.height))
                bounds = alpha_bounds(cell)
                if bounds is None or bounds[0] < 2 or bounds[1] < 2 or bounds[2] > 126 or bounds[3] > BASELINE:
                    raise ValueError(f"Export prop bounds invalid {tile_id}: {bounds}")
            slot = ((tile_id % COLUMNS) * CELL, (tile_id // COLUMNS) * CELL)
            atlas.alpha_composite(cell, slot)
            frame = {"tileId": tile_id, "name": NAMES[tile_id],
                     "category": "ground" if tile_id < 8 else "cave-wall" if tile_id < 24 else "prop",
                     "sourceSheet": source_index, "sourceCell": source_id, "sourceCrop": list(box),
                     "sourceContentCrop": list(content_box), "atlasRect": [*slot, CELL, CELL],
                     "alphaBounds": list(alpha_bounds(cell)), "alphaRange": list(cell.getchannel("A").getextrema()),
                     "footBaseline": BASELINE if tile_id >= 24 else CELL,
                     "origin": [0.5, BASELINE / CELL] if tile_id >= 24 else [0.5, 1]}
            if tile_id >= 24:
                size = PROP_WORLD_SIZES[tile_id - 24]
                frame.update({"displayWidth": size, "displayHeight": size})
            frames.append(frame)
    if len(frames) != 32:
        raise ValueError(f"Expected32 frames, got {len(frames)}")
    unique = {hashlib.sha256(atlas.crop((x, y, x + CELL, y + CELL)).tobytes()).hexdigest()
              for x, y, _, _ in (frame["atlasRect"] for frame in frames)}
    if len(unique) != 32:
        raise ValueError(f"Only {len(unique)} distinct source exports")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.output, optimize=True, compress_level=9)
    manifest = {
        "identifier": "CactiGrowFirstBasinExtensionV1",
        "runtimePath": "/assets/world/tiles/world-first-basin-extension-v01.png",
        "tileSize": CELL, "columns": COLUMNS, "rows": ROWS, "samplingInset": 1,
        "ground": {"cave-dusty-stone": list(range(4)), "cave-compacted-earth": list(range(4, 8))},
        "caveWalls": {"firstTileId": 8, "count": 16, "neighborBits": {"north": 1, "east": 2, "south": 4, "west": 8},
                      "authority": "visual connection mask derived only from unchanged authored IntGrid"},
        "props": {name: index + 24 for index, name in enumerate(PROP_NAMES)},
        "propDisplay": {"preserveAspect": True, "footBaseline": BASELINE, "originX": 0.5, "originY": BASELINE / CELL,
                        "collision": "none; independently authored gameplay geometry only"},
        "propRegistration": {name: {"displayWidth": size, "displayHeight": size, "footBaseline": BASELINE}
                             for name, size in zip(PROP_NAMES, PROP_WORLD_SIZES)},
        "sources": source_records, "frames": frames,
        "export": {"sha256": sha256(args.output), "encodedBytes": args.output.stat().st_size,
                   "decodedRgbaBytes": atlas.width * atlas.height * 4, "width": atlas.width, "height": atlas.height,
                   "mode": "RGBA", "operation": "deterministic alpha-subject isolation, crop, proportional LANCZOS resize, alpha registration; no repaint/recolor"},
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    review = Image.new("RGB", (COLUMNS * 164, ROWS * 168), "#c0b7a9")
    draw = ImageDraw.Draw(review)
    for frame in frames:
        x, y = frame["tileId"] % COLUMNS * 164, frame["tileId"] // COLUMNS * 168
        for yy in range(0, CELL, 16):
            for xx in range(0, CELL, 16):
                draw.rectangle((x + xx, y + yy, x + xx + 15, y + yy + 15),
                               fill="#e2d9cb" if (xx + yy) // 16 % 2 else "#b5aa99")
        cx, cy, _, _ = frame["atlasRect"]
        cell = atlas.crop((cx, cy, cx + CELL, cy + CELL))
        review.paste(cell, (x, y), cell)
        draw.text((x, y + 130), f'{frame["tileId"]} {frame["name"]}', fill="#302b25")
    args.review.parent.mkdir(parents=True, exist_ok=True)
    review.save(args.review)
    print(json.dumps({"atlas": str(args.output), **manifest["export"], "frames": len(frames), "uniqueFrames": len(unique),
                      "review": str(args.review)}))


if __name__ == "__main__":
    main()
