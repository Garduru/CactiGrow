"""Deterministic Character V2 exports from generated transparent raster masters.

Run: python art-source/characters/desert-grower-v02/prepare-assets.py
Requires Pillow. It only crops, rescales, registers and derives material masks;
it never invents character poses or repaints generated artwork.
"""
import colorsys
import json
from pathlib import Path
import statistics
import sys

SOURCE_FOLDER = Path(__file__).resolve().parent
REPOSITORY = SOURCE_FOLDER.parents[2]
sys.path.insert(0, str(REPOSITORY / ".wrangler" / "art-python"))
from PIL import Image, ImageFilter

CONFIG = json.loads((SOURCE_FOLDER / "registration.json").read_text())
DESTINATION = REPOSITORY / "public" / "assets" / "characters"
FRAME_WIDTH, FRAME_HEIGHT = CONFIG["canvasSize"]
DIRECTIONS = CONFIG["directions"]


def cell(source, columns, column, row):
    """Fractional source grids use rounded boundaries, without cumulative drift."""
    return source.crop((round(source.width * column / columns), round(source.height * row / 4),
                        round(source.width * (column + 1) / columns), round(source.height * (row + 1) / 4)))


def visible_bounds(source):
    return source.getchannel("A").point(lambda alpha: 255 if alpha >= 12 else 0).getbbox()


def isolate(source):
    """Keep the main authored alpha island; exclude neighboring-cell fragments."""
    width, height = source.size
    alpha = list(source.getchannel("A").get_flattened_data())
    seen = bytearray(width * height)
    largest = []
    for first, value in enumerate(alpha):
        if value < 12 or seen[first]:
            continue
        seen[first] = 1
        component, pending = [], [first]
        while pending:
            point = pending.pop()
            component.append(point)
            x, y = point % width, point // width
            for next_x, next_y in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if 0 <= next_x < width and 0 <= next_y < height:
                    neighbor = next_y * width + next_x
                    if not seen[neighbor] and alpha[neighbor] >= 12:
                        seen[neighbor] = 1
                        pending.append(neighbor)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise ValueError("Empty generated alpha cell")
    left = max(0, min(point % width for point in largest) - 1)
    right = min(width, max(point % width for point in largest) + 2)
    top = max(0, min(point // width for point in largest) - 1)
    bottom = min(height, max(point // width for point in largest) + 2)
    result = Image.new("RGBA", source.size)
    result.alpha_composite(source.crop((left, top, right, bottom)), (left, top))
    return result


def pigment(red, green, blue, alpha):
    if alpha < 12:
        return 0
    hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
    hue *= 360
    light = .2126 * red + .7152 * green + .0722 * blue
    # The source brief deliberately separates slate-blue cloth, neutral gray
    # trousers and warm tan exposed skin. Classification follows posed limbs.
    if 175 <= hue <= 250 and saturation >= .12 and blue > red * 1.04:
        return 2
    if (saturation <= .33 and light >= 38 or saturation <= .42 and light >= 70 and hue >= 28) and ((18 <= hue <= 65 and saturation >= .08) or (165 <= hue <= 250)):
        return 3
    if 12 <= hue <= 55 and saturation >= .18 and light >= 82:
        return 1
    return 0


def material_mask(image):
    mask = Image.new("RGBA", image.size)
    originals = list(image.get_flattened_data())
    classified = [pigment(*pixel) for pixel in originals]
    # Broad painted highlights sometimes cross a hue threshold. Close small
    # holes in the derived mask, while retaining the source lighting and alpha.
    # Each source material remains contiguous rather than recolored speckles.
    closed = {}
    for material in (1, 2, 3):
        plane = Image.new("L", image.size)
        plane.putdata([255 if choice == material else 0 for choice in classified])
        size = 11 if material == 3 else 7
        plane = plane.filter(ImageFilter.MaxFilter(size)).filter(ImageFilter.MinFilter(size)).filter(ImageFilter.MedianFilter(3))
        closed[material] = list(plane.get_flattened_data())
    pixels = []
    luminance = {1: [], 2: [], 3: []}
    counts = {1: 0, 2: 0, 3: 0}
    for index, (red, green, blue, alpha) in enumerate(originals):
        material = 0
        if alpha >= 12:
            material = next((choice for choice in (2, 3, 1) if closed[choice][index]), classified[index])
        pixels.append((255 if material == 1 else 0, 255 if material == 2 else 0,
                       255 if material == 3 else 0, 255 if material else 0))
        if material:
            counts[material] += 1
            if alpha >= 128:
                luminance[material].append(.2126 * red + .7152 * green + .0722 * blue)
    mask.putdata(pixels)
    reference = [round(statistics.median(luminance[material]), 3) if luminance[material] else fallback
                 for material, fallback in [(1, 167), (2, 115), (3, 105)]]
    return mask, reference, counts


def anchors(frame, mask):
    """Head crown and torso attachment points derived once, never during motion."""
    skin = mask.getchannel("R")
    head_bounds = skin.crop((0, 0, FRAME_WIDTH, 75)).getbbox()
    if head_bounds:
        left, top, right, bottom = head_bounds
        crown = skin.crop((left, top, right, min(bottom, top + 20))).getbbox()
        head_x = left + (crown[0] + crown[2]) / 2 if crown else (left + right) / 2
        head_y = top
        skull = skin.crop((left, top, right, min(bottom, top + 40))).getbbox()
        head_width = skull[2] - skull[0] if skull else right - left
    else:
        head_x, head_y, head_width = 64, 18, 46
    shirt_bounds = mask.getchannel("G").crop((0, 55, FRAME_WIDTH, 145)).getbbox()
    if shirt_bounds:
        left, top, right, bottom = shirt_bounds
        torso_x, torso_y = (left + right) / 2, top + 55
    else:
        torso_x, torso_y = 64, 65
    return {"head": [round(head_x, 2), head_y], "headWidth": head_width,
            "torso": [round(torso_x, 2), torso_y], "alphaBounds": list(visible_bounds(frame))}


def save(image, relative):
    target = DESTINATION / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.suffix == ".webp":
        image.save(target, lossless=True, method=6)
    else:
        image.save(target, optimize=True)
    return target.stat().st_size


def export_bodies():
    exported = {}
    for body in CONFIG["bodies"]:
        source = Image.open(SOURCE_FOLDER / body["source"]).convert("RGBA")
        cells = [isolate(cell(source, 5, column, body["sourceDirections"].index(direction)))
                 for direction in DIRECTIONS for column in range(5)]
        if "idleSource" in body:
            idle_source = Image.open(SOURCE_FOLDER / body["idleSource"]).convert("RGBA")
            for row, direction in enumerate(DIRECTIONS):
                # Supplemental idle art replaces only column zero. Genuine
                # articulated walking frames remain from the original master.
                idle = isolate(cell(idle_source, 1, 0, body.get("idleDirections", DIRECTIONS).index(direction)))
                original_bounds, idle_bounds = visible_bounds(cells[row * 5]), visible_bounds(idle)
                ratio = (original_bounds[3] - original_bounds[1]) / (idle_bounds[3] - idle_bounds[1])
                crop = idle.crop(idle_bounds)
                crop = crop.resize((round(crop.width * ratio), round(crop.height * ratio)), Image.Resampling.LANCZOS)
                registered = Image.new("RGBA", cells[row * 5].size)
                registered.alpha_composite(crop, (round((original_bounds[0] + original_bounds[2] - crop.width) / 2),
                                                 original_bounds[3] - crop.height))
                cells[row * 5] = registered
        bounds = [visible_bounds(frame) for frame in cells]
        if any(bound is None for bound in bounds):
            raise ValueError(f"Missing authored pose in {body['source']}")
        atlas = Image.new("RGBA", tuple(CONFIG["atlasSize"]))
        frame_metadata = []
        for index, original in enumerate(cells):
            row_bounds = bounds[(index // 5) * 5:(index // 5 + 1) * 5]
            tallest = max(bound[3] - bound[1] for bound in row_bounds)
            widest = max(bound[2] - bound[0] for bound in row_bounds)
            scale = min(CONFIG["bodyHeight"] / tallest, CONFIG["bodyWidthLimit"] / widest)
            baseline = max(bound[3] for bound in row_bounds)
            resized = original.resize((round(original.width * scale), round(original.height * scale)), Image.Resampling.LANCZOS)
            frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT))
            frame.alpha_composite(resized, (round(FRAME_WIDTH / 2 - original.width * scale / 2),
                                           round(CONFIG["bodyBaseline"] - baseline * scale)))
            mask, _, _ = material_mask(frame)
            frame_metadata.append(anchors(frame, mask))
            atlas.alpha_composite(frame, ((index % 5) * FRAME_WIDTH, (index // 5) * FRAME_HEIGHT))
        mask, references, counts = material_mask(atlas)
        info = {"sourceSize": list(source.size), "size": list(atlas.size), "frames": frame_metadata,
                "references": references, "pigmentPixelCounts": counts, "bytes": save(atlas, body["output"])}
        if "maskOutput" in body:
            info["maskBytes"] = save(mask, body["maskOutput"])
        exported[body["module"]] = info
    return exported


def export_cosmetics():
    exported = {}
    width, height = CONFIG["cosmeticCanvasSize"]
    for cosmetic in CONFIG["cosmetics"]:
        source = Image.open(SOURCE_FOLDER / cosmetic["source"]).convert("RGBA")
        atlas = Image.new("RGBA", (width, height * 4))
        frames = []
        for row in range(4):
            original = isolate(cell(source, cosmetic["columns"], cosmetic["column"], row))
            bounds = visible_bounds(original)
            if bounds is None:
                raise ValueError(f"Missing {DIRECTIONS[row]} {cosmetic['module']} artwork")
            crop = original.crop(bounds)
            scale = min(cosmetic["targetWidth"] / crop.width, cosmetic["maxHeight"] / crop.height)
            size = (round(crop.width * scale), round(crop.height * scale))
            resized = crop.resize(size, Image.Resampling.LANCZOS)
            left = round((width - size[0]) / 2)
            top = 8
            atlas.alpha_composite(resized, (left, row * height + top))
            # Anchor is the upper crown/strap point. The compositor attaches it
            # to the explicit posed body head or torso metadata.
            frames.append({"anchor": [width / 2, top + cosmetic.get("anchorOffset", 16 if cosmetic["kind"] == "hat" else 2)],
                           "bounds": [left, top, left + size[0], top + size[1]]})
        alpha_lights = [.2126*r + .7152*g + .0722*b for r, g, b, a in atlas.get_flattened_data() if a >= 128]
        exported[cosmetic["module"]] = {"size": list(atlas.size), "frameSize": [width, height],
                                        "frames": frames, "reference": round(statistics.median(alpha_lights), 3),
                                        "bytes": save(atlas, cosmetic["output"])}
    return exported


def main():
    bodies, cosmetics = export_bodies(), export_cosmetics()
    registration = {"version": CONFIG["version"], "directions": DIRECTIONS, "bodies": bodies, "cosmetics": cosmetics}
    (SOURCE_FOLDER / "export-report.json").write_text(json.dumps(registration, indent=2) + "\n")
    output = "// Generated by desert-grower-v02/prepare-assets.py; do not edit manually.\n"
    output += "export const CHARACTER_REGISTRATION = " + json.dumps(registration, separators=(",", ":")) + " as const\n"
    (REPOSITORY / "src" / "characters" / "characterRegistration.generated.ts").write_text(output)
    print(json.dumps({"bodies": {key: {"bytes": body["bytes"], "maskBytes": body.get("maskBytes", 0),
                                    "pigmentPixelCounts": body["pigmentPixelCounts"]} for key, body in bodies.items()},
                      "cosmetics": {key: cosmetic["bytes"] for key, cosmetic in cosmetics.items()}}, indent=2))


if __name__ == "__main__":
    main()
