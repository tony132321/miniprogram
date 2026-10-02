from pathlib import Path
import json, hashlib, re, sys, xml.etree.ElementTree as ET, importlib.util

R=Path('/Users/tsb/Documents/小程序')
T=Path('/private/tmp/caper-wave71-host-monitor')
S=Path('/private/tmp/caper-wave71-host-monitor-prep')
I=Path('/private/tmp/caper-ui70-immutable-illt8q2z')
P=R/'miniprogram/subpackages/activity/event'
B=T/'baseline'
checks=[]
def sha(b): return hashlib.sha256(b).hexdigest()
def check(name, ok, detail=None):
    checks.append({'name':name,'passed':bool(ok),**({'detail':detail} if detail is not None else {})})
def record(p):
    b=p.read_bytes();return {'path':str(p.relative_to(R)) if p.is_relative_to(R) else str(p),'bytes':len(b),'sha256':sha(b)}

j=(P/'event.js').read_text();w=(P/'event.wxml').read_text();c=(P/'event.wxss').read_text()
jt=json.loads((T/'js-transforms.json').read_text());ut=json.loads((T/'ui-transforms.json').read_text())
ji=j
for ch in reversed(jt['changes']):
    check('JS inverse unique: '+ch['old'].splitlines()[0][:65],ji.count(ch['new'])==ch['count'])
    ji=ji.replace(ch['new'],ch['old'],ch['count'])
check('Complete JS inverse equals immutable70 baseline',ji.encode()==(B/'event.js').read_bytes())
wi=w
for ch in reversed(ut['changes']):
    check('WXML inverse unique: '+ch['old'][:65],wi.count(ch['new'])==1)
    wi=wi.replace(ch['new'],ch['old'],1)
check('Complete WXML inverse equals immutable70 baseline',wi.encode()==(B/'event.wxml').read_bytes())
check('Exact 194503-byte old WXSS prefix unchanged',(P/'event.wxss').read_bytes()[:ut['oldCSSBytes']]==(B/'event.wxss').read_bytes())
check('Only declared monitor CSS appended',c==(B/'event.wxss').read_text()+ut['cssAdded'])
check('event.json exact baseline',(P/'event.json').read_bytes()==(B/'event.json').read_bytes())
for name in ['event.js','event.wxml','event.wxss','event.json']:
    p=I/'miniprogram/subpackages/activity/event'/name
    check('Baseline '+name+' equals immutable70',p.read_bytes()==(B/name).read_bytes())
oldAssets=list((I/'miniprogram/subpackages/activity/event/assets').rglob('*'))
oldAssets=[p for p in oldAssets if p.is_file()]
changedOld=[str(p.relative_to(I)) for p in oldAssets if not (R/p.relative_to(I)).exists() or p.read_bytes()!=(R/p.relative_to(I)).read_bytes()]
check('All prior activity event assets preserved',not changedOld,{'count':len(oldAssets),'changed':changedOld})
guard=(S/'source/existing-more-menu-stillCurrent-guard.js').read_text()
check('Complete existing more-menu stillCurrent guard retained',guard in j,{'bytes':len(guard.encode()),'sha256':sha(guard.encode())})
check('Root QR require migration protected',"require('../utils/checkin-qr.js')" in ji)
check('Root pgd-state-primary fix protected','class="pgd-state-primary"' in wi and '.pgd-host-reference .pgd-state-primary{color:#424655}' in (B/'event.wxss').read_text())
rootPaths={x:wi.count(x) for x in ['./assets/pg09-expense-rooftop.jpg','./assets/pg04s-badminton.jpg','./assets/pg01-badminton-player.jpg','../assets/itinerary-badminton.jpg']}
check('Root accepted resource paths unchanged',all(w.count(x)==n for x,n in rootPaths.items()),rootPaths)

def between(s,start,end):return s.split(start,1)[1].split(end,1)[0]
nav=between(w,'<!-- Wave71 _5 host monitor native nav BEGIN -->','<!-- Wave71 _5 host monitor native nav END -->')
body=between(w,'<!-- Wave71 _5 host monitor BEGIN -->','<!-- Wave71 _5 host monitor END -->')
check('New header and body have exact READY/no-success/no-join/current-host gate',nav.count('{{'+ut['guard']+'}}')==1 and body.count('{{'+ut['guard']+'}}')==1)
check('Readonly monitor body has no event, form, input, payment or mutation bindings',not re.search(r'(?:bind|catch)[\w:-]*=|<(?:input|textarea|form|button)\b',body))
binds=re.findall(r'(?:bind|catch)[\w:-]*="([^"]+)"',nav)
check('Header only existing goBack/jumpToSection methods',binds==['goBack','jumpToSection'],binds)
check('Header existing registration navigation exact','data-section="registrationSection"' in nav)
check('Actual server fields bound',all(x in body for x in ['display.title','display.location','event.payload.minParticipants','event.payload.venueStatus','event.reviewStatus','event.riskPaused','safetyStatus','confirmedRoster','registrationsLoadState','item.displayName','item.statusLabel','event.version']))
check('Unavailable counts not zeroed',"人数统计暂不可用" in body and "不以零人替代未知人数" in body)
check('Reserve remains separate from actual waitlist','hostMonitorMetrics.reserved' in body and 'hostMonitorMetrics.waitlisted' in body and '独立预留' in body)
check('Unsupported source facts visibly closed',all(x in body for x in ['只读快照','AI 组局管家尚未开放','天气监控尚未开放','自动提醒尚未开放','付款未由平台核验','凭证尚未开放','原稿位置示意图 · 不代表本场坐标','无自动实时同步承诺']))
check('No invented source people/order/device/time/weather facts',not any(x in body for x in ['Luna','Alex','Momo','JASC-202310','RT-TERMINAL','每 15 秒','48 小时','22℃','T-2h','已支付 AA','已预付场租']))
normalized=re.sub(r'\{\{[\s\S]*?\}\}','BINDING',w)
normalized=re.sub(r'\b(wx:else|disabled|readonly|autofocus|scroll-y)(?=[\s/>])(?!\s*=)',r'\1=""',normalized)
try:
    ET.fromstring('<scope xmlns:wx="wx" xmlns:bind="bind" xmlns:catch="catch">'+normalized+'</scope>')
    check('WXML normalized XML structure',True)
except ET.ParseError as e:check('WXML normalized XML structure',False,str(e))

source=(S/'source/_5-code.html').read_bytes()
check('Exact original _5 HTML SHA',sha(source)=='e2a2ce2fb2266283f7762dca23592c732eca385d88ce1772f1e22a41bec8b024')
check('Exact original _5 full PNG SHA',sha((S/'source/_5-screen.png').read_bytes())=='c304525527f9fcab9c7e6646ed13e8b63a3febeff3c34880f8f1ff91f7b7b3cb')
mapbytes=(S/'source/_5-original-map.png').read_bytes()
check('Original 152683-byte illustrative map copied byte-exact',(P/'assets/hm-map-illustrative.png').read_bytes()==mapbytes and len(mapbytes)==152683 and sha(mapbytes)=='8c4881b9d74ec892c8549613ab1426b0a11c54793cdb073ffd6540c2805d02f4')
check('No fake source portraits copied',not any(re.search(r'(luna|alex|momo|david|leo|taylor)',Path(x).name,re.I) for x in ut['newAssets']))
check('New assets only activity subpackage',len(ut['newAssets'])==8 and all(x.startswith('miniprogram/subpackages/activity/event/assets/hm-') for x in ut['newAssets']))

manifest=json.loads((T/'runtime-material-manifest.json').read_text())
check('Original last Material import identified',manifest['lastMaterialURL']=='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap')
fullFont=R/manifest['fixedSourceFace'];check('Official cached original full face SHA',sha(fullFont.read_bytes())==manifest['fullFontSHA256'])
spec=importlib.util.spec_from_file_location('bridge',R/'docs/design-sources/caper-activity-wave69/fonttools_node_brotli_bridge.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
fpath=Path('/private/tmp/caper-wave69-event/sources/material-up-decoded.ttf')
check('Original full decoded TTF SHA',sha(fpath.read_bytes())=='cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90')
base=TTFont(fpath);axes={a.axisTag:[a.minValue,a.defaultValue,a.maxValue] for a in base['fvar'].axes}
check('Original last face axes and defaults',axes=={'FILL':[0,0,1],'wght':[100,400,700]},axes)
def shape(font,name):
    ids=[font.getBestCmap()[ord(x)] for x in name];lig=None;lookup=None
    table=font['GSUB'].table
    for i,l in enumerate(table.LookupList.Lookup):
        for s in l.SubTable:
            typ=l.LookupType
            if typ==7:typ=s.ExtensionLookupType;s=s.ExtSubTable
            if typ==4:
                for x in s.ligatures.get(ids[0],[]):
                    if [ids[0]]+x.Component==ids:lig=x.LigGlyph;lookup=i;break
        if lig:break
    assert lig,name
    f=table.FeatureList.FeatureRecord;script=next(x for x in table.ScriptList.ScriptRecord if x.ScriptTag=='latn')
    active=[{'feature':f[i].FeatureTag,'lookups':f[i].Feature.LookupListIndex} for i in script.Script.DefaultLangSys.FeatureIndex]
    rendered=lig;subs=[]
    for feature in active:
        if feature['feature']!='rclt':continue
        for idx in feature['lookups']:
            l=table.LookupList.Lookup[idx]
            for s in l.SubTable:
                typ=l.LookupType
                if typ==7:typ=s.ExtensionLookupType;s=s.ExtSubTable
                if typ==1 and rendered in s.mapping:
                    target=s.mapping[rendered];subs.append({'feature':'rclt','lookup':idx,'from':rendered,'to':target});rendered=target
    return lig,rendered,{'ligatureLookup':lookup,'activeLatnFeatures':active,'substitutions':subs}
fonts={};glyphProof=[]
for a in manifest['exports']:
    key=(a['axes']['wght'],a['axes']['FILL'])
    if key not in fonts:fonts[key]=instantiateVariableFont(TTFont(fpath),{'wght':key[0],'FILL':key[1]},inplace=False)
    f=fonts[key];lig,rendered,gsub=shape(f,a['name']);gs=f.getGlyphSet();pen=SVGPathPen(gs);gs[rendered].draw(TransformPen(pen,(1,0,0,-1,0,0)));path=pen.getCommands()
    node=ET.fromstring((R/a['runtime']).read_bytes());paths=list(node.iter('{http://www.w3.org/2000/svg}path'))
    ok=path==a['path'] and lig==a['ligatureGlyph'] and rendered==a['renderedGlyph'] and gsub==a['effectiveGSUB'] and len(paths)==1 and paths[0].attrib.get('d')==path and node.attrib.get('viewBox')==a['viewBox'] and node.attrib.get('fill','').lower()==a['color'] and a['runtimeURL'] in nav+body
    check('Exact active-GSUB Material '+a['name']+' '+str(key),ok)
    glyphProof.append({'name':a['name'],'axes':a['axes'],'ligatureGlyph':lig,'renderedGlyph':rendered,'effectiveGSUB':gsub,'rawPathSHA256':sha(path.encode()),'runtime':record(R/a['runtime'])})
check('FILL1 actual substituted shapes retained',[(a['name'],a['renderedGlyph']) for a in manifest['exports'] if a['axes']['FILL']]==[('sports_tennis','sports_tennis.fill'),('verified','verified.fill')])
check('Source three check spans actually 700',sum(n['name']=='check' for n in manifest['nodes'])==3 and next(a for a in manifest['exports'] if a['name']=='check')['axes']['wght']==700)
css=ut['cssAdded']
roleChecks={
 'Source header 56 native status/capsule fields':'height:calc({{statusBarHeight}}px + 56px)' in nav and '{{headerPaddingRight}}' in nav,
 'Source side margin16/native back44/person32':'padding:0 16px' in css and '.hm-native-back{width:44px;height:44px;margin-left:-8px' in css and '.hm-native-nav .hm-native-person{width:32px;height:32px' in css,
 'Source card12/radius12/shadow-sm':'padding:12px;border-radius:12px;background:#fff;box-shadow:0 1px 2px 0 rgba(0,0,0,.05)' in css,
 'Source ambient blur40/24':all(x in css for x in ['filter:blur(40px)','filter:blur(24px)','width:128px;height:128px','width:112px;height:112px']),
 'Source 4 tiles/gap12/p8/r8':all(x in css for x in ['grid-template-columns:repeat(4,minmax(0,1fr));gap:12px','padding:8px;border-radius:8px;background:#f4f3f8']),
 'Source headline20/26/700-.3':'font-size:20px;line-height:26px;letter-spacing:-.3px;font-weight:700' in css,
 'Source hero22/28/700-.44':'font-size:22px;line-height:28px;letter-spacing:-.44px;font-weight:700' in css,
 'Source 17/22/600-.17 explicit AI role':'.hm-ai-title{font-size:17px;line-height:22px;letter-spacing:-.17px;font-weight:600}' in css and 'class="hm-ai-title"' in body,
 'Source status green specificity survives gray last-child':'.hm-stat>text.hm-stat-green,.hm-stat>view.hm-stat-green{color:#34c759}' in css,
 'Source conditions p10/check24/glyph16/rightML8':all(x in css for x in ['justify-content:space-between;padding:10px','width:24px;height:24px','width:16px;height:16px','.hm-condition-status{flex:none;margin-left:8px']),
 'Source no doubled condition spacing':'.hm-condition{display:flex;align-items:center;justify-content:space-between;gap:' not in css,
 'Source progress10/transition700':'height:10px' in css and 'transition:width .7s cubic-bezier(0,0,.2,1)' in css,
 'Source pulse2s/spin9s':all(x in css for x in ['animation:hm-pulse 2s cubic-bezier(.4,0,.6,1) infinite','animation:hm-spin 9s linear infinite','@keyframes hm-pulse{50%{opacity:.5}}']),
 'Source body relaxed15/24.375':'.hm-ai-copy{font-size:15px;line-height:24.375px;font-weight:400' in css,
 'Source host name/status700 vs member600':'.hm-roster-host .hm-roster-person>view>text:first-child,.hm-roster-host .hm-roster-state>text:first-child{font-weight:700}' in css and "item.user_id === event.hostId ? 'hm-roster-host'" in body,
 'Source member avatar40/map128':all(x in css for x in ['width:40px;height:40px','height:128px;margin-top:8px;border-radius:8px']),
 'Undefined source shadow-xs and py0.2 not invented':not re.search(r'hm-(?:ai-heading|terminal)[^}]*box-shadow',css) and 'padding:.8px' not in css,
 'Source ordinary fonts only, no new global weights':not any(x in css for x in ['Caper Jakarta Profile 500','font-weight:900','@font-face','Rubik','Caveat'])
}
for n,v in roleChecks.items():check(n,v)
green=json.loads((T/'targeted-green-tool-result.json').read_text())
check('Only new targeted6 groups reported successful',green['exit_code']==0 and 'ℹ tests 6\n' in green['output'] and 'ℹ pass 6\n' in green['output'] and 'ℹ fail 0\n' in green['output'])
owned=[P/'event.js',P/'event.wxml',P/'event.wxss']+[R/x for x in ut['newAssets']]+[R/'test/miniprogram-event-host-monitor-navigation.test.ts']
net=sum((P/n).stat().st_size-(B/n).stat().st_size for n in ['event.js','event.wxml','event.wxss'])+sum((R/x).stat().st_size for x in ut['newAssets'])
proof={'scope':'Wave71 original _5 current-host readonly monitor, one bounded source/assets/binding/inverse check; no old suites, SDK, CLI or real business mutation','baselineCommit':'81ab6a794f32367c10c329297128bb96b131d599','baselineImmutable':str(I),'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'JSInverse':{'changes':len(jt['changes']),'bytes':len(ji.encode()),'sha256':sha(ji.encode())},'WXMLInverse':{'changes':len(ut['changes']),'bytes':len(wi.encode()),'sha256':sha(wi.encode())},'protectedCSSBytes':ut['oldCSSBytes'],'protectedCSSSHA256':sha((B/'event.wxss').read_bytes()),'rootAcceptedMigrations':rootPaths,'glyphProof':glyphProof,'ownedPaths':[record(p) for p in owned],'rawMiniProductNetBytes':net,'newAssetsBytes':sum((R/x).stat().st_size for x in ut['newAssets']),'newTestResult':green,'testJSObservedSHA256':sha((P/'event.js').read_bytes()),'newTestFileSHA256':sha((R/'test/miniprogram-event-host-monitor-navigation.test.ts').read_bytes())}
(T/'scoped-source-binding-protection-check.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':proof['passed'],'failed':proof['failed'],'ownedPaths':len(owned),'rawMiniProductNetBytes':net,'newAssetsBytes':proof['newAssetsBytes'],'failedChecks':[x for x in checks if not x['passed']]},ensure_ascii=False))
sys.exit(1 if proof['failed'] else 0)
