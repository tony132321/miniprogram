from pathlib import Path
from collections import Counter
import hashlib,json,re,html,xml.etree.ElementTree as ET
ROOT=Path('/Users/tsb/Documents/小程序');TEMP=Path('/private/tmp/caper-wave74-inbox-long');DOC=ROOT/'docs/design-sources/caper-inbox-long-wave74';BASE=TEMP/'baseline';checks=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def check(name,valid,evidence=None):
 checks.append({'name':name,'pass':bool(valid),'evidence':evidence});assert valid,name
old=(BASE/'miniprogram/pages/messages/messages.wxml').read_bytes();new=(ROOT/'miniprogram/pages/messages/messages.wxml').read_bytes();oldcss=(BASE/'miniprogram/pages/messages/messages.wxss').read_bytes();newcss=(ROOT/'miniprogram/pages/messages/messages.wxss').read_bytes();source=(DOC/'caper_3-code.html').read_bytes()
check('original source HTML exact expected byte/hash',len(source)==32137 and sha(source)=='18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b')
edits=json.loads((DOC/'wxml-inverse-edits.json').read_text());inverse=new.decode()
for e in reversed(edits):
 check('inverse replacement occurrences '+str(len(checks)),inverse.count(e['new'])==e['count']);inverse=inverse.replace(e['new'],e['old'])
check('whole WXML inverse exactly restores baseline',inverse.encode()==old,{'baselineBytes':len(old),'baselineSHA':sha(old),'edits':len(edits)})
append=(DOC/'append-only.wxss').read_bytes();check('whole old CSS prefix and exact append',newcss==oldcss+append,{'prefixBytes':len(oldcss),'prefixSHA':sha(oldcss),'appendBytes':len(append),'appendSHA':sha(append)})
records=json.loads((TEMP/'baseline-manifest.json').read_text());protected=[]
for e in records:
 if e['path'].endswith(('.wxml','.wxss')):continue
 b=(ROOT/e['path']).read_bytes();check('protected bytes '+e['path'],len(b)==e['bytes'] and sha(b)==e['sha256']);protected.append(e)
# Namespace-normalized XML parse checks full nesting and action contracts with effective wx ancestors.
def tree(b):
 t=b.decode().replace('wx:','wx_');t=re.sub(r'\bwx_else(?=[\s/>])','wx_else="true"',t);t=re.sub(r'="([^"]*)"',lambda m:'="'+html.escape(m.group(1),quote=False)+'"',t);return ET.fromstring(t)
def contracts(root):
 c=Counter()
 def walk(node,anc):
  guards=anc+tuple(sorted((k,v) for k,v in node.attrib.items() if k.startswith('wx_')))
  if any(k.startswith(('bind','catch')) for k in node.attrib):
   attrs=tuple(sorted((k,v) for k,v in node.attrib.items() if k.startswith(('bind','catch','data-')) or k in ['id','disabled','value','placeholder','aria-label']))
   c[(node.tag,attrs,guards)]+=1
  for child in node:walk(child,guards)
 walk(root,());return c
before=tree(old);after=tree(new);a,b=contracts(before),contracts(after);check('full action attributes and effective wx conditions unchanged',a==b,{'templateActionNodes':sum(a.values()),'uniqueContracts':len(a)})
marker=b'  <block wx:elif="{{viewMode === \'CHAT_UNAVAILABLE\'}}">';check('whole CHAT/N1/N2/non-INBOX suffix byte exact',old[old.index(marker):]==new[new.index(marker):],{'bytes':len(old[old.index(marker):]),'sha256':sha(old[old.index(marker):])})
he=b'  <view wx:if="{{searchOpen}}"';check('INBOX header/status/root byte exact',old[:old.index(he)]==new[:new.index(he)])
ps=b'  <view wx:if="{{loadState === \'READY\' && filter === \'ALL\' && !searchQuery && priorityItems.length > 0}}" class="card priority-card">';pe=b'  <view wx:if="{{loadState === \'READY\' && filteredCount > 0}}" class="notice-groups';check('INBOX priority source paragraph byte exact',old[old.index(ps):old.index(pe)]==new[new.index(ps):new.index(pe)])
# Search/error/auth/loading/approval preserve the region preceding the solely affected recent-conversation row.
xs=b'  <view wx:if="{{searchOpen}}"';xe=b'  <view wx:if="{{loadState === \'READY\' && filter === \'ALL\'}}" class="card conversation-card';check('search/approval/identity/loading/empty paragraph byte exact',old[old.index(xs):old.index(xe)]==new[new.index(xs):new.index(xe)])
raw=re.sub(r'/\*.*?\*/','',append.decode(),flags=re.S);rule_headers=[s.strip() for s in re.findall(r'([^{}]+)\{',raw)];selectors=[]
for s in rule_headers:
 if s.startswith('@keyframes') or s=='50%':continue
 selectors.extend(x.strip() for x in s.split(','))
check('every new ordinary CSS selector is INBOX and distinct long scope',all(s.startswith('.messages-inbox .inbox-long') for s in selectors),{'selectors':len(selectors),'noBareSharedSelectors':True})
check('only newly named pulse animation',re.findall(r'@keyframes\s+([\w-]+)',raw)==['inbox-long-source-pulse'])
svgs=json.loads((DOC/'inline-svg-source.json').read_text())
for e in svgs:
 p=ROOT/e['path'];svg=p.read_bytes();xml=ET.fromstring(svg);children=re.search(rb'<svg[^>]*>(.*?)</svg>',svg,re.S).group(1)
 check('source SVG original children '+e['path'],children==e['originalChildren'].encode() and sha(children)==e['childrenSha256']);check('source SVG root dimensions/paint '+e['path'],xml.attrib['viewBox']=='0 0 20 20' and xml.attrib['fill']==e['color'] and xml.attrib['width']=='16' and xml.attrib['height']=='16')
 check('new source SVG hash '+e['path'],len(svg)==e['bytes'] and sha(svg)==e['sha256']);check('new source SVG referenced '+e['path'],p.name in new.decode())
newassets=set(str(p.relative_to(ROOT)) for p in (ROOT/'miniprogram/pages/messages/assets').iterdir())-set(e['path'] for e in records if '/assets/' in e['path']);check('only two SVG additions; no new photo/font/assets',newassets==set(e['path'] for e in svgs),{'newAssets':sorted(newassets),'rawBytes':sum(e['bytes'] for e in svgs)})
# New visible unresolved functionality is explicitly read-only/disabled, with no handler.
closed=[n for n in after.iter() if n.attrib.get('class')=='inbox-long-ai-secondary'];check('new one-click source visual explicitly disabled with no handler',len(closed)==1 and closed[0].attrib.get('disabled')=='{{true}}' and not any(k.startswith(('bind','catch','data-')) for k in closed[0].attrib))
check('no new network photo URI in product',new.count(b'https://')==old.count(b'https://'))
report={'scope':'One necessary source/resource/whole-inverse and real action condition preservation check only; not style mirror test, SDK/native/glyph paint/API/full suite.','pass':all(x['pass'] for x in checks),'checks':checks,'protected':protected,'sourceCssObservation':'source-css-observation.json (48 original-source roles; no product CSS projected or compared)','products':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in [ROOT/'miniprogram/pages/messages/messages.wxml',ROOT/'miniprogram/pages/messages/messages.wxss']],'rawNetBytes':len(new)+len(newcss)+sum(e['bytes'] for e in svgs)-len(old)-len(oldcss)}
(DOC/'targeted-source-protection-proof.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'pass':report['pass'],'checkCount':len(checks),'actionNodes':sum(a.values()),'newAssetsRawBytes':sum(e['bytes'] for e in svgs),'rawNetBytes':report['rawNetBytes']},ensure_ascii=False))
