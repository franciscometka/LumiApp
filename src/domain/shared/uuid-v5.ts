import type { ID } from './id';

/**
 * UUID v5 — identificador derivado de um nome, nao sorteado.
 *
 * Existe para que uma ocorrencia de conta recorrente tenha identidade
 * DETERMINISTICA: o mesmo par (recorrencia, mes) produz sempre o mesmo id, em
 * qualquer maquina, em qualquer execucao. E isso que torna a materializacao
 * idempotente sem depender de "procurar antes de criar" — duas chamadas
 * simultaneas calculam o mesmo id e gravam o mesmo registro, em vez de dois.
 *
 * Por que v5 e nao uma string legivel como `rec:bill:month`: os ids deste
 * projeto sao UUID desde a v1, para entrar numa coluna `uuid` do Postgres sem
 * remapeamento. Trocar o formato aqui quebraria essa promessa justamente no
 * campo que vai virar chave primaria com `UNIQUE`.
 *
 * O SHA-1 esta implementado aqui, em ~40 linhas, em vez de vir de uma
 * dependencia. Motivos: `crypto.subtle.digest` e assincrono e contaminaria
 * todo o dominio com `Promise`; o `crypto` do Node nao existe no navegador; e
 * uma biblioteca inteira para uma unica funcao de hash e peso sem retorno.
 * A implementacao e verificada contra os vetores de teste da RFC 3174 e os
 * exemplos de UUID v5 da RFC 4122.
 *
 * SHA-1 aqui NAO tem proposito criptografico. Serve para espalhar um nome em
 * 160 bits de forma estavel; colisao adversarial nao e parte do modelo de
 * ameaca de "qual id tem a conta de internet de outubro".
 */

/** Namespace proprio do Finan, gerado uma vez e fixo para sempre. */
export const FINAN_NAMESPACE = '6f9b1e54-0c7d-4f3a-9a2b-8d5e1c0a7b43';

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

/** SHA-1 de uma sequencia de bytes. Devolve 20 bytes. */
function sha1(bytes: readonly number[]): number[] {
  const message = [...bytes];
  const originalBitLength = message.length * 8;

  // Padding: um bit 1, zeros, e o comprimento em 64 bits big-endian.
  message.push(0x80);
  while (message.length % 64 !== 56) message.push(0);

  // O comprimento cabe em 32 bits nos nossos tamanhos; os 4 bytes altos sao 0.
  message.push(0, 0, 0, 0);
  message.push(
    (originalBitLength >>> 24) & 0xff,
    (originalBitLength >>> 16) & 0xff,
    (originalBitLength >>> 8) & 0xff,
    originalBitLength & 0xff,
  );

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const words = new Array<number>(80);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const b = offset + i * 4;
      words[i] =
        (((message[b] ?? 0) << 24) |
          ((message[b + 1] ?? 0) << 16) |
          ((message[b + 2] ?? 0) << 8) |
          (message[b + 3] ?? 0)) >>>
        0;
    }

    for (let i = 16; i < 80; i += 1) {
      words[i] = rotateLeft(
        (words[i - 3] ?? 0) ^ (words[i - 8] ?? 0) ^ (words[i - 14] ?? 0) ^ (words[i - 16] ?? 0),
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;

      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (rotateLeft(a, 5) + f + e + k + (words[i] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].flatMap((word) => [
    (word >>> 24) & 0xff,
    (word >>> 16) & 0xff,
    (word >>> 8) & 0xff,
    word & 0xff,
  ]);
}

/** UTF-8, para que acentos produzam sempre os mesmos bytes. */
function utf8Bytes(value: string): number[] {
  return [...new TextEncoder().encode(value)];
}

function uuidToBytes(uuid: string): number[] {
  const hex = uuid.replace(/-/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

function bytesToUuid(bytes: readonly number[]): string {
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * UUID v5: SHA-1 do namespace concatenado ao nome, com os bits de versao e
 * variante ajustados conforme a RFC 4122.
 */
export function uuidV5(name: string, namespace: string = FINAN_NAMESPACE): ID {
  const digest = sha1([...uuidToBytes(namespace), ...utf8Bytes(name)]).slice(0, 16);

  // Versao 5 nos 4 bits altos do byte 6.
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  // Variante RFC 4122 nos 2 bits altos do byte 8.
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;

  return bytesToUuid(digest);
}
