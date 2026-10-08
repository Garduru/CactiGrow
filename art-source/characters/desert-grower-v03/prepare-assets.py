"""V2.1 presentation exports. Immutable V02 body/pigment pixels are reused.

python art-source/characters/desert-grower-v03/prepare-assets.py
Derives attachment points and alpha layer splits; it never synthesizes poses.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import statistics
import sys

sys.dont_write_bytecode = True

FOLDER = Path(__file__).resolve().parent
ROOT = FOLDER.parents[2]
sys.path.insert(0, str(ROOT / '.wrangler/art-python'))
from PIL import Image, ImageChops, ImageFilter

spec = importlib.util.spec_from_file_location('v02_export', FOLDER.parent / 'desert-grower-v02/prepare-assets.py')
v02 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v02)
OLD = json.loads((FOLDER.parent / 'desert-grower-v02/export-report.json').read_text())
DEST = ROOT / 'public/assets/characters'
DIRECTIONS = ['south', 'west', 'east', 'north']
# Pupil centres visually confirmed against the unchanged source pixels.
# Only south has two visible eyes; profile-facing coverage is reviewed on the
# directional contact sheets rather than inventing an unseen second eye.
SOUTH_EYES = {'masculine': [[[60,42],[76,42]], [[59,42],[75,42]], [[61,42],[77,43]], [[65,43],[81,43]], [[63,43],[79,43]]],
              'feminine': [[[63,42],[80,43]], [[67,44],[84,45]], [[62,43],[80,44]], [[62,43],[79,44]], [[58,44],[74,44]]]}


def output(image, relative):
    path = DEST / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, **({'lossless': True, 'method': 6} if path.suffix == '.webp' else {'optimize': True}))
    return {'url': '/assets/characters/' + relative, 'size': list(image.size), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def span(plane, top, bottom, fallback):
    bounds = plane.crop((0, top, 128, bottom)).getbbox()
    return (bounds[0], bounds[2]) if bounds else fallback


def connected_art(image):
    """Remove detached cell fragments while retaining antialiased main art."""
    width, height = image.size
    alpha = list(image.getchannel('A').get_flattened_data())
    seen, largest = set(), set()
    for start, value in enumerate(alpha):
        if value < 8 or start in seen: continue
        pending, component = [start], set([start]); seen.add(start)
        while pending:
            point = pending.pop(); x, y = point % width, point // width
            for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                neighbor = yy*width+xx
                if 0 <= xx < width and 0 <= yy < height and alpha[neighbor] >= 8 and neighbor not in seen:
                    seen.add(neighbor); component.add(neighbor); pending.append(neighbor)
        if len(component) > len(largest): largest = component
    matte = Image.new('L', image.size); matte.putdata([255 if point in largest else 0 for point in range(width*height)])
    matte = matte.filter(ImageFilter.MaxFilter(3))
    result = image.copy(); result.putalpha(ImageChops.multiply(image.getchannel('A'), matte))
    return result


def body_fits(name):
    body = Image.open(DEST / f'player/{name}/desert-grower-{name}-poses-v02.webp').convert('RGBA')
    pigments = Image.open(DEST / f'player/{name}/desert-grower-{name}-pigments-v02.png').convert('RGBA')
    arms = Image.new('RGBA', body.size)
    frames = []
    for index, old in enumerate(OLD['bodies'][name]['frames']):
        row, column = divmod(index, 5)
        box = (column*128, row*224, (column+1)*128, (row+1)*224)
        pose, mask = body.crop(box), pigments.crop(box)
        skin, shirt, pants = (mask.getchannel(channel) for channel in ('R', 'G', 'B'))
        head_x, crown = old['head']
        pelvis_left, pelvis_right = span(pants, 116, 128, (head_x-20, head_x+20))
        pelvis_x = (pelvis_left+pelvis_right)/2
        half_hip = (pelvis_right-pelvis_left)/2
        # Sleeve extrema are not shoulder joints. The joint sits over the
        # posed pelvis, inset from the outer sleeve; profile depth is narrower.
        shoulder_half = half_hip * (.74 if row in (0, 3) else .48)
        shoulder_y = old['torso'][1]+12
        shoulder_x = (old['torso'][0]+pelvis_x)/2
        # Find the contiguous central trouser waist, excluding hand highlights.
        waist_rows = [y for y in range(102, 124) if sum(pants.getpixel((x,y))>0 for x in range(round(pelvis_x-8), round(pelvis_x+8))) >= 12]
        waist_y = min(waist_rows)+3 if waist_rows else (114 if name == 'masculine' else 112)
        hip_y = waist_y+24
        skull_l, skull_r = span(skin, crown+7, crown+24, (head_x-21, head_x+21))
        skull_width = skull_r-skull_l
        head_scale = max(.86, min(1.04, old['headWidth']/(52 if row in (0, 3) else 47)))
        matte = Image.new('L', (128, 224))
        values = []
        for y in range(224):
            for x in range(128):
                rgba = pose.getpixel((x, y))
                near_side = row in (0, 3) or (row == 1 and x > pelvis_x) or (row == 2 and x < pelvis_x)
                # Skin components follow the posed forearm/hand even when a
                # walk pose swings it across the hip or centreline.
                is_hand = y >= 84 and skin.getpixel((x, y))
                is_sleeve = 72 <= y <= 107 and shirt.getpixel((x, y)) and abs(x-shoulder_x) > max(10, half_hip*.78)
                values.append(rgba[3] if is_hand or (near_side and is_sleeve) else 0)
        matte.putdata(values)
        # Soften only the derived occlusion seam, retaining source arm RGB.
        matte = matte.filter(ImageFilter.GaussianBlur(.55))
        arm = Image.new('RGBA', pose.size, (255, 255, 255, 0)); arm.putalpha(matte)
        arms.alpha_composite(arm, (column*128, row*224))
        frames.append({'crown': [head_x, crown], 'skullWidth': skull_width,
                       'faceOpening': [head_x, crown+26], 'protectedEyes': SOUTH_EYES[name][column] if row == 0 else [],
                       'headScale': round(head_scale, 4),
                       'shoulders': [[round(shoulder_x-shoulder_half, 2), shoulder_y],
                                     [round(shoulder_x+shoulder_half, 2), shoulder_y]],
                       'waist': [pelvis_x, waist_y],
                       'hips': [[pelvis_left+3, hip_y], [pelvis_right-3, hip_y]],
                       'alphaBounds': old['alphaBounds'], 'armAlphaPixels': sum(value>=32 for value in values)})
    return {'frames': frames, 'armMask': output(arms, f'player/{name}/desert-grower-{name}-foreground-arms-v03.png'),
            'bodySource': f'player/{name}/desert-grower-{name}-poses-v02.webp',
            'pigmentSource': f'player/{name}/desert-grower-{name}-pigments-v02.png'}


def hair_layers(name):
    original = Image.open(DEST / f'shared/desert-hair-{dict(cropped="cropped",tied="tied-back",wavy="wavy-crop",braid="long-braid")[name]}-v02.webp').convert('RGBA')
    front, back = Image.new('RGBA', original.size), Image.new('RGBA', original.size)
    anchors = []
    for row in range(4):
        pose = connected_art(original.crop((0,row*128,96,(row+1)*128)))
        crown = pose.getchannel('A').point(lambda value:255 if value>=32 else 0).crop((0,8,96,26)).getbbox()
        anchors.append([round((crown[0]+crown[2])/2,2), OLD['cosmetics'][name]['frames'][row]['anchor'][1]])
        for y in range(128):
            for x in range(96):
                # The long south braid is a front shoulder detail. Ponytail
                # and profile nape lie behind the neck/body. North hair is
                # seen over the back, including the long braid.
                rear = row != 3 and y >= (51 if name != 'cropped' else 45) and (
                    (row == 0 and name in ('tied', 'wavy')) or
                    (row == 1 and x >= 48) or (row == 2 and x <= 48))
                (back if rear else front).putpixel((x, row*128+y), pose.getpixel((x,y)))
    return {'front': output(front, f'shared/desert-hair-{name}-front-v03.webp'),
            'back': output(back, f'shared/desert-hair-{name}-back-v03.webp'),
            'anchors': anchors,
            'reference': OLD['cosmetics'][name]['reference']}


def satchel_layers():
    original = Image.open(DEST / 'shared/desert-field-satchel-v02.webp').convert('RGBA')
    bag, front, back = (Image.new('RGBA', original.size) for _ in range(3))
    points = []
    # Direction-specific source strap endpoints and pouch rectangles are
    # authored against the actual raster, never against screen coordinates.
    regions = [(31, 61, 80, 105), (26, 63, 72, 105), (23, 62, 73, 105), (16, 61, 78, 105)]
    roots = [(27, 12), (36, 12), (57, 12), (66, 12)]
    hooks = [(72, 64), (57, 65), (37, 65), (25, 64)]
    for row, region in enumerate(regions):
        pose = original.crop((0, row*128, 96, (row+1)*128))
        # Front/right pouch becomes rear/left when the grower turns north.
        if row == 3: pose = pose.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        left, top, right, bottom = region
        for y in range(128):
            for x in range(96):
                pixel = pose.getpixel((x, y))
                if top <= y < bottom: layer = bag
                elif (row in (0, 3) and ((x < 40) if row == 0 else (x > 56))) or (row == 1 and x < 40) or (row == 2 and x > 56): layer = back
                else: layer = front
                # Rear loop art is only meaningful above the pouch hook.
                # Lower disconnected strap ends would hang beside the wrist.
                if layer is back and y > 58: pixel = (0,0,0,0)
                layer.putpixel((x, row*128+y), pixel)
        points.append({'root': list(roots[row]), 'hook': list(hooks[row]),
                       'bagCenter': [(left+right)/2, (top+bottom)/2], 'bagBounds': list(region)})
    return {'bag': output(bag, 'shared/desert-satchel-pouch-v03.webp'),
            'front': output(front, 'shared/desert-satchel-front-strap-v03.webp'),
            'back': output(back, 'shared/desert-satchel-rear-loop-v03.webp'), 'frames': points}


def main():
    source = Image.open(FOLDER / 'desert-mara-poses-master-v03.png').convert('RGBA')
    alpha = source.getchannel('A')
    if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] < 240: raise ValueError('Mara source must contain real transparency and solid artwork')
    # Reuse only the established deterministic crop/registration algorithm.
    v02.SOURCE_FOLDER = FOLDER
    v02.CONFIG = {**v02.CONFIG, 'bodies': [{'module':'mara','source':'desert-mara-poses-master-v03.png',
                  'sourceDirections':['south','east','west','north'],'output':'npc/mara/desert-mara-poses-v03.webp'}]}
    mara = v02.export_bodies()['mara']
    mara_image = Image.open(DEST / 'npc/mara/desert-mara-poses-v03.webp').convert('RGBA')
    unique = {hashlib.sha256(mara_image.crop((column*128,row*224,(column+1)*128,(row+1)*224)).tobytes()).hexdigest()
              for row in range(4) for column in range(5)}
    if len(unique) != 20: raise ValueError('Mara must retain twenty unique authored poses')
    registration = {'version':'character-system-v03-fit','directions':DIRECTIONS,
                    'bodies':{name:body_fits(name) for name in ('masculine','feminine')},
                    'hair':{name:hair_layers(name) for name in ('cropped','tied','wavy','braid')},
                    'satchel':satchel_layers(), 'mara':{**mara,'sourceAlphaExtrema':list(alpha.getextrema()),'uniquePoses':len(unique),
                      'url':'/assets/characters/npc/mara/desert-mara-poses-v03.webp'},
                    'hats':{name:output(Image.open(DEST/f'shared/desert-hat-{name}-v02.webp').convert('RGBA'),f'shared/desert-hat-{name}-v03.webp') for name in ('straw','cap')}}
    (FOLDER / 'export-report.json').write_text(json.dumps(registration, indent=2)+'\n')
    (ROOT / 'src/characters/characterFit.generated.ts').write_text('// Generated by desert-grower-v03/prepare-assets.py; do not edit manually.\nexport const CHARACTER_FIT = '+json.dumps(registration,separators=(',',':'))+' as const\n')
    print(json.dumps({'version':registration['version'],'MaraAlpha':list(alpha.getextrema()),'MaraPoses':len(unique),'MaraBytes':mara['bytes']},indent=2))


if __name__ == '__main__': main()
