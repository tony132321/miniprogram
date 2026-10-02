from pathlib import Path
from html.parser import HTMLParser
import re,json,hashlib,importlib.util,xml.etree.ElementTree as ET
R=Path('/Users/tsb/Documents/小程序');T=Path('/private/tmp/caper-wave70-pg07');S=T/'source';S.mkdir(exist_ok=True);O=T/'svg';O.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('bridge',R/'docs/design-sources/caper-activity-wave69/fonttools_node_brotli_bridge.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
fontPath=Path('/private/tmp/caper-wave69-event/sources/material-up-decoded.ttf');fonts={}
def h(b):return hashlib.sha256(b).hexdigest()
class Parse(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.nodes=[];self.links=[];self.current=None
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='link':self.links.append(d)
  if 'material-symbols-outlined' in d.get('class','').split():self.current={'line':self.getpos()[0],'attributes':d,'ancestors':[{'tag':x,'attributes':y} for x,y in self.stack],'name':''};self.nodes.append(self.current)
  if t not in ['link','meta','input','img','br']:self.stack.append((t,d))
 def handle_endtag(self,t):
  if t=='span' and self.current:self.current=None
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==t:self.stack=self.stack[:i];break
 def handle_data(self,x):
  if self.current:self.current['name']+=x.strip()
html=Path('/private/tmp/irl-stitch-original/stitch_design_system_generator/pg07/code.html').read_text();p=Parse();p.feed(html);colors=dict(re.findall(r'"([\w-]+)":"(#[A-Fa-f0-9]+)"',html));material=[x['href'] for x in p.links if 'Material+Symbols+' in x.get('href','')];assert material[-1]=='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
def color(n):
 found='#1a1b1f'
 for x in n['ancestors']+[{'attributes':n['attributes']}]:
  for cls in x['attributes'].get('class','').split():
   if cls.startswith('text-'):
    token=cls[5:];found=colors.get(token,{'white':'#ffffff'}.get(token,found))
 return found.lower()
def shaped(f,name):
 cm=f.getBestCmap();ids=[cm[ord(c)] for c in name];lig=None;ligaLookup=None
 for i,l in enumerate(f['GSUB'].table.LookupList.Lookup):
  for sub in l.SubTable:
   typ=l.LookupType
   if typ==7:typ=sub.ExtensionLookupType;sub=sub.ExtSubTable
   if typ==4:
    for x in sub.ligatures.get(ids[0],[]):
     if [ids[0]]+x.Component==ids:lig=x.LigGlyph;ligaLookup=i;break
  if lig:break
 assert lig,name
 table=f['GSUB'].table;features=table.FeatureList.FeatureRecord;script=next(x for x in table.ScriptList.ScriptRecord if x.ScriptTag=='latn');active=[{'feature':features[i].FeatureTag,'lookups':features[i].Feature.LookupListIndex} for i in script.Script.DefaultLangSys.FeatureIndex];final=lig;subs=[]
 for feature in active:
  if feature['feature']!='rclt':continue
  for idx in feature['lookups']:
   l=table.LookupList.Lookup[idx]
   for sub in l.SubTable:
    typ=l.LookupType
    if typ==7:typ=sub.ExtensionLookupType;sub=sub.ExtSubTable
    if typ==1 and final in sub.mapping:target=sub.mapping[final];subs.append({'feature':'rclt','lookup':idx,'from':final,'to':target});final=target
 return lig,final,{'ligatureLookup':ligaLookup,'activeLatnFeatures':active,'substitutions':subs}
assets={}
for n in p.nodes:
 fill=1 if re.search(r"['\"]FILL['\"]\s*1",n['attributes'].get('style','')) else 0;w=700 if 'font-bold' in n['attributes'].get('class','').split() else 400;paint=color(n);n['displayPx']=int(re.search(r'text-\[(\d+)px\]',n['attributes']['class']).group(1));key=(n['name'],w,fill,paint)
 if key not in assets:
  if (w,fill) not in fonts:fonts[(w,fill)]=instantiateVariableFont(TTFont(fontPath),{'wght':w,'FILL':fill},inplace=False)
  f=fonts[(w,fill)];lig,final,proof=shaped(f,n['name']);gs=f.getGlyphSet();pen=SVGPathPen(gs);gs[final].draw(TransformPen(pen,(1,0,0,-1,0,0)));path=pen.getCommands();file=n['name']+f'-w{w}-f{fill}-'+paint[1:]+'.svg';svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="{paint}"><path d="{path}"/></svg>\n';(O/file).write_text(svg);assets[key]={'name':n['name'],'axes':{'wght':w,'FILL':fill,'opsz':24,'GRAD':0},'color':paint,'unicode':[f'U+{u:04X}' for u,g in f.getBestCmap().items() if g==lig],'ligatureGlyph':lig,'renderedGlyph':final,'effectiveGSUB':proof,'path':path,'viewBox':'0 -960 960 960','filename':file,'bytes':len(svg.encode()),'sha256':h(svg.encode()),'sourceNodes':[]}
 assets[key]['sourceNodes'].append({'line':n['line'],'displayPx':n['displayPx']});n['exactSVG']=assets[key]['filename']
smile=re.search(r'(<svg class="w-7 h-7.*?</svg>)',html,re.S).group(1);resolved=smile.replace('currentColor','#ffffff').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ',1);(O/'smile-inline.svg').write_text(resolved+'\n')
for a in assets.values():
 a['reusedRuntime']=None
 for f in (R/'miniprogram/subpackages/activity/event/assets').glob('*.svg'):
  root=ET.fromstring(f.read_bytes());paths=list(root.iter('{http://www.w3.org/2000/svg}path'))
  if len(paths)==1 and root.attrib.get('viewBox')==a['viewBox'] and root.attrib.get('fill','').lower()==a['color'] and paths[0].attrib['d']==a['path']:a['reusedRuntime']=str(f.relative_to(R));break
manifest={'sourceHTMLSHA256':h(html.encode()),'lastMaterialURL':material[-1],'originalMaterialURLs':material,'fixedSourceFace':'docs/design-sources/caper-activity-wave69/original-last-material-full.woff2','fullFontSHA256':'77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9','version':'Version2.972','activeRcltApplied':True,'nodes':p.nodes,'exports':list(assets.values()),'smile':{'sourceLiteral':smile,'resolvedSVG':resolved,'onlyChanges':['xmlns','currentColor resolved source on-primary #ffffff'],'bytes':len((resolved+'\n').encode()),'sha256':h((resolved+'\n').encode())}}
(S/'material-and-inline-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'nodes':len(p.nodes),'variants':len(assets),'reusable':sum(x['reusedRuntime'] is not None for x in assets.values()),'fill1FinalGlyphs':[x['renderedGlyph'] for x in assets.values() if x['axes']['FILL']]}))
