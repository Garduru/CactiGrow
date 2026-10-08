"""Reproduce registered runtime exports with Python 3 and Pillow.

Run from any directory: python art-source/characters/desert-grower-v01/prepare-assets.py
Only crop, resize and alpha-composite the supplied master; do not repaint the artwork.
"""
import json
from pathlib import Path
from PIL import Image

source_folder = Path(__file__).resolve().parent
repository = source_folder.parents[2]
registration = json.loads((source_folder / "registration.json").read_text())
source = Image.open(source_folder / registration["source"])
destination = repository / "public" / "assets" / "characters" / "player"
destination.mkdir(parents=True, exist_ok=True)
for layer in registration["layers"]:
    canvas = Image.new("RGBA", tuple(registration["canvasSize"]))
    crop = source.crop(tuple(layer["crop"])).resize(tuple(layer["size"]), Image.Resampling.LANCZOS)
    canvas.alpha_composite(crop, tuple(layer["position"]))
    canvas.save(destination / (layer["name"] + ".webp"), lossless=True, method=6)
