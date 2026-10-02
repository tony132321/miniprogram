from pathlib import Path
import json,hashlib,re,zipfile
from html.parser import HTMLParser
R=Path('/Users/tsb/Documents/小程序');T=Path('/private/tmp/caper-wave71-share-background');P=R/'miniprogram/subpackages/activity/share';B=T/'baseline/miniprogram/subpackages/activity/share';h=lambda b:hashlib.sha256(b).hexdigest();checks=[]
def check(name,value):
 assert value,name
 checks.append(name)
w=(P/'share.wxml').read_bytes();c=(P/'share.wxss').read_bytes();bw=(B/'share.wxml').read_bytes();bc=(B/'share.wxss').read_bytes();chunk=(T/'background.wxml').read_bytes();delta=(T/'background.wxss').read_bytes();
check('Only one new readonly chunk; inverse complete WXML equals Wave69 baseline',w.count(chunk)==1 and w.replace(chunk+b'\n',b'',1)==bw);
check('Full old _3 and Wave69 CSS prefix byte exact; appended inverse exact',c==bc+delta);
check('JS current QR migration baseline bytes unchanged',(P/'share.js').read_bytes()==(B/'share.js').read_bytes());
check('JSON baseline bytes unchanged',(P/'share.json').read_bytes()==(B/'share.json').read_bytes());
check('Precise READY and shareSheetOpen guard',b'wx:if="{{shareSheetOpen && loadState === \'READY\'}}"' in chunk);
check('New background has no action/button/canvas/nav attributes',not re.search(rb'<(?:button|canvas)\b|\b(?:bind\w*|catch\w*|open-type|data-id|data-section)=',chunk));
check('No invitation/source token, precise address, user identifiers, fake source roster',not re.search(rb'inviteToken|sourceToken|venueName|hostId|userId|avatar|registrationId|confirmedRoster',chunk));
check('Anonymity explicitly disclosed; a single generic symbol is not a per-person roster',chunk.count(b'class="share-background71-anonymous"')==1 and '未加载成员名单'.encode() in chunk and b'wx:for' not in chunk);
check('Only coarse city bound in background; no display.location',b'event.payload.city' in chunk and b'display.location' not in chunk);
check('Stats use confirmed/reserved/waitlisted/requested; no fake cancellation count',all(x in chunk for x in [b'display.confirmed',b'event.stats.reserved',b'event.stats.waitlisted',b'event.stats.requested']) and b'event.stats.cancelled' not in chunk);
check('Qualification uses real minimum/venue declaration and no fake countdown',b'display.minimum' in chunk and b"event.payload.venueStatus === 'HOST_CONFIRMED'" in chunk and '未经核实的开始倒计时'.encode() in chunk);
check('All new selector rules isolated; px literals and no new registered font',b'rpx' not in delta and b'@font-face' not in delta and b'Profile 500' not in delta and all(s.strip().startswith(b'.share-background71') for s in re.findall(rb'([^{}]+)\{',re.sub(rb'/\*.*?\*/',b'',delta,flags=re.S))));
check('Opaque inactive layer40 below unchanged foreground50; no background click target',b'z-index:40' in delta and b'background:#faf8fe' in delta and b'pointer-events:none' in delta and b'.sheet-reference69 { z-index:50;' in bc);
check('Real status/capsule bound; no source mock status/icons',b'{{statusBarHeight}}' in chunk and b'{{headerPaddingRight}}' in chunk and b'9:41' not in chunk and b'signal_cellular_alt' not in chunk);
check('Source negative-z art stacking preserved rather than inventing visible background photograph',b'z-index:-10' in delta and b'.share-background71-main' in delta and b'background:#faf8fe' in delta)
manifest=json.loads((T/'glyph-source-reuse.json').read_text());refs=set(re.findall(rb'src="\.\./event/assets/([^"]+)"',chunk));declared={Path(x['path']).name for x in manifest['glyphs']};
check('All 12 reused glyph roles consumed and declared exactly',refs=={x.encode() for x in declared});
check('Reused glyph byte hashes stable and source contour/paint proven',all(h((R/x['path']).read_bytes())==x['sha256'] and x['sameExactPathAndPaint'] for x in manifest['glyphs']));oldphoto=json.loads((R/'docs/design-sources/caper-share-sheet-wave69/source.json').read_text())['cover'];
check('Background badminton original asset reused byte exact; source URL same',h((R/oldphoto['path']).read_bytes())==oldphoto['sha256'] and oldphoto['url'] in (T/'original/code.html').read_text());
check('Illustration disclosed; other existing cover selection kept',b"display.cover === '/assets/stitch/caper_home_badminton.jpg' ? './assets/sheet69-badminton.jpg' : display.cover" in chunk and '原稿场景示意图'.encode() in chunk)
class Actions(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.nodes=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if any(k.startswith(('bind','catch')) or k=='open-type' for k in attrs):self.nodes.append((tag,attrs))
old=Actions();old.feed(bw.decode());new=Actions();new.feed(w.decode());
check('All real action/data/aria/disabled attributes unchanged',old.nodes==new.nodes)
base69=Path('/private/tmp/caper-ui69-immutable-rypwxq5y/miniprogram/subpackages/activity/share/share.js').read_bytes();
check('Root QR import is sole prior JS exception; reverse to immutable69 exact',(P/'share.js').read_bytes().replace(b"require('../vendor/qrcode.js')",b"require('../../../vendor/qrcode.js')")==base69)
with zipfile.ZipFile('/Users/tsb/Downloads/stitch_design_system_generator (2).zip') as z:
 check('Full original HTML/PNG bytes equal user ZIP',all((T/'original'/n).read_bytes()==z.read('stitch_design_system_generator/pg06_s/'+n) for n in ['code.html','screen.png']))
result={'kind':'One bounded source/assets/privacy/action/protection check; no business/SDK/CLI/full suite','passed':len(checks),'checks':checks,'originalActionNodes':len(old.nodes),'newActionNodes':len(new.nodes),'newBackgroundActionNodes':0,'productHashes':{n:{'bytes':len((P/n).read_bytes()),'sha256':h((P/n).read_bytes())} for n in ['share.wxml','share.wxss','share.js','share.json']},'protectedWXMLSHA256':h(bw),'protectedCSSSHA256':h(bc),'sourceHTMLSHA256':h((T/'original/code.html').read_bytes()),'sourcePNGSHA256':h((T/'original/screen.png').read_bytes()),'newAssets':0,'newMainBytes':0,'netActivityRawBytes':len(chunk)+1+len(delta),'glyphs':len(manifest['glyphs']),'glyphSourceComparison':'glyph-source-reuse.json; actual full outlines/paint including rclt filled substitutions prepared once','JSChange':False,'nativeLayeringPrivacyAndRenderingPending':True,'sourceCSSDoesNotProveChineseWrapOrCanvasOcclusion':True};(T/'targeted-source-binding-proof.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':len(checks),'actionsProtected':len(old.nodes),'newMainAssetsBytes':0,'netActivityRawBytes':result['netActivityRawBytes'],'products':result['productHashes']},indent=2))
