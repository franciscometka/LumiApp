// Rastreia o simbolo e o wordmark a partir das referencias aprovadas em
// docs/brand/reference/ e grava a geometria em scripts/brand/geometry.json.
//
// A geometria rastreada e a FONTE do desenho: os SVGs finais
// (build-assets.mjs) so recortam, colorem e compoem estes caminhos. Rodar de
// novo produz o mesmo resultado.
//
//   node scripts/brand/trace-reference.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './png.mjs';
import {
  area,
  bounds,
  close,
  contours,
  maskFrom,
  open,
  removeSmall,
  simplifyClosed,
  smooth,
  toPath,
} from './trace.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const reference = (name) => decodePng(readFileSync(join(root, 'docs/brand/reference', name)));

/**
 * O "miolo" branco do neon, sem a borda roxa nem o brilho.
 * - Verde >= 130 pega o corpo branco.
 * - Vermelho >= 183 pega o degrade lilas da ponta da cauda (191,139,251),
 *   que tem verde perto do limite; a borda roxa (~176,117,245) fica de fora.
 */
const isBody = (r, g, b, a) => a > 200 && (g >= 130 || r >= 183);

/**
 * Na ponta da cauda o degrade deixa uma mancha lilas (~179,122,252) colada ao
 * fim da fenda interna. Na referencia ela le como corpo; a fenda verdadeira e
 * o roxo saturado (~158,85,252), que afina ate uma ponta. So nesta zona o
 * limite de verde desce para 110 — no resto do simbolo isso engordaria a
 * borda.
 */
const TAIL_TIP = { x0: 150, x1: 420, y0: 960, y1: 1200 };
const isSymbolBody = (x, y) => (r, g, b, a) => {
  const inTip = x >= TAIL_TIP.x0 && x < TAIL_TIP.x1 && y >= TAIL_TIP.y0 && y < TAIL_TIP.y1;
  return inTip ? a > 200 && g >= 110 : isBody(r, g, b, a);
};

/**
 * Mascara limpa: fecha fissuras de 1 px, descarta respingos do brilho e
 * suaviza degraus. Fechamento maior que 1 px apagaria a fenda fina onde o
 * crescente da cauda afina ate a ponta.
 */
function cleanMask(image, predicate) {
  let m = maskFrom(image, predicate);
  m = close(m, 1);
  m = removeSmall(m, 1, 400);
  m = removeSmall(m, 0, 400);
  m = smooth(m, 2);
  return m;
}

/** Contornos da mascara como um unico path (evenodd), com `transform`. */
function tracePath(m, transform, epsilon = 1.1) {
  return contours(m)
    .map((polygon) => simplifyClosed(polygon, epsilon))
    .filter((polygon) => polygon.length >= 3 && Math.abs(area(polygon)) > 30)
    .map((polygon) => toPath(polygon, { transform }))
    .join('');
}

/** Caixa -> quadrado de `size`, centrado, com margem `pad`. */
function squareFit(box, size, pad) {
  const scale = (size - pad * 2) / Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const offsetX = (size - (box.maxX - box.minX) * scale) / 2;
  const offsetY = (size - (box.maxY - box.minY) * scale) / 2;
  return {
    transform: ([x, y]) => [(x - box.minX) * scale + offsetX, (y - box.minY) * scale + offsetY],
    box: {
      x: offsetX,
      y: offsetY,
      width: (box.maxX - box.minX) * scale,
      height: (box.maxY - box.minY) * scale,
    },
  };
}

const round = (value) => Number(value.toFixed(2));

// ---------------------------------------------------------------- simbolo
const symbolImage = reference('lumi-symbol-reference.png');
const symbol = cleanMask(symbolImage, isSymbolBody);
const symbolBox = bounds(symbol);
const symbolFit = squareFit(symbolBox, 512, 8);
const mark = tracePath(symbol, symbolFit.transform);

/**
 * Versao compacta, para 16-32 px.
 *
 * Mesmo desenho, com as fendas finas fechadas: a separacao entre a bochecha
 * esquerda e a faixa, e o crescente da cauda, tem menos de meio pixel a 16 px
 * e viraria borrao. Fechadas, sobram exatamente os tracos que a 16 px ainda
 * leem — orelhas, a mascara com os olhos e o losango, a faixa e a cauda.
 */
const compactMask = close(symbol, 26);
/**
 * O fechamento tambem grudaria o losango do nariz na faixa do queixo — e o
 * rosto deixaria de ser o mesmo. Entre o nariz e a faixa, a mascara original
 * volta a valer: o losango fica solto, como na referencia.
 */
const NOSE_GAP = { x0: 540, x1: 740, y0: 520, y1: 720 };
for (let y = NOSE_GAP.y0; y < NOSE_GAP.y1; y += 1) {
  for (let x = NOSE_GAP.x0; x < NOSE_GAP.x1; x += 1) {
    const i = y * symbol.width + x;
    compactMask.mask[i] = symbol.mask[i];
  }
}
const compact = tracePath(removeSmall(compactMask, 0, 2000), symbolFit.transform);

// ---------------------------------------------------------------- wordmark
const logoImage = reference('lumi-logo-reference.png');

/**
 * O pingo do "i" e um circulo roxo em degrade: a mascara branca o pega pela
 * metade. Ele sai da mascara das letras (tudo acima do topo da haste) e vira
 * um circulo exato, no centro e raio medidos dos pixels roxos.
 */
const I_COLUMN = { x0: 1435, x1: 1520 };
const I_STEM_TOP = 535;
/**
 * O neon deixa "ombros" e calombos de 3-5 px onde os arcos encontram as
 * hastes. Abertura + fechamento de 6 px removem saliencias e entalhes menores
 * que isso, sem mudar a forma das letras (cantos ganham um raio de ~2% da
 * altura da maiuscula, imperceptivel no uso).
 */
const letters = smooth(
  close(
    open(
      cleanMask(logoImage, (x, y) => (r, g, b, a) => {
        if (x < 740) return false; // o simbolo da referencia do logo fica de fora
        if (x >= I_COLUMN.x0 && x < I_COLUMN.x1 && y < I_STEM_TOP) return false;
        return isBody(r, g, b, a);
      }),
      6,
    ),
    6,
  ),
  2,
);

// O disco do pingo e o que e OPACO (alfa > 240) acima da haste: o brilho em
// volta tem alfa baixo e inflaria o raio, colando o pingo na haste.
let dotSum = [0, 0];
let dotCount = 0;
for (let y = 380; y < 505; y += 1) {
  for (let x = I_COLUMN.x0; x < I_COLUMN.x1 + 10; x += 1) {
    const i = (y * logoImage.width + x) * 4;
    const [, , , a] = logoImage.pixels.subarray(i, i + 4);
    if (a > 240) {
      dotSum = [dotSum[0] + x, dotSum[1] + y];
      dotCount += 1;
    }
  }
}
const dot = {
  cx: round(dotSum[0] / dotCount),
  cy: round(dotSum[1] / dotCount),
  r: round(Math.sqrt(dotCount / Math.PI)),
};

// Simbolo da referencia do logo: so para medir a composicao horizontal.
const logoSymbol = maskFrom(logoImage, (x, _y) => (r, g, b, a) => x < 720 && isBody(r, g, b, a));
const logoSymbolBox = bounds(logoSymbol);
const lettersBox = bounds(letters);

/**
 * As letras sao geometricas: hastes e pes retos. Rastreadas de um PNG com
 * brilho, as retas saem levemente onduladas. Aqui cada vertice a ate 3 px de
 * uma borda MEDIDA na referencia e fixado nela, e a aresta entre dois
 * vertices alinhados vira reta exata. Os arcos (u, m) continuam os rastreados.
 *
 * Medidas em pixels da referencia do logo:
 * - L: haste 747-811, pe ate 922, pe 644-699;
 * - u: hastes 935-991 e 1060-1118;
 * - m: hastes 1142-1196, 1252-1308, 1366-1423;
 * - i: haste 1446-1504;
 * - maiuscula 438, altura de x 513, linha de base 699.
 */
const STEM_X = [747, 811, 922, 935, 991, 1060, 1118, 1142, 1196, 1252, 1308, 1366, 1423, 1446, 1504];
const STEM_Y = [438, 513, 644, 699];
const SNAP = 3;
/** So uma reta deste tamanho conta como haste: o comeco de um arco nao. */
const MIN_STRAIGHT = 16;
function snapLetters(polygon) {
  const n = polygon.length;
  const edgeX = polygon.map(([x]) => STEM_X.find((edge) => Math.abs(edge - x) <= SNAP));
  const edgeY = polygon.map(([, y]) => STEM_Y.find((edge) => Math.abs(edge - y) <= SNAP));
  const straight = new Set();
  const snapX = new Map();
  const snapY = new Map();
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];
    const vertical =
      edgeX[i] !== undefined && edgeX[i] === edgeX[j] && Math.abs(y2 - y1) >= MIN_STRAIGHT;
    const horizontal =
      edgeY[i] !== undefined && edgeY[i] === edgeY[j] && Math.abs(x2 - x1) >= MIN_STRAIGHT;
    if (vertical) {
      straight.add(i);
      snapX.set(i, edgeX[i]);
      snapX.set(j, edgeX[i]);
    }
    if (horizontal) {
      straight.add(i);
      snapY.set(i, edgeY[i]);
      snapY.set(j, edgeY[i]);
    }
  }
  const points = polygon.map(([x, y], i) => [snapX.get(i) ?? x, snapY.get(i) ?? y]);
  return { points, straight };
}

const wordmark = contours(letters)
  .map((polygon) => simplifyClosed(polygon, 1.6))
  .filter((polygon) => polygon.length >= 3 && Math.abs(area(polygon)) > 30)
  .map((polygon) => {
    const { points, straight } = snapLetters(polygon);
    return toPath(points, { transform: ([x, y]) => [x, y], straight });
  })
  .join('');

const geometry = {
  sources: [
    'docs/brand/reference/lumi-symbol-reference.png',
    'docs/brand/reference/lumi-logo-reference.png',
  ],
  mark: {
    viewBox: '0 0 512 512',
    /** Caixa do desenho dentro do quadrado (para compor o logo horizontal). */
    box: Object.fromEntries(Object.entries(symbolFit.box).map(([k, v]) => [k, round(v)])),
    d: mark,
    compact,
  },
  wordmark: {
    /** Coordenadas em pixels da referencia do logo. */
    d: wordmark,
    dot,
    box: lettersBox,
    baseline: 699,
  },
  /** Onde o simbolo fica em relacao as letras, na referencia aprovada. */
  lockup: { symbolBox: logoSymbolBox },
};

writeFileSync(join(here, 'geometry.json'), `${JSON.stringify(geometry, null, 2)}\n`);
console.log(
  `simbolo ${mark.length} · compacto ${compact.length} · wordmark ${wordmark.length} caracteres;`,
  'pingo',
  dot,
  'letras',
  lettersBox,
  'simbolo no logo',
  logoSymbolBox,
);
