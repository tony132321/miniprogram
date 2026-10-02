const fs=require('fs'),crypto=require('crypto');
const {chromium}=require('/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const root='/Users/tsb/Documents/小程序', dir='/private/tmp/caper-wave72-profile-long';
const tw=fs.readFileSync('/private/tmp/caper-wave69-font-audit/tailwind-cdn.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const props=['fontFamily','fontSize','lineHeight','fontWeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','gap','width','height','borderRadius','borderTopWidth','borderTopColor','boxShadow','backgroundColor','backgroundImage','color','filter','transitionDuration','transitionTimingFunction','pointerEvents','maxWidth'];
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {const context=await browser.newContext({viewport:{width:390,height:844}});const blocked=[];
await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith('https://cdn.tailwindcss.com'))return route.fulfill({status:200,body:tw,contentType:'application/javascript'});blocked.push({url,type:route.request().resourceType()});return route.abort();});
const source=await context.newPage();await source.setContent(fs.readFileSync(root+'/docs/design-sources/caper-profile-long-page-wave72/caper_1-code.html','utf8'),{waitUntil:'load'});
await source.waitForFunction(()=>[...document.querySelectorAll('style')].some(x=>x.textContent.includes('.shadow-soft')));
const product=await context.newPage();const app=fs.readFileSync(root+'/miniprogram/app.wxss','utf8'),css=fs.readFileSync(root+'/miniprogram/pages/me/me.wxss','utf8').replace(/([\d.]+)rpx\b/g,(_,v)=>(Number(v)*390/750)+'px');
// This browser projection checks CSS cascade only. Native custom elements / data / guards are not executed.
const rawWXML=fs.readFileSync(root+'/miniprogram/pages/me/me.wxml','utf8');
const longProjection=rawWXML.slice(rawWXML.indexOf('<view class="me-long-reference">'),rawWXML.indexOf('<button class="advanced-toggle'))+rawWXML.slice(rawWXML.indexOf('<view class="me-long-reference me-long-public-menus">'),rawWXML.lastIndexOf('</view>'));
await product.setContent('<style>view,block{display:block}text{display:inline}image{display:inline-block}button{font-family:inherit}'+app+css+'</style>'+longProjection.replace(/<([\w-]+)([^>]*)\/>/g,'<$1$2></$1>'),{waitUntil:'load'});
const observe=async(page,selector,idx=0)=>page.locator(selector).nth(idx).evaluate((el,props)=>{const c=getComputedStyle(el);return {tag:el.tagName,classes:el.className,text:el.textContent.trim(),values:Object.fromEntries(props.map(p=>[p,c[p]]))};},props);
const cases=[
['host heading','[data-purpose="hosted-activities"] h2','.me-long-section:nth-child(2) .me-long-heading',['fontSize','lineHeight','fontWeight','color','gap']],
['heading marker','[data-purpose="hosted-activities"] h2 span','.me-long-section:nth-child(2) .section-mark',['width','height','borderRadius','backgroundColor']],
['host link','[data-purpose="hosted-activities"] a','.me-long-section:nth-child(2) .me-long-link',['fontSize','lineHeight','fontWeight','color','gap']],
['host card','[data-purpose="hosted-activities"] > div:nth-child(2)','.me-long-hosted',['paddingTop','paddingRight','paddingBottom','paddingLeft','gap','borderRadius','borderTopWidth','borderTopColor','boxShadow','backgroundColor']],
['host photo','[data-purpose="hosted-activities"] > div:nth-child(2) > div:first-child','.me-long-hosted-photo',['width','height','borderRadius']],
['host title','[data-purpose="hosted-activities"] h3','.me-long-hosted .hosted-title',['fontSize','lineHeight','fontWeight','color']],
['host active status','[data-purpose="hosted-activities"] h3 + span','.me-long-hosted-status',['fontSize','lineHeight','fontWeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius']],
['host date','[data-purpose="hosted-activities"] p:nth-child(2)','.me-long-hosted .hosted-date',['fontSize','lineHeight','fontWeight','color','marginTop']],
['host place','[data-purpose="hosted-activities"] p:nth-child(3)','.me-long-hosted-place',['fontSize','lineHeight','fontWeight','color','marginTop']],
['host note truthful instead of members','[data-purpose="hosted-activities"] span.font-medium','.me-long-hosted .hosted-note',['fontSize','lineHeight','fontWeight','color']],
['tool header','[data-purpose="host-tools"] h2','.me-long-tools-heading .me-long-heading',['fontSize','lineHeight','fontWeight','color','gap']],
['tool helper','[data-purpose="host-tools"] p','.me-long-tool-subtitle',['fontSize','lineHeight','fontWeight','color','marginTop']],
['tool grid','[data-purpose="host-tools"] > div:nth-child(2)','.me-long-tools',['gap']],
['tool card','[data-purpose="host-tools"] button','.me-long-tools > button',['paddingTop','paddingBottom','borderRadius','borderTopWidth','borderTopColor','boxShadow','backgroundColor','transitionDuration','transitionTimingFunction']],
['tool circle','[data-purpose="host-tools"] button > div','.me-long-tools > button > view',['width','height','borderRadius','backgroundColor','color','fontSize','lineHeight','fontWeight','marginBottom']],
['tool label','[data-purpose="host-tools"] button > span','.me-long-tools > button > text',['fontSize','lineHeight','fontWeight','color']],
['account card','[data-purpose="settings-lists"] > div > div:first-child','.me-long-account-menu',['paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','borderTopWidth','borderTopColor','boxShadow','backgroundColor']],
['account heading','[data-purpose="settings-lists"] h3','.me-long-account-menu .me-long-menu-heading',['fontSize','lineHeight','fontWeight','color','marginBottom']],
['account marker','[data-purpose="settings-lists"] h3 > span > span','.me-long-account-menu .me-long-menu-marker',['width','height','borderRadius','backgroundColor']],
['account row','[data-purpose="settings-lists"] > div > div:first-child > div > div','.me-long-account-menu button',['fontSize','lineHeight','paddingTop','paddingBottom','color']],
['account row gap','[data-purpose="settings-lists"] > div > div:first-child > div > div:nth-child(2)','.me-long-account-menu .me-long-menu-rows',[]],
['help row gap','[data-purpose="settings-lists"] a[href="#feedback"]','.me-long-help-menu .me-long-menu-rows',[]],
['help row','[data-purpose="settings-lists"] a[href="#faq"]','.me-long-help-menu button',['fontSize','lineHeight','paddingTop','paddingBottom','color']],
['about row','[data-purpose="settings-lists"] a[href="#user-agreement"]','.me-long-about-menu button:nth-child(2)',['fontSize','lineHeight','paddingTop','paddingBottom','color']],
['invite card','[data-purpose="referral-banner"] > div','.me-long-invite',['paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','backgroundImage','color','boxShadow']],
['invite orb','[data-purpose="referral-banner"] > div > div:first-child','.me-long-invite-orb',['width','height','borderRadius','backgroundColor','filter','pointerEvents']],
['invite copy width','[data-purpose="referral-banner"] > div > div:nth-child(2)','.me-long-invite-copy',['maxWidth']],
['invite title','[data-purpose="referral-banner"] span.font-black','.me-long-invite-title > text:nth-child(2)',['fontSize','lineHeight','fontWeight','letterSpacing','color','marginTop']],
['invite emoji','[data-purpose="referral-banner"] span.text-base','.me-long-invite-title > text:first-child',['fontSize','lineHeight','fontWeight','color','marginTop']],
['invite description','[data-purpose="referral-banner"] p','.me-long-invite-description',['fontSize','lineHeight','fontWeight','color','marginTop']],
['invite button','[data-purpose="referral-banner"] button','.me-long-invite-button',['fontSize','lineHeight','fontWeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','backgroundColor','color','boxShadow','transitionDuration','transitionTimingFunction']],
['danger heading','[data-purpose="danger-zone"] > div:first-child','.me-long-danger-heading',['fontSize','lineHeight','fontWeight','letterSpacing','color','paddingLeft','paddingRight','marginBottom']],
['logout','[data-purpose="danger-zone"] > div:nth-child(2) > button','.me-long-logout',['fontSize','lineHeight','fontWeight','paddingTop','paddingBottom','borderRadius','borderTopWidth','borderTopColor','boxShadow','backgroundColor','color','transitionDuration','transitionTimingFunction']],
['manual request panel','[data-purpose="danger-zone"] > div:nth-child(2) > div','.me-long-privacy-request',['paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','borderTopWidth','borderTopColor','backgroundColor']],
['manual request button','[data-purpose="danger-zone"] > div:nth-child(2) > div button','.me-long-privacy-request button',['fontSize','lineHeight','fontWeight','color']],
['manual request helper','[data-purpose="danger-zone"] > div:nth-child(2) > div p','.me-long-privacy-request > text',['fontSize','lineHeight','fontWeight','color','marginTop']],
['foot','[data-purpose="danger-zone"] + div','.me-long-foot',['fontSize','lineHeight','fontWeight','letterSpacing','color','paddingTop','paddingBottom']]
];
const observations=[];for(const [name,s,p,keys]of cases){const a=await observe(source,s),b=await observe(product,p);observations.push({name,sourceSelector:s,productSelector:p,keys,source:a,product:b,differences:keys.filter(k=>a.values[k]!==b.values[k]).map(k=>({property:k,source:a.values[k],product:b.values[k]}))});}
const styles=await source.locator('style').allTextContents();styles.forEach((s,i)=>fs.writeFileSync(dir+'/caper_1-style-'+i+'.css',s));
const result={scope:'CSS cascade only; no WeChat compilation/native layout/data execution/fonts/images/glyph paint/clicks/SDK/full suite. Product rpx legacy rules projected at 390/750 only to resolve cascade.',sourceHTMLSHA:sha(fs.readFileSync(root+'/docs/design-sources/caper-profile-long-page-wave72/caper_1-code.html')),productWXMLSHA:sha(fs.readFileSync(root+'/miniprogram/pages/me/me.wxml')),productWXSSSHA:sha(fs.readFileSync(root+'/miniprogram/pages/me/me.wxss')),tailwindSHA:sha(tw),browserVersion:browser.version(),observations,differences:observations.flatMap(o=>o.differences.map(d=>({name:o.name,...d}))),blocked};
fs.writeFileSync(dir+'/source-cascade-observation.json',JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify({comparisons:observations.length,properties:observations.reduce((n,o)=>n+o.keys.length,0),differences:result.differences},null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{process.stderr.write(String(e)+'\n');process.exitCode=1});
