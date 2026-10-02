from pathlib import Path
import json,re,hashlib,shutil,collections,xml.etree.ElementTree as ET
from html.parser import HTMLParser
ROOT=Path('/Users/tsb/Documents/小程序');TMP=Path('/private/tmp/caper-wave71-compact-center-prep');BASE=Path('/private/tmp/caper-ui70-immutable-illt8q2z');D=ROOT/'docs/design-sources/caper-compact-center-wave71';D.mkdir(parents=True,exist_ok=True)
H=lambda b:hashlib.sha256(b).hexdigest()
R=lambda p:{'path':str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p),'bytes':p.stat().st_size,'sha256':H(p.read_bytes())}
P=ROOT/'miniprogram/pages/messages';old=P.relative_to(ROOT)
w=(P/'messages.wxml').read_text();branch=(TMP/'compact-branch.wxml').read_text();assert w.count(branch)==1;inv=w.replace(branch,'')
for e in reversed(json.loads((TMP/'wxml-inverse-edits.json').read_text())):assert inv.count(e['new'])==1;inv=inv.replace(e['new'],e['old'])
assert inv==(BASE/old/'messages.wxml').read_text()
css=(P/'messages.wxss').read_bytes();append=(TMP/'compact-append.wxss').read_bytes();assert css.endswith(append);assert css[:-len(append)]==(BASE/old/'messages.wxss').read_bytes()
js=(P/'messages.js').read_text();jinv=js
for e in reversed(json.loads((TMP/'js-inverse-edits.json').read_text())):
 assert jinv.count(e['new'])==e['count'],(e['new'][:60],jinv.count(e['new']),e['count']);jinv=jinv.replace(e['new'],e['old'])
assert jinv==(BASE/old/'messages.js').read_text();assert (P/'messages.json').read_bytes()==(BASE/old/'messages.json').read_bytes()
# Parse actual complete markup, using escaped operator characters only for XML syntax validation.
normalized=re.sub(r'\b(wx:else)(?=[\s>])',r'\1=""',w)
normalized=re.sub(r'="([^"]*)"',lambda m:'="'+m[1].replace('&','&amp;').replace('<','&lt;')+'"',normalized)
ET.fromstring('<root xmlns:wx="urn:wx">'+normalized+'</root>')
class Actions(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.stack=[];self.actions=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if any(k.startswith(('bind','catch')) for k in a):self.actions.append({'tag':t,'contract':{k:v for k,v in a.items() if k.startswith(('bind','catch','data-')) or k in ['disabled','wx:if']},'ancestors':[{k:v for k,v in p.items() if k.startswith('wx:')} for _,p in self.stack if any(k.startswith('wx:') for k in p)]})
  self.stack.append((t,a))
 def handle_startendtag(self,t,a):self.handle_starttag(t,a);self.stack.pop()
 def handle_endtag(self,t):assert self.stack[-1][0]==t,(t,self.stack[-1][0]);self.stack.pop()
b=Actions();b.feed(branch);oldc=Actions();oldc.feed('<view class="center-shell">'+(BASE/old/'messages.wxml').read_text().split('  <block wx:else>\n    <view class="center-shell">',1)[1].rsplit('  </block>',1)[0])
# Contract fields of every old card business action are preserved; source compact moves approval details first.
expected=[x['contract'] for x in oldc.actions if x['contract'].get('bindtap') not in ['markAllRead','goNotificationSettings']]
actual=[x['contract'] for x in b.actions if x['contract'].get('bindtap')!='openCenterOptions']
assert collections.Counter(json.dumps(x,sort_keys=True) for x in expected)==collections.Counter(json.dumps(x,sort_keys=True) for x in actual)
for x in b.actions:
 handler=x['contract'].get('bindtap');assert handler and re.search(r'^  (?:async )?'+handler+r'\(',js,re.M),handler
# Resource check: original body preserved and all exact used SVG contours/fill/viewports; no new face generation.
g=json.loads((TMP/'glyph-manifest.json').read_text());refs=re.findall(r'src="([^"{]+)"',branch);used=set(refs)
for e in g['exports']:
 p=ROOT/e['asset'];assert H(p.read_bytes())==e['sha256'];svg=ET.fromstring(p.read_bytes());paths=svg.findall('{http://www.w3.org/2000/svg}path');assert len(paths)==1
 assert svg.get('viewBox')==e['viewBox'] and paths[0].get('d')==e['pathData'] and (paths[0].get('fill') or svg.get('fill'))==e['color']
 assert '/'+str(p.relative_to(ROOT/'miniprogram')) in used,e['key']
 if e['axes']['FILL']==1:assert e['activeRclt'] and e['renderedGlyph'].endswith('.fill')
for ref in used:assert ref.startswith('/') and (ROOT/'miniprogram'/ref[1:]).is_file(),ref
photo=json.loads((TMP/'photo-manifest.json').read_text());p=ROOT/photo['asset'];assert H(p.read_bytes())==photo['sha256'];assert photo['httpStatus']==200 and photo['noReencoding']
protectedAssets=[]
for p in (BASE/old/'assets').glob('*'):
 q=ROOT/old/'assets'/p.name;assert q.read_bytes()==p.read_bytes();protectedAssets.append(R(q))
assert not re.search(r'Alex|Momo|¥45|去结算|临时交流室已开启|AI 伙伴已|导航前往|2 小时',branch)
assert not re.search(r'bind\w+="(?:pay|navigateMap|sendChat|sendMessage)',branch)
assert 'notice.icon' in branch and 'notice.cardVariant' in branch and 'expectedVersion' in branch and 'item.canApprove' in branch
stylePrefixes=re.findall(r'^(\.[^{]+)\{',append.decode(),re.M)
assert all(x.startswith('.messages-') or x.startswith(' * ') for x in stylePrefixes),stylePrefixes
proof={'scope':'Once-only source/resource/whole inverse/binding check, not style mirror tests or runtime. Seven new behavior VM cases run separately. No old full suites, SDK, CLI, CI or matrix.','baselineCommit':'d78b2464b4c97a17ddf4f0c13dc692ae892ba250','baselineArchive':str(BASE),'wholeWXMLInverse':{'bytes':len(inv.encode()),'sha256':H(inv.encode())},'wholeJSInverse':{'bytes':len(jinv.encode()),'sha256':H(jinv.encode())},'oldCSSPrefix':{'bytes':len(css)-len(append),'sha256':H(css[:-len(append)])},'JSONProtected':R(P/'messages.json'),'WXMLStructure':'parsed','newActionContracts':b.actions,'oldCenterBusinessContractCount':len(expected),'newSameBusinessContractCount':len(actual),'approvalOrder':'Original N2 details-before-approve, still original id/version/canApprove/disabled guards','protectedAssets':protectedAssets,'actualRefs':refs,'newGlyphs':len([x for x in g['exports'] if not x['reused']]),'reusedGlyphs':len([x for x in g['exports'] if x['reused']]),'photo':photo,'sourceCascadeObservation':'Reused original once-only browser CSS observation /private/tmp/caper-wave70-unrouted-background-audit/pg02_n_2-source-css-observation.json; no original-font/image native rendering claim'}
(D/'bounded-source-binding-protection.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
for n in ['glyph-manifest.json','photo-manifest.json','js-inverse-edits.json','wxml-inverse-edits.json','compact-branch.wxml','compact-append.wxss','check-source-protection.py','layout-tests-red.log','layout-tests-green.log']:shutil.copyfile(TMP/n,D/n)
source=Path('/private/tmp/irl-stitch-original/stitch_design_system_generator/pg02_n_2');shutil.copyfile(source/'code.html',D/'pg02_n_2-original.html');obs=Path('/private/tmp/caper-wave70-unrouted-background-audit/pg02_n_2-source-css-observation.json');shutil.copyfile(obs,D/'source-css-observation.json')
obsj=json.loads(obs.read_text())
for p in obsj.get('styleFiles',[]):
 print('style',p)
sm={'source':{'HTML':R(source/'code.html'),'PNG':R(source/'screen.png'),'ZIP':R(Path('/Users/tsb/Downloads/stitch_design_system_generator (2).zip'))},'sourceGlyphs':'Material Symbols Outlined source lastface fullv374 Version2.972 wght400/FILL0..1 fixed24 GRAD0; exact FILL1 active latn rclt; no new global fonts','fontFamily':'Plus Jakarta Sans source400/600/700/800 already registered; profile500 alias not used','nativeAdaptation':'Source fixed56header starts after current statusBarHeight; existing native capsuleInset reserves actual capsule. Body0 sidepadding, main16, no N1 bigheading/read-all row. Main safe inset and source40bottom retained.','truthfulMappings':{'reminder':'actual EVENT_REMINDER → old openNotice/checkinSection and guarded copyReminderVenue; exact source illustration, clearly labeled','approval':'actual API registrationId/eventId/isHost/expectedVersion/canApprove; original actual approvals separatecollection, details thenapprove, anonymous28 placeholder insteadof fakeAlex/Momo','update':'actual MATERIAL_CHANGE → old current registrationSection; no coordinate/navigation','milestone':'actual EVENT_CONFIRMED → old detailsSection; real activity CTA, no auto calendar/group','payment':'R1 has no source payment notification kind or settlement service. No wallet asset/¥45/fake payment record. Actual other present() notices use actual tone/icon/title/summary/actionLabel in samecardgeometry.','badge':'Actual loaded ACTIVITY status!=OPENED count; aria states loadedscope. Not total unreadTotal, not fixed2.','footer':'Exact sourcegeometry/Englishbrand, real CAPER stationnotification subtitle ratherthan false AIservice capability'},'scope':'Only N2 newlayout + required menu guards/reset/projection, old source complete inverse protected; no native claim or 39-page completion.'}
(D/'source-manifest.json').write_text(json.dumps(sm,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'WXML':R(P/'messages.wxml'),'CSS':R(P/'messages.wxss'),'JS':R(P/'messages.js'),'contracts':len(b.actions),'oldBusiness':len(expected),'newBusiness':len(actual),'protectedAssets':len(protectedAssets),'proof':R(D/'bounded-source-binding-protection.json')},ensure_ascii=False))
