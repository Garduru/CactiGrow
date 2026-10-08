"""Crop and resize the authored raster sheets into the LDtk master atlas.

Requires Pillow in the caller's Python environment. This performs deterministic
asset packaging only; it does not redraw, recolor or regenerate the artwork.
"""
from pathlib import Path
import argparse
import json
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, default=Path("art-source/world/desert"))
parser.add_argument("--output", type=Path, default=Path("public/assets/world/tiles/world-desert-master-v01.png"))
args = parser.parse_args()
manifest = json.loads(Path("world/desert-master-v01.json").read_text())
size, columns = manifest["tileSize"], manifest["columns"]
atlas = Image.new("RGBA", (columns * size, manifest["rows"] * size))
sources = ["world-desert-ground-v01-master.png", "world-desert-canyon-v01-master.png", "world-desert-props-v01-master.png"]
# The horizontal fence extends across its nominal grid line in the source sheet.
# These source bounds retain the full isolated fence while excluding its neighbor.
prop_crops = {8: (22, 650, 380, 902), 9: (412, 642, 612, 905)}
prop_bounds = [(76,60),(96,70),(64,72),(78,78),(55,73),(72,82),(88,65),(57,94),(116,66),(81,94),(62,65),(98,73),(76,63),(67,78),(78,78),(57,94)]
for sheet_index, filename in enumerate(sources):
    source = Image.open(args.source / filename).convert("RGBA")
    for source_tile in range(16):
        col, row = source_tile % 4, source_tile // 4
        box = (round(col * source.width / 4), round(row * source.height / 4), round((col+1) * source.width / 4), round((row+1) * source.height / 4))
        if sheet_index < 2:
            # Two pixels exclude the thin painted dividers from opaque terrain.
            box = (box[0]+2,box[1]+2,box[2]-2,box[3]-2)
            cell = source.crop(box).resize((size,size), Image.Resampling.LANCZOS)
        else:
            cell = source.crop(prop_crops.get(source_tile,box))
            # Use the visible alpha bounds for registration, retaining the original
            # edge alpha in the cropped pixels rather than changing transparency.
            bounds = cell.getchannel("A").point(lambda v:255 if v>12 else 0).getbbox()
            if bounds:
                cell = cell.crop(bounds)
            cell.thumbnail(prop_bounds[source_tile],Image.Resampling.LANCZOS)
            slot = Image.new("RGBA",(size,size))
            slot.alpha_composite(cell,((size-cell.width)//2,110-cell.height))
            cell = slot
        tile_id = sheet_index * 16 + source_tile
        atlas.alpha_composite(cell,((tile_id%columns)*size,(tile_id//columns)*size))
args.output.parent.mkdir(parents=True,exist_ok=True)
atlas.save(args.output,optimize=True)
print(f"Packed {atlas.width}x{atlas.height} master atlas: {args.output.stat().st_size:,} bytes")
