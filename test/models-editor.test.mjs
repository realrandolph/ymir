import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createAssetServer} from '../tools/serve.mjs';
test('model deletion is reference-protected and prop deletion leaves shared geometry intact',async()=>{
  const root=await mkdtemp(new URL('./model-fixture-',import.meta.url));await mkdir(root+'/models');
  const model={schemaVersion:2,type:'model',id:'model',name:'Shared Model',mesh:'mesh.bin',parts:[]};
  const prop=id=>({schemaVersion:2,type:'prop',id,name:id,modelId:'model',model:'models/model.json',parts:[],defaultVariant:'default',variants:[{id:'default',name:'Finish',bindings:[]}]});
  const assets=[{id:'model',type:'model',name:model.name,manifest:'models/model.json'},...['prop-a','prop-b'].map(id=>({id,type:'prop',name:id,modelId:'model',manifest:id+'.json'}))];
  await writeFile(root+'/models/model.json',JSON.stringify(model));await writeFile(root+'/models/mesh.bin','geometry');
  for(const id of ['prop-a','prop-b'])await writeFile(root+'/'+id+'.json',JSON.stringify(prop(id)));
  await writeFile(root+'/catalog.json',JSON.stringify({assets,textures:[],aliases:{}}));
  const server=createAssetServer({libraryRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const get=id=>fetch(base+'/api/asset?id='+id).then(r=>r.json());const {token}=await fetch(base+'/api/session').then(r=>r.json());
  const del=async(id,scope)=>{const state=await get(id);return fetch(base+'/api/asset?id='+id,{method:'DELETE',headers:{'content-type':'application/json','x-ymir-token':token},body:JSON.stringify({revision:state.revision,scope})});};
  try{
    assert.equal((await get('model')).dependents.length,2);
    assert.equal((await del('model','model')).status,409);
    assert.equal((await del('prop-a','model')).status,400);
    assert.equal((await del('prop-a','prop')).status,200);
    assert.equal(await readFile(root+'/models/mesh.bin','utf8'),'geometry');
    assert.equal((await del('model','model')).status,409);
    assert.equal((await del('prop-b','prop')).status,200);
    assert.equal((await del('model','model')).status,200);
    await assert.rejects(readFile(root+'/models/mesh.bin'));
  }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true});}
});
