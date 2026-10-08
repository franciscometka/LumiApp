// Vetorizacao de uma mascara binaria: contornos -> poligonos simplificados ->
// curvas. Existe para que o simbolo do Lumi seja RASTREADO da referencia
// aprovada, e nao redesenhado a olho: as proporcoes vem da imagem.

/** Mascara a partir de um predicado por pixel. */
export function maskFrom({ width, height, pixels }, predicate) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width;
    const y = (i / width) | 0;
    // O predicado pode depender da posicao: `(x, y) => (r, g, b, a) => bool`.
    const test = predicate.length === 2 ? predicate(x, y) : predicate;
    mask[i] = test(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]) ? 1 : 0;
  }
  return { width, height, mask };
}

/** Distancia (chamfer 3-4, em pixels) ate o pixel mais proximo com valor `target`. */
function distanceTo({ width, height, mask }, target) {
  const INF = 1e9;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i += 1) d[i] = mask[i] === target ? 0 : INF;
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? INF : d[y * width + x]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  }
  for (let i = 0; i < d.length; i += 1) d[i] /= 3;
  return d;
}

export function dilate(m, radius) {
  const d = distanceTo(m, 1);
  return { ...m, mask: Uint8Array.from(d, (v) => (v <= radius ? 1 : 0)) };
}

export function erode(m, radius) {
  const d = distanceTo(m, 0);
  return { ...m, mask: Uint8Array.from(d, (v) => (v > radius ? 1 : 0)) };
}

export const close = (m, r) => erode(dilate(m, r), r);
export const open = (m, r) => dilate(erode(m, r), r);

/** Remove componentes (de `value`) menores que `minArea` pixels. */
export function removeSmall(m, value, minArea) {
  const { width, height } = m;
  const mask = Uint8Array.from(m.mask);
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (seen[start] || mask[start] !== value) continue;
    const component = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop();
      component.push(i);
      const x = i % width;
      const y = (i / width) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (!seen[j] && mask[j] === value) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (component.length < minArea) for (const i of component) mask[i] = 1 - value;
  }
  return { ...m, mask };
}

/**
 * Contornos por marching squares sobre a grade de cantos de pixel. Devolve
 * poligonos fechados nas fronteiras entre 0 e 1, com vertices nos pontos
 * medios das arestas (meio pixel de precisao, suficiente apos suavizar).
 */
export function contours({ width, height, mask }) {
  const v = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]);
  // Segmentos por celula (x,y) com cantos (x-1,y-1)...(x,y).
  const segments = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const add = (a, b) => {
    segments.set(key(a), b);
  };
  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x <= width; x += 1) {
      const tl = v(x - 1, y - 1);
      const tr = v(x, y - 1);
      const br = v(x, y);
      const bl = v(x - 1, y);
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;
      const top = [x, y - 0.5];
      const right = [x + 0.5, y];
      const bottom = [x, y + 0.5];
      const left = [x - 0.5, y];
      // Orientacao consistente: o interior (1) fica a esquerda do sentido.
      switch (code) {
        case 1: add(bottom, left); break;
        case 2: add(right, bottom); break;
        case 3: add(right, left); break;
        case 4: add(top, right); break;
        case 5: add(top, left); add(bottom, right); break;
        case 6: add(top, bottom); break;
        case 7: add(top, left); break;
        case 8: add(left, top); break;
        case 9: add(bottom, top); break;
        case 10: add(left, bottom); add(right, top); break;
        case 11: add(right, top); break;
        case 12: add(left, right); break;
        case 13: add(bottom, right); break;
        case 14: add(left, bottom); break;
      }
    }
  }
  const polygons = [];
  const visited = new Set();
  for (const startKey of segments.keys()) {
    if (visited.has(startKey)) continue;
    const polygon = [];
    let currentKey = startKey;
    while (!visited.has(currentKey)) {
      visited.add(currentKey);
      const [cx, cy] = currentKey.split(',').map(Number);
      polygon.push([cx, cy]);
      const next = segments.get(currentKey);
      if (next === undefined) break;
      currentKey = key(next);
    }
    if (polygon.length >= 8) polygons.push(polygon);
  }
  return polygons;
}

function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

function rdp(points, epsilon) {
  if (points.length < 3) return points;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicular(points[i], points[0], points[points.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= epsilon) return [points[0], points[points.length - 1]];
  return [...rdp(points.slice(0, index + 1), epsilon).slice(0, -1), ...rdp(points.slice(index), epsilon)];
}

/** RDP em poligono fechado: corta no ponto mais distante do primeiro. */
export function simplifyClosed(polygon, epsilon) {
  let far = 0;
  let farDist = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const d = Math.hypot(polygon[i][0] - polygon[0][0], polygon[i][1] - polygon[0][1]);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const first = rdp(polygon.slice(0, far + 1), epsilon);
  const second = rdp([...polygon.slice(far), polygon[0]], epsilon);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** Area com sinal (positiva = sentido horario em coordenadas de tela). */
export function area(polygon) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/**
 * Poligono -> path SVG com curvas. Vertices com virada maior que
 * `cornerDegrees` ficam como cantos vivos (pontas das orelhas, dos olhos, do
 * losango); os demais viram Catmull-Rom convertida em cubicas.
 *
 * `straight`: indices i cujo segmento i -> i+1 deve ser reta exata (hastes
 * das letras). Nas pontas de uma reta, a curva vizinha sai TANGENTE a ela —
 * sem isso, a passagem da haste para o arco ganha um vinco.
 */
export function toPath(polygon, { transform, cornerDegrees = 38, tension = 0.5, straight }) {
  const n = polygon.length;
  const pts = polygon.map(transform);
  const isStraight = (i) => straight?.has(((i % n) + n) % n) === true;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len = (v) => Math.hypot(v[0], v[1]);
  const turn = pts.map((p, i) => {
    const v1 = sub(p, pts[(i - 1 + n) % n]);
    const v2 = sub(pts[(i + 1) % n], p);
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (len(v1) * len(v2) || 1);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
  });

  const unit = (v) => {
    const l = len(v);
    return l === 0 ? [0, 0] : [v[0] / l, v[1] / l];
  };

  /**
   * DIRECAO da tangente no vertice i (unitaria; zero num canto). O tamanho
   * vem do proprio segmento, na montagem da cubica: com a Catmull-Rom
   * uniforme, um segmento longo (uma haste) vizinho de um curto (o comeco de
   * um arco) fazia a curva estufar — os "ombros" no contador do "m".
   */
  const tangent = (i) => {
    if (turn[i] > cornerDegrees) return [0, 0];
    const before = isStraight(i - 1);
    const after = isStraight(i);
    if (before && after) return [0, 0];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    // Na ponta de uma reta, a curva sai tangente a ela.
    if (before) return unit(sub(pts[i], prev));
    if (after) return unit(sub(next, pts[i]));
    return unit(sub(next, prev));
  };

  const f = (value) => Number(value.toFixed(2));
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    if (isStraight(i)) {
      d += `L${f(p2[0])} ${f(p2[1])}`;
      continue;
    }
    const u1 = tangent(i);
    const u2 = tangent((i + 1) % n);
    if (u1[0] === 0 && u1[1] === 0 && u2[0] === 0 && u2[1] === 0) {
      d += `L${f(p2[0])} ${f(p2[1])}`;
    } else {
      const reach = len(sub(p2, p1)) * (tension * 0.72);
      d += `C${f(p1[0] + u1[0] * reach)} ${f(p1[1] + u1[1] * reach)} ${f(p2[0] - u2[0] * reach)} ${f(p2[1] - u2[1] * reach)} ${f(p2[0])} ${f(p2[1])}`;
    }
  }
  return `${d}Z`;
}

/** Caixa delimitadora dos pixels 1. */
export function bounds({ width, height, mask }) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
}

/**
 * Suaviza a borda da mascara: desfoque de caixa (3 passadas ~ gaussiano) e
 * novo limiar em 0,5. Apaga degraus de 1-2 px sem mudar a forma.
 */
export function smooth(m, radius) {
  const { width, height } = m;
  let values = Float32Array.from(m.mask);
  const pass = (src, horizontal) => {
    const out = new Float32Array(src.length);
    const size = radius * 2 + 1;
    const lines = horizontal ? height : width;
    const len = horizontal ? width : height;
    for (let line = 0; line < lines; line += 1) {
      const at = (k) => {
        const c = Math.max(0, Math.min(len - 1, k));
        return horizontal ? src[line * width + c] : src[c * width + line];
      };
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += at(k);
      for (let k = 0; k < len; k += 1) {
        const index = horizontal ? line * width + k : k * width + line;
        out[index] = sum / size;
        sum += at(k + radius + 1) - at(k - radius);
      }
    }
    return out;
  };
  for (let i = 0; i < 3; i += 1) values = pass(pass(values, true), false);
  return { ...m, mask: Uint8Array.from(values, (v) => (v >= 0.5 ? 1 : 0)) };
}
