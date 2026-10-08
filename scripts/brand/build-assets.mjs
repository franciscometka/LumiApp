// Compoe os SVGs oficiais do Lumi a partir da geometria rastreada
// (geometry.json) e gera a pagina de previa docs/brand/preview.html.
//
//   node scripts/brand/trace-reference.mjs   # so quando a referencia mudar
//   node scripts/brand/build-assets.mjs
//
// As cores saem dos MESMOS tokens do app (src/app/globals.css): a marca e a
// interface falam o mesmo roxo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const geometry = JSON.parse(readFileSync(join(here, 'geometry.json'), 'utf8'));
const out = join(root, 'public', 'brand');
mkdirSync(out, { recursive: true });

// ------------------------------------------------------------------ cores
/** OKLCH -> sRGB hex (mesma conversao do navegador, sem mapeamento de gama). */
function oklchToHex(l, c, hDegrees) {
  const h = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return `#${linear
    .map((v) => {
      const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

/** Le um token `--nome: oklch(l c h)` de um bloco do globals.css. */
function token(block, name) {
  const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
  const start = css.indexOf(block === 'dark' ? '.dark {' : ':root {');
  const match = css.slice(start).match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`));
  if (match === null) throw new Error(`token ${name} (${block}) nao encontrado`);
  return oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

export const COLORS = {
  /** Roxo do tema claro: acento sobre fundo claro. */
  primaryLight: token('light', 'primary'),
  /** Roxo do tema escuro: acento sobre fundo escuro. */
  primaryDark: token('dark', 'primary'),
  /** Tinta das versoes claras = texto do tema claro. */
  ink: token('light', 'foreground'),
  /** Fundo escuro do app: base do icone. */
  night: token('dark', 'background'),
  white: '#ffffff',
};

// --------------------------------------------------------------- formas
const { mark, wordmark, lockup } = geometry;

const svg = (viewBox, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}">` +
  `<title>${title}</title>${body}</svg>\n`;

const markPath = (fill, compact = false) =>
  `<path fill="${fill}" fill-rule="evenodd" d="${compact ? mark.compact : mark.d}"/>`;

/**
 * Simbolo sozinho, em `currentColor`: quem usa decide a cor. O app tem tema
 * escolhido a mao, que pode divergir do sistema operacional; por isso nada
 * aqui depende de `prefers-color-scheme`. Como <img> isolado, sai preto.
 */
function standaloneMark(compact) {
  return svg(
    mark.viewBox,
    `<path fill="currentColor" fill-rule="evenodd" d="${compact ? mark.compact : mark.d}"/>`,
    'Lumi',
  );
}

// Wordmark: caixa das letras + o pingo, com respiro.
const dot = wordmark.dot;
const wordTop = Math.min(wordmark.box.minY, dot.cy - dot.r);
const wordRight = Math.max(wordmark.box.maxX, dot.cx + dot.r);
const WORD_PAD = 8;
const wordViewBox = [
  wordmark.box.minX - WORD_PAD,
  Math.floor(wordTop - WORD_PAD),
  Math.ceil(wordRight - wordmark.box.minX + WORD_PAD * 2),
  Math.ceil(wordmark.box.maxY - wordTop + WORD_PAD * 2),
].join(' ');

const letters = (ink, accent) =>
  `<path fill="${ink}" fill-rule="evenodd" d="${wordmark.d}"/>` +
  `<circle fill="${accent}" cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}"/>`;

/**
 * Logo horizontal com a composicao da referencia aprovada: o simbolo ocupa a
 * mesma caixa que ocupa la (altura e posicao relativas as letras), e o
 * espaco entre simbolo e "L" e o mesmo.
 */
const target = lockup.symbolBox;
const scale = (target.maxY - target.minY) / mark.box.height;
const markWidth = mark.box.width * scale;
// Alinha a direita do simbolo onde ela esta na referencia: preserva o vao ate o "L".
const tx = target.maxX - markWidth - mark.box.x * scale;
const ty = target.minY - mark.box.y * scale;
const LOCKUP_PAD = 24;
const lockupLeft = target.maxX - markWidth;
const lockupViewBox = [
  Math.floor(lockupLeft - LOCKUP_PAD),
  target.minY - LOCKUP_PAD,
  Math.ceil(wordRight - lockupLeft + LOCKUP_PAD * 2),
  target.maxY - target.minY + LOCKUP_PAD * 2,
].join(' ');

const lockupBody = (ink, accent) =>
  `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})">${markPath(ink)}</g>` +
  letters(ink, accent);

/**
 * Icone do app. Quadrado escuro (o fundo do tema escuro), simbolo branco e um
 * halo roxo MUITO discreto atras — o unico lugar da marca com brilho, porque
 * na tela inicial do celular o icone precisa de presenca.
 *
 * `maskable`: sem cantos (o sistema recorta) e com o simbolo dentro da zona
 * segura de 80%.
 */
function appIcon({ maskable = false, compact = false, markScale = maskable ? 0.56 : 0.68 } = {}) {
  const size = 512;
  const offset = (size - size * markScale) / 2;
  const halo =
    `<defs><radialGradient id="h" cx="50%" cy="46%" r="50%">` +
    `<stop offset="0" stop-color="${COLORS.primaryDark}" stop-opacity="0.34"/>` +
    `<stop offset="0.55" stop-color="${COLORS.primaryDark}" stop-opacity="0.10"/>` +
    `<stop offset="1" stop-color="${COLORS.primaryDark}" stop-opacity="0"/>` +
    `</radialGradient></defs>`;
  const background = maskable
    ? `<rect width="${size}" height="${size}" fill="${COLORS.night}"/>`
    : `<rect width="${size}" height="${size}" rx="112" fill="${COLORS.night}"/>`;
  return svg(
    `0 0 ${size} ${size}`,
    `${halo}${background}<rect width="${size}" height="${size}" rx="${maskable ? 0 : 112}" fill="url(#h)"/>` +
      `<g transform="translate(${offset} ${offset}) scale(${markScale})">${markPath(COLORS.white, compact)}</g>`,
    'Lumi',
  );
}

/** Favicon: o icone com o simbolo compacto e margem menor (cada pixel conta). */
function favicon() {
  const size = 512;
  const markScale = 0.78;
  const offset = (size - size * markScale) / 2;
  return svg(
    `0 0 ${size} ${size}`,
    `<rect width="${size}" height="${size}" rx="120" fill="${COLORS.night}"/>` +
      `<g transform="translate(${offset} ${offset}) scale(${markScale})">${markPath(COLORS.white, true)}</g>`,
    'Lumi',
  );
}

/**
 * Apple touch icon: o iOS recorta os cantos e nao aceita transparencia, entao
 * o fundo vai ate a borda, com o halo e o simbolo do icone principal.
 */
function appleIcon() {
  return appIcon({ maskable: true, markScale: 0.64 });
}

const files = {
  'lumi-mark.svg': standaloneMark(false),
  'lumi-mark-compact.svg': standaloneMark(true),
  'lumi-wordmark-dark.svg': svg(wordViewBox, letters(COLORS.white, COLORS.primaryDark), 'Lumi'),
  'lumi-wordmark-light.svg': svg(wordViewBox, letters(COLORS.ink, COLORS.primaryLight), 'Lumi'),
  'lumi-logo-horizontal-dark.svg': svg(lockupViewBox, lockupBody(COLORS.white, COLORS.primaryDark), 'Lumi'),
  'lumi-logo-horizontal-light.svg': svg(lockupViewBox, lockupBody(COLORS.ink, COLORS.primaryLight), 'Lumi'),
  'lumi-app-icon.svg': appIcon(),
  'lumi-app-icon-maskable.svg': appIcon({ maskable: true }),
  'lumi-favicon.svg': favicon(),
  'lumi-apple-icon.svg': appleIcon(),
};

for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);

// Geometria para os componentes React (BrandMark/BrandLogo): so formas, sem
// cor — no app a cor vem do tema, via `currentColor` e `fill-primary`.
/** String TS com aspas simples, no estilo do projeto. */
const q = (value) => `'${value}'`;
const lockupTransform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})`;
writeFileSync(
  join(root, 'src/components/brand/brand-geometry.ts'),
  `/**
 * GERADO por scripts/brand/build-assets.mjs a partir da referencia aprovada
 * (docs/brand/reference/). Nao editar a mao: rode o script.
 */
export const MARK_VIEW_BOX = ${q(mark.viewBox)};
/** Simbolo completo. */
export const MARK_PATH =
  ${q(mark.d)};
/** Simbolo compacto, para 32 px ou menos: fendas finas fechadas. */
export const MARK_COMPACT_PATH =
  ${q(mark.compact)};

export const LOCKUP_VIEW_BOX = ${q(lockupViewBox)};
export const LOCKUP_SIZE = { width: ${lockupViewBox.split(' ')[2]}, height: ${lockupViewBox.split(' ')[3]} } as const;
/** Posicao do simbolo (viewBox 512) dentro do logo horizontal. */
export const LOCKUP_MARK_TRANSFORM = ${q(lockupTransform)};
export const WORDMARK_PATH =
  ${q(wordmark.d)};
export const WORDMARK_DOT = { cx: ${dot.cx}, cy: ${dot.cy}, r: ${dot.r} } as const;
`,
);

console.log('cores', COLORS);
console.log('arquivos', Object.keys(files).map((name) => `${name} (${files[name].length} B)`).join(', '));

// ------------------------------------------------------------------ previa
const inline = (name) => files[name].replace(/<\?xml[^>]*>/, '');
const preview = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lumi — prévia da identidade</title>
<style>
  :root { --night: ${COLORS.night}; --ink: ${COLORS.ink}; --p: ${COLORS.primaryLight}; --pd: ${COLORS.primaryDark}; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #f6f5f9; color: var(--ink); }
  header { padding: 32px 24px 8px; max-width: 1080px; margin: 0 auto; }
  h1 { margin: 0; font-size: 22px; }
  header p { margin: 4px 0 0; color: #6b6878; }
  main { max-width: 1080px; margin: 0 auto; padding: 16px 24px 48px; display: grid; gap: 16px; }
  section { border-radius: 16px; overflow: hidden; border: 1px solid #e4e2ea; background: #fff; }
  section > h2 { margin: 0; padding: 12px 16px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #6b6878; border-bottom: 1px solid #eceaf1; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .tile { padding: 28px; display: grid; place-items: center; gap: 12px; min-height: 220px; }
  .tile small { color: inherit; opacity: .6; }
  .dark { background: var(--night); color: #fff; }
  .light { background: #fff; color: var(--ink); }
  .tile svg { display: block; }
  .mark svg { width: 160px; height: 160px; }
  .mark.dark svg path { fill: #fff; } .mark.light svg path { fill: var(--ink); }
  .logo svg { width: 100%; max-width: 420px; height: auto; }
  .icons { display: flex; gap: 24px; align-items: end; flex-wrap: wrap; justify-content: center; }
  .icons figure { margin: 0; display: grid; gap: 6px; justify-items: center; }
  .icons figcaption { font-size: 12px; opacity: .65; }
  .safe { position: relative; }
  .safe::after { content: ""; position: absolute; inset: 10%; border: 1px dashed #ffffff66; border-radius: 50%; pointer-events: none; }
  canvas.px { image-rendering: pixelated; image-rendering: crisp-edges; border-radius: 4px; }
  .sizes { display: flex; gap: 20px; align-items: end; flex-wrap: wrap; justify-content: center; }
  .ref img { width: 200px; height: auto; background: #000; border-radius: 12px; }
  .note { padding: 12px 16px; color: #6b6878; border-top: 1px solid #eceaf1; }
</style>
</head>
<body>
<header>
  <h1>Lumi — prévia da identidade vetorial</h1>
  <p>Símbolo rastreado da referência aprovada (docs/brand/reference/), limpo e vetorizado. Roxo = <code>--primary</code> do app (${COLORS.primaryLight} no claro, ${COLORS.primaryDark} no escuro).</p>
</header>
<main>
  <section>
    <h2>Referência × vetor</h2>
    <div class="row">
      <div class="tile ref dark"><img src="reference/lumi-symbol-reference.png" alt="Referência aprovada"><small>Referência aprovada</small></div>
      <div class="tile mark dark">${inline('lumi-mark.svg')}<small>Vetor limpo</small></div>
    </div>
  </section>

  <section>
    <h2>Símbolo completo</h2>
    <div class="row">
      <div class="tile mark dark">${inline('lumi-mark.svg')}<small>Sobre escuro</small></div>
      <div class="tile mark light">${inline('lumi-mark.svg')}<small>Sobre claro</small></div>
    </div>
  </section>

  <section>
    <h2>Símbolo compacto (16–32 px)</h2>
    <div class="row">
      <div class="tile mark dark">${inline('lumi-mark-compact.svg')}<small>Sobre escuro</small></div>
      <div class="tile mark light">${inline('lumi-mark-compact.svg')}<small>Sobre claro</small></div>
    </div>
    <div class="note">Mesmo desenho, com as fendas finas fechadas: a 16 px elas teriam menos de meio pixel e virariam borrão.</div>
  </section>

  <section>
    <h2>Logo horizontal</h2>
    <div class="row">
      <div class="tile logo dark">${inline('lumi-logo-horizontal-dark.svg')}<small>Dark</small></div>
      <div class="tile logo light">${inline('lumi-logo-horizontal-light.svg')}<small>Light</small></div>
    </div>
  </section>

  <section>
    <h2>Wordmark</h2>
    <div class="row">
      <div class="tile logo dark">${inline('lumi-wordmark-dark.svg')}</div>
      <div class="tile logo light">${inline('lumi-wordmark-light.svg')}</div>
    </div>
  </section>

  <section>
    <h2>App icon / PWA</h2>
    <div class="tile light icons">
      <figure>${inline('lumi-app-icon.svg').replace('<svg ', '<svg width="160" height="160" ')}<figcaption>App icon 512</figcaption></figure>
      <figure class="safe">${inline('lumi-app-icon-maskable.svg').replace('<svg ', '<svg width="160" height="160" ')}<figcaption>Maskable (zona segura tracejada)</figcaption></figure>
      <figure>${inline('lumi-app-icon.svg').replace('<svg ', '<svg width="60" height="60" ')}<figcaption>60 px</figcaption></figure>
    </div>
  </section>

  <section>
    <h2>Favicon — 16 e 32 px reais, ampliados para inspeção</h2>
    <div class="tile light sizes" id="favicons"></div>
    <div class="note">Cada quadro é o ícone rasterizado no tamanho real (16 ou 32 px) e ampliado 8× sem suavização — é exatamente o que a aba do navegador mostra.</div>
  </section>
</main>
<script>
  const sources = {
    'Favicon (compacto)': ${JSON.stringify(files['lumi-favicon.svg'])},
    'Símbolo completo (comparação)': ${JSON.stringify(appIcon().replace(/rx="112"/g, 'rx="120"'))},
  };
  const host = document.getElementById('favicons');
  for (const [label, source] of Object.entries(sources)) {
    for (const size of [16, 32]) {
      const image = new Image();
      image.onload = () => {
        const small = document.createElement('canvas');
        small.width = small.height = size;
        small.getContext('2d').drawImage(image, 0, 0, size, size);
        const big = document.createElement('canvas');
        big.className = 'px';
        big.width = big.height = size * 8;
        const ctx = big.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, size * 8, size * 8);
        const figure = document.createElement('figure');
        figure.style.margin = '0';
        figure.innerHTML = '<figcaption style="font-size:12px;opacity:.65;text-align:center">' + label + ' · ' + size + ' px</figcaption>';
        figure.prepend(big);
        host.append(figure);
      };
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    }
  }
</script>
</body>
</html>
`;
writeFileSync(join(root, 'docs', 'brand', 'preview.html'), preview);
console.log('previa: docs/brand/preview.html');
