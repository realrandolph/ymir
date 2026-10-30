import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateMesh } from 'trinity';

const root = new URL('../', import.meta.url);
const propId = 'grwm/hatc-gold-clip-dc7c5a60a1@3';

test('hinged barrette has a closed shell, working mesh ranges, and all three finishes', async () => {
  const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
  const propEntry = catalog.assets.find(asset => asset.id === propId);
  assert.ok(propEntry, 'latest hinged barrette is listed');
  const prop = JSON.parse(await readFile(new URL(propEntry.manifest, root), 'utf8'));
  assert.deepEqual(prop.variants.map(variant => variant.name), ['Gold', 'Silver', 'Tortoise Shell']);

  const silver = prop.variants.find(variant => variant.id === 'silver');
  const tortoise = prop.variants.find(variant => variant.id === 'tortoise-shell');
  assert.equal(silver.slots.length, 2);
  assert.equal(tortoise.slots.length, 1);
  for (const slot of [...silver.slots, ...tortoise.slots]) {
    assert.ok(catalog.assets.some(asset => asset.id === slot.material.id), `material ${slot.material.id} exists`);
    assert.ok(catalog.assets.some(asset => asset.id === slot.color.id), `color ${slot.color.id} exists`);
  }

  const model = JSON.parse(await readFile(new URL(prop.model, root), 'utf8'));
  assert.equal(model.parts.length, 3);
  assert.ok(model.parts.some(part => /shell/i.test(part.name)));
  assert.ok(model.parts.some(part => /spring arm/i.test(part.name)));
  assert.ok(model.parts.some(part => /hinge.*catch/i.test(part.name)));
  const meshFile = new URL(model.mesh, new URL(prop.model, root));
  const bytes = await readFile(meshFile);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), model.meshSha256);
  const raw = Uint8Array.from(bytes).buffer;
  validateMesh(raw, model.parts);
  const shell = model.parts.find(part => /shell/i.test(part.name));
  assert.ok(shell.index_count >= 6984, 'shell includes end-cap triangles');
});

test('Pages features the Ribboned Gift Case with both appearances instead of the ribbon-only model', async () => {
  const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
  const copyTool = await readFile(new URL('tools/copy-pages-assets.mjs', root), 'utf8');
  assert.match(copyTool, /'grwm\/gift-case@1'/);
  assert.doesNotMatch(copyTool, /'grwm\/gift-connecting-silk-881b1bf633@1'/);

  const entry = catalog.assets.find(asset => asset.id === 'grwm/gift-case@1');
  assert.ok(entry, 'Ribboned Gift Case is in the library catalog');
  assert.deepEqual(entry.variants.map(variant => variant.name), [
    'Ivory Case · Blue Ribbon',
    'Blue Case · Ivory Ribbon',
  ]);
  const prop = JSON.parse(await readFile(new URL(entry.manifest, root), 'utf8'));
  const modelEntry = catalog.assets.find(asset => asset.id === prop.modelId);
  assert.ok(modelEntry, 'gift case model is in the library catalog');
  const model = JSON.parse(await readFile(new URL(modelEntry.manifest, root), 'utf8'));
  const mesh = await readFile(new URL(model.mesh, new URL(modelEntry.manifest, root)));
  assert.equal(createHash('sha256').update(mesh).digest('hex'), model.meshSha256);
  validateMesh(Uint8Array.from(mesh).buffer, model.parts);
  assert.ok(model.parts.length > 1, 'gift case is a multi-part model');
});
