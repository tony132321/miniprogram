from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import hashlib,json,re,sys,zipfile,xml.etree.ElementTree as ET
sys.path.insert(0,'/private/tmp/irl-material-symbols-wave60/fonttools')
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
R=Path('/Users/tsb/Documents/小程序');T=Path('/private/tmp/caper-wave74-discover');D=R/'docs/design-sources/caper-discover-long-page-wave74';page=Path('miniprogram/pages/discover/discover')
H=lambda b:hashlib.sha256(b).hexdigest()
proof={'scope':'One necessary source/glyph/resource/action/whole inverse check. No CSS mirror test, API/business suite, historical checker, CLI, SDK, native click or pixel PASS.','checks':[]}
def check(name,condition,detail=None):
    proof['checks'].append({'name':name,'pass':bool(condition),'detail':detail});assert condition,name
class BindParser(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=False);self.stack=[];self.actions=[];self.refs=[];self.source=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);guards={k:v for k,v in attrs if k.startswith('wx:')};anc=[x['guards'] for x in self.stack if x['guards']]
        events={k:v for k,v in attrs if re.match(r'^(bind|catch|capture-bind|capture-catch)',k)}
        if events:
            self.actions.append({'tag':tag,'events':events,'data':{k:v for k,v in attrs if k.startswith('data-') and k!='data-source'},'guards':anc+([guards] if guards else []),'disabled':a.get('disabled')})
        if 'src' in a:self.refs.append(a['src'])
        if 'data-source'in a:self.source.append(a['data-source'])
        self.stack.append({'tag':tag,'guards':guards})
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.stack.pop()
    def handle_endtag(self,tag):
        assert self.stack and self.stack[-1]['tag']==tag,('markup nesting',tag,self.stack[-1:] if self.stack else None)
        self.stack.pop()
def parse(s):
    p=BindParser();p.feed(s);assert not p.stack;return p
old=(T/'baseline'/(str(page)+'.wxml')).read_bytes();now=(R/(str(page)+'.wxml')).read_bytes();inv=json.loads((D/'wxml-inverse-edits.json').read_text());rev=now.decode()
for x in reversed(inv['wxmlReplacements']):check('inverse current replacement once',rev.count(x['new'])==1);rev=rev.replace(x['new'],x['old'])
check('whole WXML inverse baseline bytes',rev.encode()==old,{'oldSHA256':H(old),'finalSHA256':H(now),'oldBytes':len(old),'finalBytes':len(now)})
oldcss=(T/'baseline'/(str(page)+'.wxss')).read_bytes();nowcss=(R/(str(page)+'.wxss')).read_bytes();check('entire old WXSS prefix byte equality',nowcss[:len(oldcss)]==oldcss,{'oldBytes':len(oldcss),'oldSHA256':H(oldcss),'finalSHA256':H(nowcss)})
oldjs=(T/'baseline'/(str(page)+'.js')).read_bytes();nowjs=(R/(str(page)+'.js')).read_bytes();check('business JS unchanged bytes',oldjs==nowjs,{'bytes':len(nowjs),'sha256':H(nowjs)})
oldjson=json.loads((T/'baseline'/(str(page)+'.json')).read_text());newjson=json.loads((R/(str(page)+'.json')).read_text());registration=newjson.pop('usingComponents',None);placeholder=newjson.pop('componentPlaceholder',None);check('JSON root registration only; other keys unchanged',newjson==oldjson and registration=={'reference-image':'/subpackages/profile/components/reference-image/reference-image'} and placeholder=={'reference-image':'view'},{'owner':'root','baselineSHA256':H((T/'baseline'/(str(page)+'.json')).read_bytes()),'currentSHA256':H((R/(str(page)+'.json')).read_bytes())})
po=parse(old.decode());pn=parse(now.decode());canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True)
check('all existing event attributes/data/disabled/guard multisets retained',Counter(map(canon,po.actions))==Counter(map(canon,pn.actions)),{'beforeCount':len(po.actions),'afterCount':len(pn.actions)})
oldscope=inv['wxmlReplacements'][0]['old']+'\n'+inv['wxmlReplacements'][1]['old'];newscope=inv['wxmlReplacements'][0]['new']+'\n'+inv['wxmlReplacements'][1]['new'];pb=parse(oldscope);pa=parse(newscope)
check('28 ordinary long module + CTA action declarations exact',len(pb.actions)==28 and Counter(map(canon,pb.actions))==Counter(map(canon,pa.actions)),{'before':pb.actions,'after':pa.actions})
for handler in sorted({v for a in pa.actions for v in a['events'].values()}):check('existing handler '+handler,re.search(r'\b'+re.escape(handler)+r'\s*\(',nowjs.decode()) is not None)
check('two precise async park consumers',newscope.count('<reference-image photo-key="discover-park" photo-class="d74-park-slot" />')==2)
park=R/'miniprogram/subpackages/profile/components/reference-image/assets/discover-park.jpg';check('park original response bytes in profile, not main',H(park.read_bytes())=='ab6bc2647289d4dfd98ea1229b2ea0caf5ead4390de18624c61af3e7645db05d' and len(park.read_bytes())==122735,{'path':str(park.relative_to(R)),'bytes':park.stat().st_size,'sha256':H(park.read_bytes()),'consumerScopes':['moments:first','venues:fourth'],'runtimeOwner':'root; no component/JSON test repeated'})
static=[]
for src in pa.refs:
    if '{{' in src:continue
    p=R/'miniprogram'/src.lstrip('/') if src.startswith('/') else R/page.parent/src
    check('static source resource resolves '+src,p.is_file());static.append({'src':src,'path':str(p.resolve().relative_to(R)),'bytes':p.stat().st_size,'sha256':H(p.read_bytes())})
proof['staticResources']=static
budget=json.loads(Path('/private/tmp/caper-wave72-discover-inbox-gap-audit/exact-glyph-candidate-budget.json').read_text());fonts={};glyph=[]
for a in budget['phosphorCandidates']:
    fpath=R/a['sourceFont'];style=a['style'];font=fonts.setdefault(style,TTFont(fpath));check('official '+style+' face SHA for '+a['candidate'],H(fpath.read_bytes())==a['sourceFontSha256']);css=(fpath.parent/'style.css').read_text();symbol=re.match(r'ph-(.*)-'+style+r'-[0-9a-f]+\.svg',a['candidate']).group(1);m=re.search(r'\.ph-'+re.escape(symbol)+r':before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";\s*\}',css);check('official CSS Unicode '+a['candidate'],m and m.group(1).lower()==a['unicode'].lower());name=font.getBestCmap()[int(m.group(1),16)];gs=font.getGlyphSet();pen=SVGPathPen(gs);gs[name].draw(TransformPen(pen,(1,0,0,-1,0,font['hhea'].ascent)));path=pen.getCommands();fp=R/'miniprogram/pages/discover/assets'/('w74-'+a['candidate']);b=fp.read_bytes();svg=ET.fromstring(b);node=svg.find('{http://www.w3.org/2000/svg}path');check('unrounded official outline/viewBox/paint '+a['candidate'],svg.attrib['viewBox']==f"0 0 {font['head'].unitsPerEm} {font['head'].unitsPerEm}" and node.attrib['d']==path and node.attrib['fill']==a['color'] and H(b)==a['sha256'] and H(path.encode())==a['pathSha256']);check('new glyph consumer exists '+a['candidate'],fp.name in now.decode());glyph.append({**a,'runtimePath':str(fp.relative_to(R)),'budgetNotProduct':False,'cmapGlyph':name,'upem':font['head'].unitsPerEm,'ascent':font['hhea'].ascent,'transform':[1,0,0,-1,0,font['hhea'].ascent],'outlineEqual':True,'sourceCSSPath':str((fpath.parent/'style.css').relative_to(R)),'sourceCSSSHA256':H((fpath.parent/'style.css').read_bytes())})
for symbol,style,filename,color in [('heart','bold','ph-heart-bold.svg','#ffffff'),('map-pin','regular','ph-map-pin-regular.svg','#94a3b8')]:
    f=fonts[style];css=(R/'docs/design-sources/phosphor-web-2.0.3'/style/'style.css').read_text();m=re.search(r'\.ph-'+re.escape(symbol)+r':before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";\s*\}',css);gs=f.getGlyphSet();pen=SVGPathPen(gs);gs[f.getBestCmap()[int(m.group(1),16)]].draw(TransformPen(pen,(1,0,0,-1,0,f['hhea'].ascent)));svg=ET.fromstring((R/'miniprogram/pages/discover/assets'/filename).read_bytes());node=svg.find('{http://www.w3.org/2000/svg}path');check('reused official glyph exact '+filename,node.attrib['d']==pen.getCommands() and node.attrib['fill']==color,{'unicode':m.group(1),'sourceStyle':style,'sourceFontSHA256':H((R/'docs/design-sources/phosphor-web-2.0.3'/style/('Phosphor.ttf' if style=='regular' else 'Phosphor-Bold.ttf')).read_bytes())})
proof['glyphs']=glyph;proof['newGlyphBytes']=sum(a['bytes'] for a in glyph);proof['newFontBytes']=0
zipPath=Path('/Users/tsb/Downloads/stitch_design_system_generator (2).zip');proof['originalZip']={'path':str(zipPath),'bytes':zipPath.stat().st_size,'sha256':H(zipPath.read_bytes())};check('original ZIP supplied SHA',proof['originalZip']['sha256']=='df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603')
with zipfile.ZipFile(zipPath) as z:
    for name in ['code.html','screen.png']:
        matches=[n for n in z.namelist() if n.endswith('/caper_4/'+name)];check('ZIP caper_4 one '+name,len(matches)==1);b=z.read(matches[0]);check('exact original caper_4 '+name,b==(D/name).read_bytes(),{'entry':matches[0],'bytes':len(b),'sha256':H(b)})
photo=json.loads((D/'original-photo-response-manifest.json').read_text());proof['photoSourceManifestSHA256']=H((D/'original-photo-response-manifest.json').read_bytes());proof['photoEvidence']='Original URLs fetched exactly once before implementation; seven existing runtime images byte match source response. Missing eighth exact park bytes live only in root profile component. No image re-encoding.'
# Source CSS observations are source-only evidence; do not run a product style mirror check.
obs=json.loads((D/'source-css-observation.json').read_text());check('one source-only cascade observation matches original and no page errors',obs['sourceHTMLSHA256']==H((D/'code.html').read_bytes()) and not obs['pageErrors'],{'boundary':'All font/image binaries blocked; computed properties do not establish font paint/text wrapping/native pixels.','sha256':H((D/'source-css-observation.json').read_bytes())})
proof['result']={'pass':True,'checks':len(proof['checks']),'longActions':len(pa.actions),'newGlyphs':len(glyph),'newGlyphBytes':proof['newGlyphBytes'],'newFontBytes':0,'mainRawNetDeltaExcludingRootJSON':len(now)-len(old)+len(nowcss)-len(oldcss)+proof['newGlyphBytes'],'protected':['whole WXML inverse to baseline','entire old CSS prefix','unchanged business JS','root-only JSON component registration','core/availability/invite/actions/guards exact through whole inverse']}
(D/'targeted-source-check.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(proof['result'],ensure_ascii=False))
