import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const site = path.join(root, 'site');
const catalog = JSON.parse(await readFile(path.join(root, 'catalog.json'), 'utf8'));
const featuredPropIds = [
  'grwm/faceted-crystal@1',
  'grwm/hatc-gold-clip-dc7c5a60a1@3',
  'grwm/floating-polish-applicator-dd40c98553@1',
  'grwm/gift-connecting-silk-881b1bf633@1',
  'grwm/velvet-accessory-tray-668382bd90@2',
];
const entriesById = new Map(catalog.assets.map(asset => [asset.id, asset]));
const featuredProps = featuredPropIds.map(id => {
  const entry = entriesById.get(id);
  if (!entry || entry.type !== 'prop') throw new Error(`Missing featured Ymir Prop: ${id}`);
  return entry;
});

async function copyFromRoot(relative) {
  const source = path.resolve(root, relative);
  if (source !== root && !source.startsWith(root + path.sep)) throw new Error(`Resource escapes Ymir: ${relative}`);
  const destination = path.join(site, path.relative(root, source));
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const modelIds = new Set(featuredProps.map(prop => prop.modelId));
const materialIds = new Set();
const colorIds = new Set();
for (const prop of featuredProps) {
  const asset = JSON.parse(await readFile(path.resolve(root, prop.manifest), 'utf8'));
  for (const slot of [...(asset.slots ?? []), ...(asset.variants ?? []).flatMap(v => v.slots ?? [])]) {
    if (slot.material?.id) materialIds.add(slot.material.id);
    if (slot.color?.id) colorIds.add(slot.color.id);
  }
}
for (const id of materialIds) {
  const material = entriesById.get(id);
  if (!material) throw new Error(`Missing featured Material: ${id}`);
  if (material.defaultColorId) colorIds.add(material.defaultColorId);
}
for (const id of [...colorIds]) {
  const color = entriesById.get(id);
  if (!color) throw new Error(`Missing featured Color: ${id}`);
  for (const paletteId of Object.values(color.palette ?? {})) colorIds.add(paletteId);
}

const models = [...modelIds].map(id => {
  const entry = entriesById.get(id);
  if (!entry || entry.type !== 'model') throw new Error(`Missing featured Model: ${id}`);
  return entry;
});
const resources = [...models, ...featuredProps,
  ...[...materialIds].map(id => entriesById.get(id)),
  ...[...colorIds].map(id => entriesById.get(id))];
for (const entry of resources) {
  if (!entry) throw new Error('A featured Prop resource is missing from the catalog.');
  const manifest = path.resolve(root, entry.manifest);
  await copyFromRoot(path.relative(root, manifest));
  if (entry.type === 'model') {
    const model = JSON.parse(await readFile(manifest, 'utf8'));
    await copyFromRoot(path.relative(root, path.resolve(path.dirname(manifest), model.mesh)));
  }
}

const demoCatalog = { ...catalog, assets: resources, textures: [], aliases: {} };
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

console.log('Pages featured Props:');
for (const entry of featuredProps) {
  const modelEntry = entriesById.get(entry.modelId);
  const manifest = path.resolve(root, modelEntry.manifest);
  const model = JSON.parse(await readFile(manifest, 'utf8'));
  const mesh = path.resolve(path.dirname(manifest), model.mesh);
  const size = (await stat(path.resolve(root, entry.manifest))).size + (await stat(manifest)).size + (await stat(mesh)).size;
  console.log(`  ${entry.name}: ${size} bytes including its model and mesh`);
}
