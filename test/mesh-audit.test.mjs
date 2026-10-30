import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('mesh audit ignores appearance and vertex ordering, but preserves topology and UVs',()=>{
  const output=execFileSync('python3',['-c',`
import importlib.util
spec=importlib.util.spec_from_file_location('audit','tools/audit_meshes.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
v=[(0,0,0,0,0,1,0,0),(1,0,0,0,0,1,1,0),(0,1,0,0,0,1,0,1)]
h=m.triangle_hash(v,[0,1,2])
assert h==m.triangle_hash([v[2],v[0],v[1]],[1,2,0])
assert h!=m.triangle_hash(v,[0,2,1])
assert h!=m.triangle_hash(v,[0,1,2,0,1,2])
w=list(v);w[0]=(*v[0][:6],.5,.5)
assert h!=m.triangle_hash(w,[0,1,2])
assert m.triangle_hash([x[:3] for x in v],[0,1,2])==m.triangle_hash([x[:3] for x in w],[0,1,2])
print('PASS')
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(output.trim(),'PASS');
});
