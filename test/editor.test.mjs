import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createAssetServer} from '../tools/serve.mjs';
test('metadata editor persists names, protects geometry and references, and deletes variants/assets',async()=>{
  const root=await mkdtemp(new URL('./editor-fixture-',import.meta.url));
  await mkdir(root+'/props');
  const prop={schemaVersion:1,type:'prop',id:'prop',name:'Bottle',mesh:'mesh.bin',nodes:[{material:{id:'mat'},vertex_count:1}],defaultVariant:'ivory',variants:[{id:'ivory',name:'Ivory',overrides:[{material:{id:'mat'}}]},{id:'gold',name:'Gold',overrides:[{material:{id:'mat'}}]}]};
  const entries=[{id:'prop',type:'prop',name:'Bottle',manifest:'props/asset.json'},{id:'mat',type:'material',name:'Silk',manifest:'material.json'}];
  await writeFile(root+'/props/asset.json',JSON.stringify(prop));await writeFile(root+'/props/mesh.bin','mesh');
  await writeFile(root+'/material.json',JSON.stringify({id:'mat',type:'material',name:'Silk'}));
  await writeFile(root+'/catalog.json',JSON.stringify({assets:entries,textures:[],aliases:{}}));
  const server=createAssetServer({libraryRoot:root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=id=>fetch(base+'/api/asset?id='+id).then(r=>r.json());
  const {token}=await fetch(base+'/api/session').then(r=>r.json());
  const send=(id,method,input,extra={})=>fetch(base+'/api/asset?id='+id,{method,headers:{'content-type':'application/json','x-ymir-token':token,...extra},body:JSON.stringify(input)});
  try{
    let state=await get('prop');
    assert.equal((await send('prop','PUT',{revision:state.revision,metadata:{name:'Bottle',description:'',tags:[],nodes:[]}})).status,400);
    assert.equal((await send('prop','PUT',{revision:state.revision,metadata:{name:'Bottle',description:'',tags:[]}},{origin:'https://evil.example'})).status,403);
    assert.equal((await send('prop','PUT',{revision:state.revision,metadata:{name:'Polish Bottle',description:'A reusable prop',tags:['beauty']}})).status,200);
    const changed=JSON.parse(await readFile(root+'/props/asset.json','utf8'));assert.deepEqual(changed.nodes,prop.nodes);assert.deepEqual(changed.variants,prop.variants);
    assert.equal((await send('prop','DELETE',{revision:state.revision})).status,409);
    state=await get('prop');
    assert.equal((await send('prop','PUT',{revision:state.revision,variantId:'gold',metadata:{name:'Warm Gold',description:'Golden finish',tags:['warm']}})).status,200);
    state=await get('prop');assert.equal(state.variants[1].name,'Warm Gold');
    const mat=await get('mat');assert.equal((await send('mat','DELETE',{revision:mat.revision})).status,409);
    assert.equal((await send('prop','DELETE',{revision:state.revision,variantId:'ivory'})).status,200);
    state=await get('prop');assert.equal(state.variants.length,1);
    assert.equal((await send('prop','DELETE',{revision:state.revision,variantId:'gold'})).status,409);
    assert.equal((await send('prop','DELETE',{revision:state.revision})).status,200);
    assert.equal((await fetch(base+'/api/asset?id=prop')).status,404);
    assert.equal((await send('mat','DELETE',{revision:mat.revision})).status,200);
    assert.deepEqual(JSON.parse(await readFile(root+'/catalog.json','utf8')).assets,[]);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true});}
});
