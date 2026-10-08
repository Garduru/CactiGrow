"""Pack four generated stationary views into the existing V2.1 NPC atlas format.

Only new Town assets are written. No painting, palette changes or old exports.
Walk columns intentionally repeat idle: these V1 actors never walk.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / '.wrangler' / 'art-python'))
from PIL import Image

SOURCE = Path(__file__).resolve().parent
DESTINATION = ROOT / 'public' / 'assets' / 'characters' / 'npc'
DIRECTIONS = ['south', 'west', 'east', 'north']
SOURCE_CELLS = [(0, 0), (0, 1), (1, 0), (1, 1)]
report = {'version': 'town-content-v01', 'mode': 'stationary-four-direction-idle',
          'frameSize': [128, 224], 'atlasSize': [640, 896], 'bodyBaseline': 216,
          'bodyHeight': 198, 'bodyWidthLimit': 108, 'npcs': {}}
for npc in ['rosa', 'tomas', 'inez']:
    source_path = SOURCE / f'desert-{npc}-idle-master-v01.png'
    source = Image.open(source_path).convert('RGBA')
    assert source.width % 2 == 0 and source.height % 2 == 0
    assert source.getchannel('A').getextrema() == (0, 255), 'Generated master must have genuine alpha.'
    width, height = source.width // 2, source.height // 2
    cells = [source.crop((x * width, y * height, (x + 1) * width, (y + 1) * height)) for x, y in SOURCE_CELLS]
    bounds = [cell.getchannel('A').point(lambda alpha: 255 if alpha >= 8 else 0).getbbox() for cell in cells]
    assert all(bounds), 'Every direction must contain a complete character.'
    scale = min(198 / max(b[3] - b[1] for b in bounds), 108 / max(b[2] - b[0] for b in bounds))
    atlas = Image.new('RGBA', (640, 896))
    frames = []
    for row, (cell, bound) in enumerate(zip(cells, bounds)):
        # Crop and losslessly pack the generated pixels; one shared proportion-preserving scale.
        crop = cell.crop(bound)
        resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (128, 224))
        frame.alpha_composite(resized, (round((128 - resized.width) / 2), 216 - resized.height))
        assert frame.getchannel('A').getbbox()[3] <= 216
        for column in range(5):
            atlas.alpha_composite(frame, (column * 128, row * 224))
        frames.append({'direction': DIRECTIONS[row], 'sourceCell': list(SOURCE_CELLS[row]),
                       'sourceBounds': list(bound), 'alphaBounds': list(frame.getchannel('A').getbbox()),
                       'sha256': hashlib.sha256(frame.tobytes()).hexdigest()})
    target = DESTINATION / npc / f'desert-{npc}-idle-v01.webp'
    target.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(target, lossless=True, method=6, exact=True)
    assert len({frame['sha256'] for frame in frames}) == 4
    report['npcs'][npc] = {'source': source_path.name, 'sourceSize': list(source.size),
                           'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
                           'url': '/' + target.relative_to(ROOT / 'public').as_posix(),
                           'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                           'scale': scale, 'uniqueIdleDirections': 4, 'walkingAuthored': False, 'frames': frames}
(SOURCE / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'npcs': {npc: {'bytes': data['bytes'], 'directions': data['uniqueIdleDirections']} for npc, data in report['npcs'].items()}}, indent=2))
