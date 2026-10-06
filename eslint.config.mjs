import next from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // `moneyFromReais` converte a partir de um float e por isso so e confiavel
    // com constantes auditaveis. O caminho de valores digitados pelo usuario e
    // `parseMoney(string)`, que nunca toca em ponto flutuante.
    // Garantia executavel, nao convencao de comentario.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/domain/shared/money.ts',
      'src/data/seed/**',
      'src/domain/__testing__/**',
      'src/**/*.test.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/shared/money', '@/domain/shared/money', '**/domain/shared'],
              importNames: ['moneyFromReais'],
              message:
                'moneyFromReais converte a partir de float: use apenas em seed e constantes. Para valores do usuario, use parseMoney(string).',
            },
          ],
        },
      ],
    },
  },
];

export default config;
