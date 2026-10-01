"""Read WOFF2 with existing FontTools and Node's builtin Brotli; no install."""
import subprocess
import sys
import types

NODE = '/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
FONTTOOLS = '/private/tmp/irl-material-symbols-wave60/fonttools'
NODE_SCRIPT = "const z=require('zlib');let a=[];process.stdin.on('data',c=>a.push(c));process.stdin.on('end',()=>process.stdout.write(z.brotliDecompressSync(Buffer.concat(a))));"

def enable():
    module = types.ModuleType('brotli')
    def decompress(data):
        return subprocess.run([NODE, '-e', NODE_SCRIPT], input=data,
                              stdout=subprocess.PIPE, check=True).stdout
    module.decompress = decompress
    sys.modules['brotli'] = module
    sys.path.insert(0, FONTTOOLS)

enable()

if __name__ == '__main__':
    from fontTools.ttLib import TTFont
    font = TTFont(sys.argv[1])
    print([(a.axisTag, a.minValue, a.defaultValue, a.maxValue)
           for a in font['fvar'].axes] if 'fvar' in font else [])
    if len(sys.argv) > 2:
        font.flavor = None
        font.save(sys.argv[2])
