import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const site = path.join(root, 'site');
const catalog = JSON.parse(await readFile(path.join(root, 'catalog.json'), 'utf8'));
const models = catalog.assets.filter(asset => asset.type === 'model');

async function copyFromRoot(relative) {
  const source = path.resolve(root, relative);
  if (source !== root && !source.startsWith(root + path.sep)) throw new Error(`Resource escapes Ymir: ${relative}`);
  const destination = path.join(site, path.relative(root, source));
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const ranked = await Promise.all(models.map(async entry => {
  const manifest = path.resolve(root, entry.manifest);
  const model = JSON.parse(await readFile(manifest, 'utf8'));
  const mesh = path.resolve(path.dirname(manifest), model.mesh);
  const size = (await stat(manifest)).size + (await stat(mesh)).size;
  return { entry, model, manifest, mesh, size };
}));
ranked.sort((a, b) => a.size - b.size || a.entry.id.localeCompare(b.entry.id));
const samples = ranked.slice(0, 5);
if (samples.length !== 5) throw new Error(`Pages needs five Model assets; found ${samples.length}.`);

for (const sample of samples) {
  await copyFromRoot(path.relative(root, sample.manifest));
  await copyFromRoot(path.relative(root, sample.mesh));
}

const demoCatalog = { ...catalog, assets: samples.map(({ entry }) => entry), textures: [] };
await writeFile(path.join(site, 'catalog.json'), `${JSON.stringify(demoCatalog, null, 2)}\n`);

const suitePath = path.resolve(root, catalog.defaultSuite ?? 'materials/ymir-surfaces-v1/suite.json');
const suite = JSON.parse(await readFile(suitePath, 'utf8'));
const suiteResources = [suitePath, suite.vertex, suite.fragment, suite.depth,
  suite.backdropVertex, suite.backdropFragment, suite.colorGenerators,
  ...Object.values(suite.effects ?? {})].filter(Boolean);
for (const resource of suiteResources) {
  const file = typeof resource === 'string' && path.isAbsolute(resource)
    ? resource
    : path.resolve(path.dirname(suitePath), resource);
  await copyFromRoot(path.relative(root, file));
}

console.log('Pages example Models:');
for (const { entry, size } of samples) console.log(`  ${entry.name}: ${size} bytes`);
