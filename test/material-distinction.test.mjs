import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const materials = [
  ['grwm/studio-surface@3', 'materials/surfaces/studio-surface/material.json'],
  ['grwm/woven-satin@3', 'materials/surfaces/woven-satin/material.json'],
  ['grwm/brushed-gold@3', 'materials/surfaces/brushed-gold/material.json'],
  ['grwm/velvet-fuzz@3', 'materials/surfaces/velvet-fuzz/material.json'],
  ['grwm/reflective-surface@3', 'materials/surfaces/reflective-surface/material.json'],
];

test('smooth, satin, and brushed metal materials have distinct PBR settings and shader profiles', async () => {
  const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
  const suite = JSON.parse(await readFile(new URL('materials/ymir-surfaces-v1/suite.json', root), 'utf8'));
  const catalogMaterials = catalog.assets.filter(asset => asset.type === 'material');
  const usedProfiles = new Set();
  if (catalog.assets.some(asset => asset.id === 'grwm/pressed-pigment@3')) assert.equal(catalogMaterials.length, 26);
  for (const entry of catalogMaterials) {
    assert.ok(!usedProfiles.has(entry.profile), `material profile ${entry.profile} is unique`);
    usedProfiles.add(entry.profile);
    assert.equal(suite.profiles[entry.profile], entry.id, `${entry.id} occupies its shader profile`);
    const manifest = JSON.parse(await readFile(new URL(entry.manifest, root), 'utf8'));
    assert.equal(manifest.profile, entry.profile);
    assert.deepEqual(manifest.parameters, entry.parameters);
    assert.equal(manifest.description, entry.description);
  }

  const loaded = [];
  for (const [id, manifestPath] of materials) {
    const entry = catalog.assets.find(asset => asset.id === id);
    const manifest = JSON.parse(await readFile(new URL(manifestPath, root), 'utf8'));
    assert.ok(entry, `catalog contains ${id}`);
    assert.equal(entry.profile, manifest.profile, `${id} profile agrees with its manifest`);
    assert.deepEqual(entry.parameters, manifest.parameters, `${id} parameters agree with its manifest`);
    loaded.push(manifest);
  }

  const [smooth, satin, brushed, velvet, mirror] = loaded;
  assert.deepEqual([smooth.profile, satin.profile, brushed.profile, velvet.profile, mirror.profile], [0, 1, 10, 4, 3]);
  assert.ok(smooth.parameters.rough < satin.parameters.rough);
  assert.equal(smooth.parameters.metal, 0);
  assert.equal(satin.parameters.metal, 0);
  assert.equal(brushed.parameters.metal, 1);
  assert.ok(velvet.parameters.rough >= .9);
  assert.equal(velvet.parameters.metal, 0);
  assert.equal(velvet.defaultColorId, 'ymir/color-086d55461ff86a@1');
  assert.ok(mirror.parameters.rough <= .12);
  assert.equal(mirror.parameters.metal, 1);
  assert.equal(mirror.defaultColorId, 'ymir/palette-7aad1b191a8b0d@1');
  assert.ok(catalog.assets.some(asset => asset.type === 'color' && asset.id === mirror.defaultColorId));

  const shader = await readFile(new URL('materials/ymir-surfaces-v1/main.frag', root), 'utf8');
  const app = await readFile(new URL('browser/app.js', root), 'utf8');
  assert.match(shader, /taps\[9\]=vec2\[9\]/);
  assert.match(shader, /smooth dielectric; keep the finish clean and even/);
  assert.match(shader, /warpPhase=uv\.x\*240\.0/);
  assert.match(shader, /brushCoord=original_pos\.x/);
  assert.match(shader, /alphaT=max\(\.035,rough\*rough\*2\.0\)/);
  assert.match(shader, /c\+=albedo\*\.12\*satin/);
  assert.match(shader, /pilePos=original_pos\.xz/);
  assert.match(shader, /metalness<\.5\)albedo=mix/);
  assert.match(shader, /cotton: matte, regular crossed plain weave/);
  assert.match(shader, /hemp: coarse irregular crossed fibres/);
  assert.match(app, /nodes:isMaterialSwatch\?\[\]:previewNodes/);
  assert.match(app, /transition:previewTransition/);
  assert.match(app, /shadowSize:2048/);
});
