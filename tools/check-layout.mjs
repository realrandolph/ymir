// Read-only browser checks: viewport shell, title/preview order and real labels.
import {chromium} from 'playwright';
import {createAssetServer} from './serve.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=createAssetServer();let browser;
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox','--use-gl=angle','--use-angle=gl']});
  const page=await browser.newPage(),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/ymir/browser/`);await page.waitForFunction(()=>window.__ymir);
  await page.evaluate(()=>window.__ymir.select(window.__ymir.catalog.assets.find(a=>a.name==='Scalloped Vanity Mirror')));
  const groups=await page.locator('#surface-group option').allTextContents();
  assert.ok(groups.some(g=>g.includes('Polished Metal · Bright Gold')));
  const gold=await page.locator('#surface-group option').evaluateAll(options=>options.find(o=>o.textContent.includes('Bright Gold')).value);
  await page.selectOption('#surface-group',gold);
  assert.equal(await page.locator('#slot-material option:checked').textContent(),'Polished Metal');
  await mkdir(new URL('../reports/',import.meta.url),{recursive:true});
  for(const [width,height] of [[1440,900],[1280,720],[1024,768],[800,600],[390,844]]){
    await page.setViewportSize({width,height});
    const layout=await page.evaluate(()=>{
      const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      const inspector=document.querySelector('#inspector'),list=document.querySelector('#list');
      return {viewport:[innerWidth,innerHeight],bodyScroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],title:rect('.title-row'),preview:rect('#preview'),inspector:rect('#inspector'),adjacent:document.querySelector('.title-row').nextElementSibling.id==='preview',inspectorOverflow:inspector.scrollWidth-inspector.clientWidth,listOverflow:list.scrollWidth-list.clientWidth};
    });
    assert.ok(layout.adjacent,'No UI between title and preview');
    assert.ok(layout.bodyScroll[0]<=width&&layout.bodyScroll[1]<=height,JSON.stringify(layout));
    assert.ok(layout.preview.bottom<=height&&layout.inspector.bottom<=height,JSON.stringify(layout));
    assert.ok(layout.inspectorOverflow<=1&&layout.listOverflow<=1,JSON.stringify(layout));
    assert.ok(layout.preview.top-layout.title.bottom<=1,'Preview directly below title');
    report.push(layout);
    if(width===1280)await page.screenshot({path:new URL('../reports/layout-1280.png',import.meta.url).pathname});
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('../reports/layout.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log('PASS: unchanged polished-metal binding labeled correctly; title directly above preview; viewport-contained layout at five sizes.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
