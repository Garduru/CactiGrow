"""Deterministic mechanical export of the new wild-only Peyote prop.

Retain the original RGBA source, crop to its alpha >=8 subject bounds, and
proportionally downsample to width 384. The generated alpha1 fringe outside
those bounds is excluded by cropping; surviving pixel alpha is not cleaned.
No repaint, recolor, background replacement or alpha manipulation.
Run from the repository root; existing .wrangler/art-python supplies Pillow.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import sys

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / ".wrangler/art-python"))
from PIL import Image

SOURCE = REPO / "art-source/world/first-basin-exploration/wild-peyote-source-v01.png"
OUTPUT = REPO / "public/assets/world/props/wild-peyote-v01.webp"
CROP_ALPHA_THRESHOLD = 8


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(image, threshold):
    return image.getchannel("A").point(lambda value: 255 if value >= threshold else 0).getbbox()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Original generated PNG to preserve before exporting.")
    args = parser.parse_args()
    if args.source:
        original = args.source.resolve(strict=True)
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        if SOURCE.exists() and digest(SOURCE) != digest(original):
            raise ValueError("Preserved Peyote source already exists with different bytes.")
        if original != SOURCE:
            shutil.copyfile(original, SOURCE)
        assert digest(original) == digest(SOURCE), "Original source must remain byte exact."
    with Image.open(SOURCE) as source:
        assert source.mode == "RGBA", "The source must already contain genuine RGBA transparency."
        assert source.getchannel("A").getextrema() == (0, 255)
        crop = bounds(source, CROP_ALPHA_THRESHOLD)
        assert crop, "The source cannot be empty."
        subject = source.crop(crop)
        width = 384
        height = (subject.height * width + subject.width // 2) // subject.width
        exported = subject.resize((width, height), Image.Resampling.LANCZOS)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        exported.save(OUTPUT, format="WEBP", lossless=True, quality=100, method=6, exact=True)
        with Image.open(OUTPUT) as decoded:
            assert decoded.mode == "RGBA" and decoded.size == exported.size
            assert decoded.getchannel("A").tobytes() == exported.getchannel("A").tobytes(), "Exported alpha must be lossless."
            assert decoded.tobytes() == exported.tobytes(), "WebP must preserve the full downsampled RGBA pixels."
            report = {
                "source": SOURCE.relative_to(REPO).as_posix(),
                "sourceSize": source.size,
                "sourceSha256": digest(SOURCE),
                "cropAlphaThreshold": CROP_ALPHA_THRESHOLD,
                "subjectCrop": crop,
                "sourceVisibleAlphaBounds": bounds(source, 8),
                "output": OUTPUT.relative_to(REPO).as_posix(),
                "outputSize": decoded.size,
                "outputAlphaRange": decoded.getchannel("A").getextrema(),
                "outputVisibleAlphaBounds": bounds(decoded, 8),
                "outputSha256": digest(OUTPUT),
                "encodedBytes": OUTPUT.stat().st_size,
                "operation": "alpha>=8 bounds crop; original surviving alpha retained; proportional LANCZOS downsample; lossless RGBA WebP",
            }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
