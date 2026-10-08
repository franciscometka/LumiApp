// Rasteriza os icones do Lumi a partir dos SVGs de public/brand/.
//
//   node scripts/brand/build-assets.mjs   # antes, se a geometria mudou
//   node scripts/brand/render-icons.mjs
//
// Usa o rasterizador que ja vem com o Next (next/og: satori + resvg), sem
// dependencia nova. Saidas:
// - public/brand/icon-192.png, icon-512.png, icon-maskable-512.png (PWA)
// - public/brand/apple-touch-icon.png (180)
// - src/app/apple-icon.png, icon.svg, favicon.ico (convencoes do Next)
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const brand = join(root, 'public', 'brand');
const app = join(root, 'src', 'app');

const { ImageResponse } = await import(
  pathToFileURL(join(root, 'node_modules/next/dist/compiled/@vercel/og/index.node.js')).href
);

/** SVG de public/brand -> PNG quadrado de `size` px. */
async function render(name, size) {
  const svg = readFileSync(join(brand, name));
  const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  const response = new ImageResponse(
    { type: 'img', props: { src, width: size, height: size } },
    { width: size, height: size },
  );
  return Buffer.from(await response.arrayBuffer());
}

/** ICO com PNGs embutidos (aceito por todos os navegadores atuais). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const outputs = [
  ['lumi-app-icon.svg', 192, join(brand, 'icon-192.png')],
  ['lumi-app-icon.svg', 512, join(brand, 'icon-512.png')],
  ['lumi-app-icon-maskable.svg', 512, join(brand, 'icon-maskable-512.png')],
  ['lumi-apple-icon.svg', 180, join(brand, 'apple-touch-icon.png')],
];
for (const [name, size, target] of outputs) writeFileSync(target, await render(name, size));

copyFileSync(join(brand, 'apple-touch-icon.png'), join(app, 'apple-icon.png'));
copyFileSync(join(brand, 'lumi-favicon.svg'), join(app, 'icon.svg'));

const favicons = [];
for (const size of [16, 32, 48]) favicons.push({ size, png: await render('lumi-favicon.svg', size) });
writeFileSync(join(app, 'favicon.ico'), ico(favicons));

console.log('icones gerados:', [...outputs.map(([, , target]) => target), 'src/app/favicon.ico'].length);
