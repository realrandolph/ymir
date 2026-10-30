// Non-destructive browser regression for Color resources and surface-slot authoring.
import {chromium} from 'playwright';
import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import {createAssetServer} from './serve.mjs';
import assert from 'node:assert/strict';
const root=await mkdtemp('/tmp/opencode/ymir-surfaces-');let server,browser;
try{
  for(const file of ['catalog.json','props','models','materials','colors','browser','effects'])await cp(new URL('../'+file,import.meta.url),root+'/'+file,{recursive:true});
  server=createAssetServer({libraryRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox','--use-gl=angle','--use-angle=gl']});
  const page=await browser.newPage({viewport:{width:1300,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/ymir/browser/`);await page.waitForFunction(()=>window.__ymir);
  assert.equal(await page.locator('#type option[value=color]').textContent(),'Colors');
  const id='grwm/lacquer-bottle@1',file=root+'/props/lacquer-bottle/asset.json',original=JSON.parse(await readFile(file,'utf8'));
  const modelFile=root+'/'+original.model,modelBytes=await readFile(modelFile),meshFile=modelFile.replace('model.json','mesh.bin'),mesh=await readFile(meshFile);
  await page.evaluate(id=>window.__ymir.select(window.__ymir.catalog.assets.find(a=>a.id===id)),id);
  assert.ok(await page.locator('#slot-select option').count()>1);assert.ok(await page.locator('#part-select option').count()>2);
  await page.locator('#preview').click();assert.ok(await page.inputValue('#part-select'),'Clicking visible geometry selects an actual model part');
  await page.selectOption('#part-select','part-1');await page.check('#highlight-slot');await page.uncheck('#highlight-slot');
  const slot=await page.inputValue('#slot-select');
  await page.evaluate(()=>window.__ymir.draw());const before=await page.locator('#preview').screenshot();
  await page.selectOption('#slot-material','ymir/cotton@1');
  const blue=await page.evaluate(()=>window.__ymir.catalog.assets.find(a=>a.name==='Solid Blue').id);await page.selectOption('#slot-color',blue);
  await page.evaluate(()=>window.__ymir.draw());assert.notDeepEqual(await page.locator('#preview').screenshot(),before);
  await page.fill('#new-variant-name','Blue Cotton');await page.click('#save-assignment');await page.waitForFunction(()=>document.querySelector('#assignment-error').textContent==='Surface assignment saved.');
  const saved=JSON.parse(await readFile(file,'utf8')),variant=saved.variants.find(v=>v.name==='Blue Cotton');assert.ok(variant);assert.deepEqual(saved.parts,original.parts);assert.deepEqual(saved.slots,original.slots);
  assert.deepEqual(variant.slots.find(s=>s.slotId===slot),{slotId:slot,material:{id:'ymir/cotton@1'},color:{id:blue}});
  assert.deepEqual(await readFile(modelFile),modelBytes);assert.deepEqual(await readFile(meshFile),mesh);
  // Two differently rough gold slots form one pair group and recolor together.
  await page.evaluate(({id,variant})=>window.__ymir.select(window.__ymir.catalog.assets.find(a=>a.id===id),{variant}),{id,variant:original.defaultVariant});
  assert.equal(await page.inputValue('#surface-scope'),'pair');
  const goldGroup=await page.locator('#surface-group option').evaluateAll(options=>options.find(o=>o.textContent.includes('Solid Gold')).value);
  const [goldMaterial,goldColor]=JSON.parse(goldGroup),catalogForGroups=JSON.parse(await readFile(root+'/catalog.json','utf8'));
  const groupSlots=original.slots.filter(s=>s.material.id===goldMaterial&&(s.color?.id??catalogForGroups.assets.find(a=>a.id===s.material.id).defaultColorId)===goldColor);
  assert.ok(groupSlots.length>1);await page.selectOption('#surface-group',goldGroup);
  const whiteGroupColor=catalogForGroups.assets.find(a=>a.name==='Solid White').id;
  await page.selectOption('#slot-color',whiteGroupColor);await page.selectOption('#assignment-target','new-variant');await page.fill('#new-variant-name','Silver Hardware');await page.click('#save-assignment');
  await page.waitForFunction(()=>document.querySelector('#assignment-error').textContent==='Surface assignment saved.');
  const bulkSaved=JSON.parse(await readFile(file,'utf8')),silver=bulkSaved.variants.find(v=>v.name==='Silver Hardware');
  for(const s of groupSlots){const changed=silver.slots.find(t=>t.slotId===s.slotId);assert.equal(changed.color.id,whiteGroupColor);assert.deepEqual(changed.material,s.material,'Each slot preserves its original surface overrides');}
  assert.deepEqual(bulkSaved.slots,original.slots);assert.deepEqual(bulkSaved.parts,original.parts);
  // Individual mode is still available; changing one member splits the pair.
  await page.selectOption('#surface-scope','slot');await page.selectOption('#slot-select',groupSlots[0].slotId);await page.selectOption('#slot-color',goldColor);await page.click('#save-assignment');
  await page.waitForFunction(()=>document.querySelector('#assignment-error').textContent==='Surface assignment saved.');
  const split=JSON.parse(await readFile(file,'utf8')).variants.find(v=>v.id===silver.id);
  assert.equal(split.slots.find(s=>s.slotId===groupSlots[0].slotId).color.id,goldColor);assert.equal(split.slots.find(s=>s.slotId===groupSlots[1].slotId).color.id,whiteGroupColor);
  await page.selectOption('#surface-scope','pair');
  await page.evaluate(()=>window.__ymir.select(window.__ymir.catalog.assets.find(a=>a.id==='grwm/woven-satin@3')));
  assert.equal(await page.inputValue('#swatch-color'),'');
  const colorNames=await page.locator('#swatch-color option').allTextContents();assert.equal(new Set(colorNames).size,colorNames.length);
  await page.selectOption('#swatch-color',blue);await page.click('#save-material-default');await page.waitForFunction(()=>document.querySelector('#material-default-status').textContent.startsWith('Material default Color saved.'));
  assert.equal(await page.inputValue('#swatch-color'),'');
  const updatedCatalog=JSON.parse(await readFile(root+'/catalog.json','utf8'));assert.equal(updatedCatalog.assets.find(a=>a.id==='grwm/woven-satin@3').defaultColorId,blue);
  await page.reload();await page.waitForFunction(()=>window.__ymir);await page.evaluate(id=>window.__ymir.select(window.__ymir.catalog.assets.find(a=>a.id===id)),id);assert.ok((await page.locator('#variant').innerText()).includes('Blue Cotton'));
  await page.click('#new-color');await page.fill('#color-name','Test Forest');await page.selectOption('#color-generator','solid');await page.fill('#color-hex','#228844');await page.click('#save-color');await page.waitForFunction(()=>!document.querySelector('#color-dialog').open);
  let catalog=JSON.parse(await readFile(root+'/catalog.json','utf8'));const forest=catalog.assets.find(a=>a.name==='Test Forest');assert.ok(forest);
  await page.click('#new-color');await page.fill('#color-name','Test Forest Houndstooth');await page.selectOption('#color-generator','houndstooth');await page.selectOption('#color-primary',forest.id);
  const white=catalog.assets.find(a=>a.name==='Solid White');await page.selectOption('#color-secondary',white.id);await page.click('#save-color');await page.waitForFunction(()=>!document.querySelector('#color-dialog').open);
  catalog=JSON.parse(await readFile(root+'/catalog.json','utf8'));const pattern=catalog.assets.find(a=>a.name==='Test Forest Houndstooth');assert.deepEqual(pattern.palette,{primary:forest.id,secondary:white.id});
  for(const material of ['grwm/woven-satin@3','ymir/cotton@1','ymir/hemp@1']){
    await page.selectOption('#swatch-material',material);await page.waitForFunction(id=>document.querySelector('#swatch-material').value===id,material);
    await page.evaluate(async({id,material})=>{await window.__ymir.select(window.__ymir.catalog.assets.find(a=>a.id===id),{previewMaterial:material});window.__ymir.draw();},{id:pattern.id,material});
    assert.equal(await page.locator('#error').textContent(),'');
  }
  assert.deepEqual(errors,[]);console.log('PASS: named parts/slots, live material+Color pairing, new variant persistence, palette and repeating-pattern creation, Silk/Cotton/Hemp compatibility; models and meshes unchanged.');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true});}
