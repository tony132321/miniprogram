from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
from hashlib import sha256
import difflib,json,re,zipfile,xml.etree.ElementTree as ET
R=Path('/Users/tsb/Documents/小程序'); T=Path('/private/tmp/caper-wave72-profile-long'); D=R/'docs/design-sources/caper-profile-long-page-wave72'
h=lambda x:sha256(x).hexdigest()
meta=lambda p:{'path':str(p),'bytes':p.stat().st_size,'sha256':h(p.read_bytes())}
old=(T/'baseline/miniprogram/pages/me/me.wxml').read_text(); new=(R/'miniprogram/pages/me/me.wxml').read_text(); oldcss=(T/'baseline/miniprogram/pages/me/me.wxss').read_bytes();newcss=(R/'miniprogram/pages/me/me.wxss').read_bytes()
checks=[]
def check(name, condition, detail=None):
 checks.append({'name':name,'pass':bool(condition),'detail':detail}); assert condition,name
for ext in ['js','json']:
 a=T/'baseline/miniprogram/pages/me'/('me.'+ext); b=R/'miniprogram/pages/me'/('me.'+ext);check(ext+' unchanged bytes',a.read_bytes()==b.read_bytes(),meta(b))
check('whole original CSS byte prefix',newcss.startswith(oldcss),{'oldBytes':len(oldcss),'oldSHA':h(oldcss),'newSHA':h(newcss)})
append=newcss[len(oldcss):].decode(); check('new scope only / no new rpx or font face', 'rpx' not in append and '@font-face' not in append and all('.me-long-' in sel for sel,_ in re.findall(r'([^{}]+)\{([^{}]*)\}',re.sub(r'/\*.*?\*/','',append,flags=re.S))))
oldcore=old[:old.index('  <view class="section-head"><text class="section-mark"></text><text>我的收藏与想去')]
check('core and legal-consent whole byte prefix',new.startswith(oldcore),{'bytes':len(oldcore.encode()),'sha256':h(oldcore.encode())})
a='  <button class="advanced-toggle'; b='  <view class="section-head"><text class="section-mark"></text><text>帮助与反馈'
oldadvanced=old[old.index(a):old.index(b)];newadvanced=new[new.index(a):new.index('  <view class="me-long-reference me-long-public-menus">')]
check('whole toggle / advanced / outer-close bytes',oldadvanced==newadvanced,{'bytes':len(oldadvanced.encode()),'sha256':h(oldadvanced.encode())})
class Parse(HTMLParser):
 def __init__(self,s):super().__init__(convert_charrefs=True);self.stack=[];self.actions=[];self.nodes=[];self.feed(s);assert not self.stack,self.stack
 def handle_starttag(self,tag,attrs):
  d=dict(attrs); rec={'tag':tag,'attrs':d,'ancestors':[x[1] for x in self.stack]};self.nodes.append(rec)
  if any(k.startswith(('bind','catch')) for k in d):
   action={k:v for k,v in d.items() if k.startswith(('bind','catch','data-','wx:')) or k in ('id','value','checked','disabled','aria-label','type')}
   guards=[{k:v for k,v in a.items() if k.startswith('wx:')} for _,a in self.stack if any(k.startswith('wx:') for k in a)]
   self.actions.append({'tag':tag,'attributes':action,'ancestorGuards':guards})
  if tag not in ('input','img','meta','br','hr','link'):self.stack.append((tag,d))
 def handle_startendtag(self,tag,attrs):
  self.handle_starttag(tag,attrs)
  if tag not in ('input','img','meta','br','hr','link'):self.handle_endtag(tag)
 def handle_endtag(self,tag):
  if tag in ('input','img','meta','br','hr','link'):return
  assert self.stack and self.stack[-1][0]==tag,(tag,self.stack[-3:]);self.stack.pop()
pold=Parse(old);pnew=Parse(new)
canon=lambda x:json.dumps(x,sort_keys=True,ensure_ascii=False)
check('all real actions attrs / effective wx ancestor guards unchanged',Counter(map(canon,pold.actions))==Counter(map(canon,pnew.actions)),{'before':len(pold.actions),'after':len(pnew.actions)})
js=(R/'miniprogram/pages/me/me.js').read_text();handlers=sorted({v for n in pnew.actions for k,v in n['attributes'].items() if k.startswith(('bind','catch'))})
check('every bound handler remains in unchanged actual JS',all(re.search(r'\b'+re.escape(x)+r'\s*\(',js) for x in handlers),handlers)
check('advanced subtree not inside new long selectors',not any('.me-long-' in str(n['ancestors']) for n in pnew.nodes if n['attrs'].get('id') in ('privacySection','reportSection','exportDataButton','noticeSection')))
# Exact edit operations produce a whole-file inverse, including relocated single manual request action.
ops=[];recovered=[]
for op,i,j,x,y in difflib.SequenceMatcher(None,old.splitlines(keepends=True),new.splitlines(keepends=True),autojunk=False).get_opcodes():
 a=''.join(old.splitlines(keepends=True)[i:j]);b=''.join(new.splitlines(keepends=True)[x:y]);recovered.append(b if op=='equal' else a)
 if op!='equal':ops.append({'operation':op,'oldLines':[i+1,j],'newLines':[x+1,y],'old':a,'new':b})
check('whole WXML inverse exact', ''.join(recovered)==old,{'oldSHA':h(old.encode()),'newSHA':h(new.encode()),'edits':len(ops)})
(D/'wxml-inverse-edits.json').write_text(json.dumps(ops,ensure_ascii=False,indent=2)+'\n');(D/'append-only.wxss').write_text(append)
# Source bytes are supplied ZIP bytes, not a recreated HTML document.
sourceRoot=Path('/private/tmp/irl-stitch-original/stitch_design_system_generator');zipPath=Path('/Users/tsb/Downloads/stitch_design_system_generator (2).zip');sources=[]
with zipfile.ZipFile(zipPath) as z:
 for ext in ['code.html','screen.png']:
  entry=next(x for x in z.namelist() if x.endswith('/caper_1/'+ext));p=sourceRoot/'caper_1'/ext;check('original '+ext+' ZIP equal',z.read(entry)==p.read_bytes());sources.append({**meta(p),'zipEntry':entry})
source=(D/'caper_1-code.html').read_text();check('docs source HTML equals original',source.encode()==(sourceRoot/'caper_1/code.html').read_bytes())
# Every source long-page chevron has this same exact child geometry; source SVG uses lowercase viewbox.
svgs=list(re.finditer(r'<svg\b.*?</svg>',source,flags=re.S));long=[]
for idx,match in enumerate(svgs):
 s=match.group(); line=source[:match.start()].count('\n')+1
 if 438<=line<=711:
  e=ET.fromstring(s.replace('viewbox=','viewBox='));long.append({'index':idx,'line':line,'child':ET.tostring(e[0],encoding='unicode'),'attrs':e[0].attrib})
geometry={'d':'M9 5l7 7-7 7','stroke-linecap':'round','stroke-linejoin':'round','stroke-width':'2'}
check('all original long chevron child attrs exact',len(long)==15 and all(x['attrs']==geometry for x in long),len(long))
assets=[]
for name,color in [('chevron-blue.svg','#1d64f2'),('chevron-muted.svg','#94a3b8')]:
 p=R/'miniprogram/pages/me/assets'/name;e=ET.fromstring(p.read_bytes());check(name+' exact source geometry / stroke / viewport',e[0].attrib==geometry and e.attrib['stroke']==color and e.attrib['viewBox']=='0 0 24 24' and e.attrib['width']==e.attrib['height']=='14');assets.append({**meta(p),'paint':color,'childAttrs':e[0].attrib})
check('new local resources only reuse chevrons',set(re.findall(r'(?:src|url)=[\"\']([^\"\']+)',new)) - set(re.findall(r'(?:src|url)=[\"\']([^\"\']+)',old)) <= {'./assets/chevron-blue.svg','./assets/chevron-muted.svg'})
# Actual source/effective CSS observation is not a native render or business assertion.
obs=json.loads((T/'source-cascade-observation.json').read_text());paint=[]
zero='rgba(0, 0, 0, 0) 0px 0px 0px 0px, '
for d in obs['differences']:
 check('CSS difference paint-equivalent '+d['name'],d['property']=='boxShadow' and d['source'].replace(zero,'')==d['product'],d);paint.append(d)
check('CSS font family same source in sampled long roles',all(o['source']['values']['fontFamily']==o['product']['values']['fontFamily'] for o in obs['observations']),{'sampleRoles':len(obs['observations'])})
sourceCSS='\n'.join(p.read_text() for p in sorted(T.glob('caper_1-style-*.css')))
check('source official hover / active tokens',all(x in sourceCSS for x in ['.hover\\:border-blue-200:hover','.active\\:scale-95:active','.active\\:scale-\\[0\\.99\\]:active']),['tool border-blue-200','invite scale95','logout scale.99'])
# The source uses sibling margins; flex gaps have the same space without changing child margins.
spacings=[o for o in obs['observations'] if o['name'] in ['account row gap','help row gap']]
check('source sibling spaces adapt to product flex gap',all(o['source']['values']['marginTop']==o['product']['values']['gap'] for o in spacings),spacings)
(D/'glyph-source-reuse.json').write_text(json.dumps({'sourceChevronNodes':long,'assets':assets,'newAssetsBytes':0},ensure_ascii=False,indent=2)+'\n')
(D/'source-cascade-observation.json').write_text(json.dumps(obs,ensure_ascii=False,indent=2)+'\n')
for p in T.glob('caper_1-style-*.css'): (D/p.name).write_bytes(p.read_bytes())
manifest={'scope':'Wave72 ordinary profile long page source restoration only','originalZIP':meta(zipPath),'originalSources':sources,'baseline':[meta(T/'baseline/miniprogram/pages/me'/('me.'+x)) for x in ['wxml','wxss','js','json']],'product':[meta(R/'miniprogram/pages/me'/('me.'+x)) for x in ['wxml','wxss','js','json']],'newSourceFields':{'server':'src/server.ts:403-441','projection':'me.js:419-421 spreads existing authorized /me/events row','hostedPreview':'me.js:461 uses first mappedActivityItems item with isHost','cityAndVenue':'Only render when actually returned; no manufactured location or counts','photo':'Existing activityCover illustration; explicitly marked 场景示意图','manualRequest':'One existing showPrivacyRequests relocated; exact original authenticated/access guard; opens unchanged advanced privacySection. No new delete handler.'},'differencesFromMock':{'wishlist':'Closed state preserves actual goInviteEntry. No source sample image/count/heart action created. Source card colors/radius/padding/text metrics adapted to honest closed card.','hostStatus':'Only actual IN_PROGRESS uses original emerald source pill; other actual labels use source slate neutral palette.','hostMembers':'No API participant count/avatar field; original 16px fake avatars/+8 replaced by truthful illustration/real-detail note in original9px note role.','account':'Source phone/device/real-name values omitted. Two existing real profile/block actions remain, original manual request moved to source Danger panel under same guard.','notification':'Two actual actions/notification readback, no source fake checked OS/push switches. Existing consent region unchanged.','help':'Two existing actions and actual explanatory copy, rather than inventing source FAQ/feedback/contact endpoints.','about':'Existing three routes/copy, no hardcoded v1.2.0.','danger':'Manual request copy is truthful about review rather than irreversible deletion; logout actual guards unchanged.','foot':'Existing REAL PEOPLE · REAL MEETUPS string preserved; source font/spacing restored.'},'nativeBoundary':'Original 390px/p16 viewport uses existing native100% width and native status/capsule/safe/tab contracts, untouched in this batch. CSS-only observation is not native geometry / glyph drawing / line wrap / business SDK.'}
(D/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
proof={'checks':checks,'passed':len(checks),'failures':0,'actions':pnew.actions,'cssObservation':{'roles':len(obs['observations']),'properties':208,'drawingEquivalentDifferences':paint},'proofLimit':'No full suite / VM / WeChat CLI / SDK / CUA / screenshots / actual glyph paint or API runtime. Browser only resolves supplied source and existing/new CSS, resources blocked.','projectionErrors':['First browser projection timed out at help because self-closing WXML textarea is HTML raw-text; normalization still hit attribute >. Fixed private projection to isolate only the two new long scopes; no product was changed for either harness error.']}
(D/'targeted-source-protection-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');(D/'targeted-source-check.py').write_bytes(Path(__file__).read_bytes());(D/'source-cascade.js').write_bytes((T/'source-cascade.js').read_bytes())
print(json.dumps({'passed':len(checks),'actions':len(pnew.actions),'handlers':len(handlers),'wxmlSHA':h(new.encode()),'wxssSHA':h(newcss),'netProductBytes':len(new.encode())-len(old.encode())+len(newcss)-len(oldcss),'newAssetsBytes':0},ensure_ascii=False,indent=2))
