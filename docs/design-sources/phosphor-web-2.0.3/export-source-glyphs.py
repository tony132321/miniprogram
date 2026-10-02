"""Export the exact Phosphor web 2.0.3 glyphs used by caper_4's first components.

The archived TTF outlines remain unchanged; SVG only flips the font y axis into
the font's line box. Do not use this script to replace another icon family.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import base64
import hashlib
import io
import json
import re
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
PROOF = Path(__file__).resolve().parent
ASSETS = ROOT / 'miniprogram/pages/discover/assets'
ORIGINAL = Path('/private/tmp/irl-stitch-original/stitch_design_system_generator/caper_4/code.html')
REGISTRY = 'https://registry.npmjs.org/@phosphor-icons/web/2.0.3'
STYLE_FONTS = {'regular': 'Phosphor.ttf', 'bold': 'Phosphor-Bold.ttf', 'fill': 'Phosphor-Fill.ttf'}
GLYPHS = [
    ('magnifying-glass', 'bold', '#334155', 18, [112]),
    ('funnel-simple', 'bold', '#334155', 18, [115]),
    ('heart', 'bold', '#ffffff', 14, [148, 180, 210, 240]),
    ('compass', 'fill', '#60a5fa', 9, [148]),
    ('barbell', 'fill', '#c6ff00', 9, [180]),
    ('fork-knife', 'fill', '#fbbf24', 9, [210]),
    ('game-controller', 'fill', '#c084fc', 9, [240]),
    ('calendar-blank', 'regular', '#94a3b8', 10, [155, 187, 217, 247]),
    ('map-pin', 'regular', '#94a3b8', 10, [159, 191, 221, 251]),
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

PROOF.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)
if not (PROOF / 'registry-version.json').exists():
    metadata_bytes = urllib.request.urlopen(REGISTRY, timeout=30).read()
    metadata = json.loads(metadata_bytes)
    assert metadata['name'] == '@phosphor-icons/web' and metadata['version'] == '2.0.3'
    package_bytes = urllib.request.urlopen(metadata['dist']['tarball'], timeout=30).read()
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(package_bytes).digest()).decode()
    assert integrity == metadata['dist']['integrity']
    assert hashlib.sha1(package_bytes).hexdigest() == metadata['dist']['shasum']
    package = tarfile.open(fileobj=io.BytesIO(package_bytes), mode='r:gz')
    for style, filename in STYLE_FONTS.items():
        directory = PROOF / style
        directory.mkdir(exist_ok=True)
        for member in ['style.css', filename]:
            (directory / member).write_bytes(package.extractfile(f'package/src/{style}/{member}').read())
    (PROOF / 'package.json').write_bytes(package.extractfile('package/package.json').read())
    license_bytes = package.extractfile('package/LICENSE').read()
    (ROOT / 'docs/licenses/phosphor-web-2.0.3-MIT.txt').write_bytes(license_bytes)
    (PROOF / 'registry-version.json').write_bytes(metadata_bytes)
    (PROOF / 'package-integrity.json').write_text(json.dumps({
        'metadataUrl': REGISTRY, 'tarballUrl': metadata['dist']['tarball'],
        'packageVersion': '2.0.3', 'tarballSha256': sha(package_bytes),
        'integrity': integrity, 'sha1': hashlib.sha1(package_bytes).hexdigest(),
        'verifiedAgainstRegistryDist': True,
    }, indent=2) + '\n')

original_bytes = ORIGINAL.read_bytes()
sources = {'package': '@phosphor-icons/web', 'packageVersion': '2.0.3',
    'repository': 'https://github.com/phosphor-icons/web', 'metadataUrl': REGISTRY,
    'originalHtml': 'caper_4/code.html', 'originalHtmlSha256': sha(original_bytes),
    'originalFontDeclarationLine': 38,
    'license': 'MIT', 'licenseFile': 'docs/licenses/phosphor-web-2.0.3-MIT.txt',
    'licenseSha256': sha((ROOT / 'docs/licenses/phosphor-web-2.0.3-MIT.txt').read_bytes()),
    'fonts': {}, 'assets': {}}
for style, filename in STYLE_FONTS.items():
    font = TTFont(PROOF / style / filename)
    names = {}
    for name_id in [1, 2, 3, 4, 5, 6]:
        names[str(name_id)] = sorted({record.toUnicode() for record in font['name'].names if record.nameID == name_id})
    sources['fonts'][style] = {'fontFile': f'{style}/{filename}',
        'fontSourceUrl': f'https://unpkg.com/@phosphor-icons/web@2.0.3/src/{style}/{filename}',
        'fontSha256': sha((PROOF / style / filename).read_bytes()),
        'cssFile': f'{style}/style.css',
        'cssSourceUrl': f'https://unpkg.com/@phosphor-icons/web@2.0.3/src/{style}/style.css',
        'cssSha256': sha((PROOF / style / 'style.css').read_bytes()), 'fontNames': names,
        'unitsPerEm': font['head'].unitsPerEm,
        'hheaAscent': font['hhea'].ascent, 'hheaDescent': font['hhea'].descent,
        'sTypoAscender': font['OS/2'].sTypoAscender, 'sTypoDescender': font['OS/2'].sTypoDescender}

for symbol, style, color, pixel_size, source_lines in GLYPHS:
    css = (PROOF / style / 'style.css').read_text()
    match = re.search(r'\.ph-' + re.escape(symbol) + r':before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";\s*\}', css)
    assert match, (style, symbol)
    codepoint = int(match.group(1), 16)
    font = TTFont(PROOF / style / STYLE_FONTS[style])
    glyph_name = font.getBestCmap()[codepoint]
    glyph_set = font.getGlyphSet()
    pen = SVGPathPen(glyph_set)
    em = font['head'].unitsPerEm
    ascent = font['hhea'].ascent
    glyph_set[glyph_name].draw(TransformPen(pen, (1, 0, 0, -1, 0, ascent)))
    path = pen.getCommands()
    filename = f'ph-{symbol}-{style}.svg'
    asset_bytes = f'<svg xmlns="http://www.w3.org/2000/svg" width="{pixel_size}" height="{pixel_size}" viewBox="0 0 {em} {em}"><path fill="{color}" d="{path}"/></svg>\n'.encode()
    (ASSETS / filename).write_bytes(asset_bytes)
    sources['assets'][filename] = {'symbol': symbol, 'style': style, 'sourceCssClass': 'ph' if style == 'regular' else f'ph-{style}',
        'sourceLines': source_lines, 'color': color, 'sourceCssPixelSize': pixel_size,
        'unicode': f'U+{codepoint:04X}', 'cssUnicodeLiteral': '\\' + match.group(1),
        'cssDefinitionLine': css[:match.start()].count('\n') + 1,
        'glyphName': glyph_name, 'advanceWidth': font['hmtx'][glyph_name][0],
        'assetSha256': sha(asset_bytes), 'svgPathSha256': sha(path.encode()),
        'viewBox': [0, 0, em, em], 'coordinateTransform': [1, 0, 0, -1, 0, ascent],
        'export': 'Unmodified official glyph outline; only font line-box y-axis conversion and explicit original CSS color.'}
(PROOF / 'source.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')
(ASSETS / 'phosphor-sources.json').write_text(json.dumps({
    'package': '@phosphor-icons/web', 'version': '2.0.3',
    'proof': 'docs/design-sources/phosphor-web-2.0.3/source.json',
    'originalHtmlSha256': sources['originalHtmlSha256'], 'assets': sources['assets']
}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'fontStyles': list(STYLE_FONTS), 'glyphCount': len(GLYPHS), 'assets': list(sources['assets'])}))
