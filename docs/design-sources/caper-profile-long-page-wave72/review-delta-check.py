from pathlib import Path
from hashlib import sha256
import json,re,shutil
R=Path('/Users/tsb/Documents/小程序');T=Path('/private/tmp/caper-wave72-profile-long');D=R/'docs/design-sources/caper-profile-long-page-wave72';h=lambda x:sha256(x).hexdigest()
w=R/'miniprogram/pages/me/me.wxml';c=R/'miniprogram/pages/me/me.wxss';ow=(T/'frozen-product-before-review/miniprogram/pages/me/me.wxml').read_bytes();oc=(T/'frozen-product-before-review/miniprogram/pages/me/me.wxss').read_bytes();nw=w.read_bytes();nc=c.read_bytes()
attr=b' hover-class="me-long-privacy-hover"';rule=b'.me-long-privacy-request button.me-long-privacy-hover { text-decoration-line: underline; }\n';before=b'.me-long-public-menus > .me-long-menu + .me-long-menu { margin-top: 16px; }';after=before.replace(b'16px',b'12px')
assert nw.count(attr)==1 and nw.replace(attr,b'',1)==ow
assert nc.count(rule)==1 and nc.count(after)==1 and nc.replace(after,before,1).replace(rule,b'',1)==oc
source=(D/'caper_1-code.html').read_text();assert '<div class="grid grid-cols-1 gap-3">' in source and 'class="text-rose-600 font-bold text-xs hover:underline"' in source
compiled='\n'.join(p.read_text() for p in D.glob('caper_1-style-*.css'))
assert re.search(r'\.gap-3\s*\{\s*gap:\s*(?:0?\.75)rem',compiled)
assert re.search(r'\.hover\\:underline:hover\s*\{[^}]*text-decoration-line:\s*underline',compiled)
proof={'checkerCorrection':'Initial hover declaration regex expected unprefixed property first; cached official CSS has -webkit-text-decoration-line first. Private regex now permits prefix and still requires unprefixed underline in same rule. No product changed for harness correction.', 'scope':'Only two confirmed source review corrections; no repeat 26 source checks / 37 CSS observations / 63 actions / native/business tests.','source':{'parentGrid':'HTML:551 same grid-cols-1 gap-3 owns all four settings cards; compiled gap3=.75rem=12px. Outer space-y4 has only this one grid child, so not a16px inter-card gap.','manualButton':'HTML:735 hover:underline; compiled exact text-decoration-line:underline. Native hover-class is pure presentation.'},'before':{'wxmlSHA':h(ow),'wxssSHA':h(oc)},'after':{'wxml':{'bytes':len(nw),'sha256':h(nw)},'wxss':{'bytes':len(nc),'sha256':h(nc)}},'inverse':{'wxmlEqual':nw.replace(attr,b'',1)==ow,'wxssEqual':nc.replace(after,before,1).replace(rule,b'',1)==oc,'exactAttrCount':nw.count(attr),'exactRuleCount':nc.count(rule),'gapReplacementCount':nc.count(after)},'newProductDeltaBytes':len(nw)-len(ow)+len(nc)-len(oc),'noBusinessChange':'Removing only new hover-class recovers whole initial WXML bytes; CSS inverse recovers whole initial CSS. Prior exact action/guard/core/advanced/JSJSON protection remains historical stage proof, not repeated assertion on a new run.'}
(D/'review-delta-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');(D/'review-delta-check.py').write_bytes(Path(__file__).read_bytes())
basecss=(T/'baseline/miniprogram/pages/me/me.wxss').read_bytes();(D/'append-only.wxss').write_bytes(nc[len(basecss):])
manifest=json.loads((D/'source-manifest.json').read_text());
for p in manifest['product']:
 path=Path(p['path']);p.update(bytes=path.stat().st_size,sha256=h(path.read_bytes()))
manifest['finalReviewCorrections']=proof;(D/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
report=R/'docs/evidence/caper-profile-ordinary-long-page-reference-ui-wave72-2026-10-02.md';s=report.read_text().replace('## 范围与冻结','## 范围与初始冻结',1).replace('账号/通知/帮助/关于 card p14','账号/通知/帮助/关于 card p14',1)
s+='''\n## 独立审查后的最终两处来源修正\n\n根已授权独立审查聚合的两项表现修正：原 settings 四张卡都在同一 `grid-cols-1 gap-3` 中，因此 public help→about 的唯一相邻 margin16改为12 px；既有人工请求按钮只增加 `hover-class="me-long-privacy-hover"`，用准确 `text-decoration-line:underline` 承接 source `hover:underline`。没有改变动作、守卫、文字、JS 或 advanced。\n\n`review-delta-proof.json` / `review-delta-check.py` 仅局部核原 grid 和 hover token，并逆除两个 CSS edits / 一个纯表现属性，whole WXML/CSS 精确恢复上述初始冻结 SHA。初始26检查、37/208 CSS观察、63动作及保护证据保留历史阶段，未重跑它们或全量。初始产品副本与 manifest 保留 `frozen-product-before-review/`、`frozen-owned-paths-before-review.json`；新文件使用最新 frozen manifest。\n\n'''
s+='| 最终产品 | Bytes | SHA-256 |\n| --- | ---: | --- |\n'+f'| me.wxml | {len(nw):,} | `{h(nw)}` |\n| me.wxss | {len(nc):,} | `{h(nc)}` |\n\n'
net=len(nw)-len((T/'baseline/miniprogram/pages/me/me.wxml').read_bytes())+len(nc)-len(basecss);s+=f'最终本批 runtime raw 净增 **{net:,} B**（review纯表现delta +{proof["newProductDeltaBytes"]} B），仍0新资产/字体。最终独立局部复核与根 native SDK / CLI 尚由相应 owner 完成。\n';report.write_text(s)
rows=[]
for name in ['miniprogram/pages/me/me.wxml','miniprogram/pages/me/me.wxss']:
 p=R/name;dst=T/'frozen-product'/name;shutil.copyfile(p,dst);rows.append({'path':name,'bytes':p.stat().st_size,'sha256':h(p.read_bytes()),'frozenPath':str(dst)})
(T/'frozen-product-paths.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
owned=rows+[{'path':str(p.relative_to(R)),'bytes':p.stat().st_size,'sha256':h(p.read_bytes())}for p in sorted(D.glob('*'))]+[{'path':str(report.relative_to(R)),'bytes':report.stat().st_size,'sha256':h(report.read_bytes())}];p=T/'frozen-owned-paths.json';p.write_text(json.dumps(owned,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'product':rows,'netProductBytes':net,'deltaBytes':proof['newProductDeltaBytes'],'ownedManifest':{'path':str(p),'bytes':p.stat().st_size,'sha256':h(p.read_bytes())},'evidence':owned[-1],'sourcePaths':len(list(D.glob('*')))},ensure_ascii=False,indent=2))
