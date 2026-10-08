import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { isUuid } from './id';
import { FINAN_NAMESPACE, uuidV5 } from './uuid-v5';

/**
 * Vetores determinísticos de fora do projeto.
 *
 * Testar uma implementacao de hash contra si mesma nao prova nada — qualquer
 * erro vira "o esperado". Os valores abaixo vem dos namespaces padrao da
 * RFC 4122, cujos resultados sao publicados e reproduzidos por toda
 * implementacao correta de UUID v5.
 */

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

describe('uuidV5 — vetores conhecidos', () => {
  it('reproduz os valores canonicos do namespace DNS', () => {
    expect(uuidV5('www.example.com', DNS_NAMESPACE)).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
    expect(uuidV5('example.com', DNS_NAMESPACE)).toBe('cfbff0d1-9375-5685-968c-48ce8b15ae17');
  });

  it('reproduz o valor canonico do namespace URL', () => {
    expect(uuidV5('http://www.example.com/', URL_NAMESPACE)).toBe(
      'fcde3c85-2270-590f-9e7c-ee003d65e0e2',
    );
  });
});

/**
 * Verificacao cruzada contra o OpenSSL.
 *
 * Mais forte do que qualquer vetor fixo: compara a implementacao deste
 * arquivo com o SHA-1 do `node:crypto` sobre centenas de entradas, incluindo
 * as que cruzam as fronteiras de bloco do algoritmo. Se os dois concordam em
 * todas, o hash esta certo.
 *
 * O `node:crypto` aparece SOMENTE aqui, no teste. O codigo de producao roda no
 * navegador e nao pode depender dele — e `crypto.subtle` e assincrono, o que
 * contaminaria o dominio inteiro com `Promise`.
 */
function uuidV5ViaOpenSsl(name: string, namespace: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const digest = createHash('sha1')
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, 'utf8')]))
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

describe('concorda com o SHA-1 do OpenSSL', () => {
  it('em todos os comprimentos de 0 a 200', () => {
    for (let length = 0; length <= 200; length += 1) {
      const name = 'a'.repeat(length);
      expect(uuidV5(name), `comprimento ${String(length)}`).toBe(
        uuidV5ViaOpenSsl(name, FINAN_NAMESPACE),
      );
    }
  });

  it('com acentos, simbolos e nomes reais de ocorrencia', () => {
    const nomes = [
      'internet:2026-10',
      'água e esgoto:2026-02',
      'Café ☕:2027-01',
      '4b1c0d2e-0005-4a10-8f01-000000000001:2026-12',
      '',
      ':',
      'com espaço e tabulação\t',
    ];

    for (const nome of nomes) {
      expect(uuidV5(nome), nome).toBe(uuidV5ViaOpenSsl(nome, FINAN_NAMESPACE));
    }
  });

  it('nos tres namespaces', () => {
    for (const ns of [FINAN_NAMESPACE, DNS_NAMESPACE, URL_NAMESPACE]) {
      expect(uuidV5('teste', ns)).toBe(uuidV5ViaOpenSsl('teste', ns));
    }
  });
});

describe('formato', () => {
  it('produz UUID valido, aceito por isUuid', () => {
    for (const name of ['a', 'internet:2026-10', '', 'çãé', 'x'.repeat(500)]) {
      const id = uuidV5(name);
      expect(isUuid(id), `"${name}" gerou "${id}"`).toBe(true);
    }
  });

  it('marca versao 5 e variante RFC 4122', () => {
    const id = uuidV5('qualquer coisa');
    // 15o caractere hexadecimal e a versao; o 20o carrega a variante.
    expect(id[14]).toBe('5');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });
});

describe('determinismo', () => {
  it('a mesma entrada produz sempre a mesma saida', () => {
    const uma = uuidV5('bill-123:2026-10');
    for (let i = 0; i < 50; i += 1) {
      expect(uuidV5('bill-123:2026-10')).toBe(uma);
    }
  });

  it('entradas diferentes produzem saidas diferentes', () => {
    const ids = new Set(
      ['2026-09', '2026-10', '2026-11', '2027-10'].map((mes) => uuidV5(`bill-123:${mes}`)),
    );
    expect(ids.size).toBe(4);
  });

  it('recorrencias diferentes no mesmo mes nao colidem', () => {
    expect(uuidV5('bill-a:2026-10')).not.toBe(uuidV5('bill-b:2026-10'));
  });

  it('namespaces diferentes produzem resultados diferentes', () => {
    expect(uuidV5('x', DNS_NAMESPACE)).not.toBe(uuidV5('x', URL_NAMESPACE));
    expect(uuidV5('x', FINAN_NAMESPACE)).not.toBe(uuidV5('x', DNS_NAMESPACE));
  });

  it('nao confunde nomes por concatenacao', () => {
    // "ab" + "c" nao pode dar o mesmo que "a" + "bc".
    expect(uuidV5('ab:c')).not.toBe(uuidV5('a:bc'));
  });

  it('e sensivel a acentos de forma estavel', () => {
    const uma = uuidV5('água');
    expect(uuidV5('água')).toBe(uma);
    expect(uuidV5('agua')).not.toBe(uma);
  });
});

describe('tamanhos de entrada que cruzam blocos de 64 bytes', () => {
  it('produz UUID valido em comprimentos criticos do padding', () => {
    // 55/56/57 e 63/64/65 sao as fronteiras onde o padding do SHA-1 muda de
    // comportamento e adiciona um bloco inteiro.
    for (const length of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120]) {
      const id = uuidV5('x'.repeat(length));
      expect(isUuid(id), `comprimento ${String(length)}`).toBe(true);
    }
  });

  it('comprimentos vizinhos nao colidem', () => {
    const ids = new Set([55, 56, 57, 63, 64, 65].map((n) => uuidV5('x'.repeat(n))));
    expect(ids.size).toBe(6);
  });
});
