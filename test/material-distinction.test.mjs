import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const materials = [
  ['grwm/studio-surface@3', 'materials/surfaces/studio-surface/material.json'],
  ['grwm/woven-satin@3', 'materials/surfaces/woven-satin/material.json'],
  ['grwm/brushed-gold@3', 'materials/surfaces/brushed-gold/material.json'],
];

test('smooth, satin, and brushed metal materials have distinct PBR settings and shader profiles', async () => {
  const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
  const loaded = [];
  for (const [id, manifestPath] of materials) {
    const entry = catalog.assets.find(asset => asset.id === id);
    const manifest = JSON.parse(await readFile(new URL(manifestPath, root), 'utf8'));
    assert.ok(entry, `catalog contains ${id}`);
    assert.equal(entry.profile, manifest.profile, `${id} profile agrees with its manifest`);
    assert.deepEqual(entry.parameters, manifest.parameters, `${id} parameters agree with its manifest`);
    loaded.push(manifest);
  }

  const [smooth, satin, brushed] = loaded;
  assert.deepEqual([smooth.profile, satin.profile, brushed.profile], [0, 1, 10]);
  assert.ok(smooth.parameters.rough < satin.parameters.rough);
  assert.equal(smooth.parameters.metal, 0);
  assert.equal(satin.parameters.metal, 0);
  assert.equal(brushed.parameters.metal, 1);

  const shader = await readFile(new URL('materials/ymir-surfaces-v1/main.frag', root), 'utf8');
  assert.match(shader, /smooth dielectric; keep the finish clean and even/);
  assert.match(shader, /warpPhase=uv\.x\*240\.0/);
  assert.match(shader, /brushPhase=uv\.y\*260\.0/);
  assert.match(shader, /alphaT=max\(\.035,rough\*rough\*2\.0\)/);
  assert.match(shader, /c\+=albedo\*\.12\*satin/);
});
