from pathlib import Path
from html.parser import HTMLParser
import json,hashlib,re,xml.etree.ElementTree as ET
R=Path('/Users/tsb/Documents/小程序');T=Path('/private/tmp/caper-wave70-home');P=R/'miniprogram/pages/index';B=T/'baseline';checks=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
def check(name,value,detail=None):
 checks.append({'name':name,'passed':bool(value),'detail':detail});assert value,name
w=(P/'index.wxml').read_text();old=(B/'index.wxml').read_text();css=(P/'index.wxss').read_bytes();oldcss=(B/'index.wxss').read_bytes()
for n in ['index.js','index.json']:check(n+' exact baseline bytes',(P/n).read_bytes()==(B/n).read_bytes(),sha((P/n).read_bytes()))
edits=json.loads((T/'wxml-inverse-edits.json').read_text());rev=w
for i,e in enumerate(reversed(edits)):
 check('inverse edit uniquely present '+str(len(edits)-i),rev.count(e['new'])==1);rev=rev.replace(e['new'],e['old'],1)
check('full WXML inverse baseline equality',rev==old,sha(rev.encode()))
check('full original CSS byte prefix',css.startswith(oldcss),{'bytes':len(oldcss),'sha256':sha(oldcss)})
append=css[len(oldcss):].decode();check('only owned CSS append',append==(T/'reference-state.wxss').read_text())
check('new source dimensions use px and existing font only','rpx' not in append and 'Caper Jakarta Profile 500' not in append)
clean=re.sub(r'/\*.*?\*/','',append,flags=re.S);selectors=[m[0].strip() for m in re.findall(r'([^{}]+)\{([^{}]*)\}',clean)]
check('every added CSS selector isolated',all(all(x.strip().startswith(('.home-state-reference ','.home-state-pending ','.home-state-organized ','.home-state-history ','.home-page.home-state-reference')) for x in sel.split(',')) for sel in selectors),{'rules':len(selectors)})
class Bindings(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.stack=[];self.binds=[];self.tags=[]
 def add(self,tag,attrs,push):
  d=dict(attrs);guard={k:v for k,v in attrs if k in ['wx:if','wx:elif','wx:else','wx:for','wx:for-item','wx:for-index','wx:key']}
  ancestry=[x[1] for x in self.stack if x[1]]
  if any(k.startswith(('bind','catch')) for k in d):
   self.binds.append({'tag':tag,'attrs':{k:v for k,v in attrs if k.startswith(('bind','catch','data-')) or k in ['aria-label','maxlength','value','confirm-type']},'ownGuard':guard,'ancestors':ancestry})
  self.tags.append((tag,d))
  if push:self.stack.append((tag,guard))
 def handle_starttag(self,tag,attrs):self.add(tag,attrs,True)
 def handle_startendtag(self,tag,attrs):self.add(tag,attrs,False)
 def handle_endtag(self,tag):
  assert self.stack and self.stack[-1][0]==tag,(tag,self.stack[-3:]);self.stack.pop()
a=Bindings();a.feed(old);b=Bindings();b.feed(w)
check('WXML balanced tags',not a.stack and not b.stack)
check('all actual actions data aria and guard ancestry exact',a.binds==b.binds,{'before':len(a.binds),'after':len(b.binds)})
js=(P/'index.js').read_text();handlers=sorted(set(v for row in b.binds for k,v in row['attrs'].items() if k.startswith(('bind','catch'))))
check('every unchanged handler exists',all(re.search(r'\b'+re.escape(n)+r'\s*\(',js) for n in handlers),handlers)
start=old.index('    <view wx:if="{{!stateView}}" class="caper-top">');end=old.index('    <button wx:if="{{stateView}}" class="state-ai-banner')
check('ordinary Wave64 and long first region exact source substring',old[start:end] in w)
last=old.index('    <view wx:if="{{!stateView}}">\n    <view class="section-heading discover-heading"')
check('ordinary lower feed exact source substring',w.endswith(old[last:]))
check('native status capsule data attributes retained','style="top: {{statusBarHeight}}px; padding-right: {{headerPaddingRight}}"' in w and w.count('style="height: {{statusBarHeight}}px"')==2)
oldassets=Path('/private/tmp/caper-ui69-immutable-rypwxq5y/miniprogram/pages/index/assets');oldassetrows=[]
for p in sorted(oldassets.iterdir()):
 q=P/'assets'/p.name;check('old asset unchanged '+p.name,q.read_bytes()==p.read_bytes());oldassetrows.append({'path':str(q.relative_to(R)),'sha256':sha(q.read_bytes())})
assets=json.loads((T/'runtime-asset-paths.json').read_text());gm=json.loads((T/'glyph-manifest.json').read_text());glyphs={e['asset']:e for e in gm['exports']};photos=json.loads((T/'photo-manifest.json').read_text());assetrows=[]
refs=set(re.findall(r'w70-[\w.-]+\.(?:svg|jpg)',w));check('new runtime assets exactly actual referenced paths',refs=={Path(x).name for x in assets})
for rel in assets:
 p=R/rel;raw=p.read_bytes();row={'path':rel,'bytes':len(raw),'sha256':sha(raw)}
 if p.suffix=='.svg':
  m=glyphs[p.name];root=ET.fromstring(raw);path=next(root.iter('{http://www.w3.org/2000/svg}path'))
  check('exact source glyph and paint '+p.name,sha(raw)==m['sha256'] and root.attrib.get('viewBox')=='0 -960 960 960' and root.attrib.get('fill')==m['fill'] and path.attrib.get('d')==m['path'])
  row['sourceGlyph']=m['glyph'];row['renderedGlyph']=m['renderedGlyph'];row['axes']=m['axes']
 else:
  m=next(x for x in photos if 'w70-'+x['name']+'.jpg'==p.name);check('source photo unchanged binary '+p.name,sha(raw)==m['sha256'] and len(raw)==m['bytes']);row['sourcePage']=m['page'];row['sourceURL']=m['url'];row['semantic']='Explicit activity-type illustration, not real participant or event photography'
 assetrows.append(row)
check('full Material source proof hash current',sha((R/gm['sourceWOFF2']).read_bytes())==gm['sourceWOFF2SHA256'])
check('source filled glyphs apply rclt',all(x['renderedGlyph']==x['glyph']+'.fill' and x['activeSubstitution'] for x in gm['exports'] if x['axes']['FILL']))
added='\n'.join(e['new'] for e in edits)
check('no static fake people score rank money push claims',not any(x in added for x in ['Alex','Luna','5.0','#1','4 小时','已清算','自动推送','晴天适宜']))
check('actual counts and IDs still bound',all(x in w for x in ['{{attending.length}}','{{pending.length}}','{{organized.length}}','{{cohosting.length}}','{{history.length}}','data-id="{{item.id}}"','{{item.hostCounts.confirmed}}','{{item.hostCounts.reserved}}','{{item.hostCounts.requested}}','{{item.hostCounts.gap}}','{{item.capacityLabel}}']))
products=[{'path':str((P/n).relative_to(R)),'bytes':(P/n).stat().st_size,'sha256':sha((P/n).read_bytes())} for n in ['index.wxml','index.wxss']]+assetrows
result={'scope':'One targeted source/assets/actions/protection static check, no business execution, CLI, SDK, UI, pixel or full suite','baselineCommit':'b45a99d0749fd1c4a14f88fa588b244b6a844a4d','passedCount':len(checks),'checks':checks,'bindings':b.binds,'handlers':handlers,'oldAssets':oldassetrows,'newAssets':assetrows,'products':products,'protectedJSJSON':json.loads((T/'baseline-hashes.json').read_text()),'CSSSourceRuleCount':len(selectors),'newAssetsBytes':sum(x['bytes'] for x in assetrows),'productNetBytes':sum(x['bytes'] for x in products)-len(old.encode())-len(oldcss),'sourceObservationsAreReviewerOwnedAndNotExecutedHere':True}
(T/'targeted-source-binding-proof.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':len(checks),'actions':len(b.binds),'handlers':len(handlers),'productPaths':len(products),'newSVG':sum(p['path'].endswith('.svg') for p in products),'newJPEG':sum(p['path'].endswith('.jpg') for p in products),'netBytes':result['productNetBytes'],'hashes':products[:2]},indent=2))
