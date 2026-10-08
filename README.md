<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/lumi-logo-horizontal-dark.svg">
    <img src="public/brand/lumi-logo-horizontal-light.svg" alt="Lumi" height="56">
  </picture>
</p>

# Lumi — Finanças com mais clareza

[![CI](https://github.com/franciscometka/financeapp/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/franciscometka/financeapp/actions/workflows/ci.yml)

App de finanças pessoais. Mobile-first, pt-BR, offline.

Responde três perguntas, nessa ordem: **quanto eu tenho agora**, **quanto ainda vou gastar** e **para onde o dinheiro está indo**.

## Stack

Next.js 16 (App Router) · TypeScript 6 estrito · Tailwind 4 · TanStack Query · Zustand (só UI) · Zod · Recharts · Vitest

Persistência em `localStorage` atrás de uma camada de portas e adapters, desenhada para trocar por Supabase sem tocar na aplicação.

## Rodando

Requer **Node 22** (fixado em `.nvmrc` e em `engines`).

```bash
npm ci
npm run dev
```

Use `npm ci`, não `npm install`: ele instala exatamente o que está no `package-lock.json`, igual em qualquer PC e no CI.

| Comando | O quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run build` | Build de produção |

Os quatro últimos são os portões de cada entrega, e o [CI](.github/workflows/ci.yml) roda os quatro em todo push e pull request para `master`, com `TZ=America/Sao_Paulo`.

## Onde ficam os dados

**No `localStorage` do navegador.** Eles não vão para o GitHub e não acompanham o código: outro PC ou outro navegador começa com os dados de demonstração.

Para levar os dados, guardar uma cópia ou restaurar: **Mais → Ajustes → Dados**.

- **Exportar backup** baixa um `lumi-backup-AAAA-MM-DD.json` no formato oficial do banco.
- **Importar backup** valida o arquivo inteiro, mostra o que ele contém e só substitui os dados depois da sua confirmação. Arquivo inválido não grava nada; os dados atuais ficam intactos.
- **Apagar dados** remove transações, planos, cartões, dívidas e recorrências. Categorias e preferências ficam, e os dados de demonstração não voltam.

## Arquitetura

```
src/
  domain/        dinheiro, datas, cálculos, regras — sem React, sem I/O
  data/          portas, adapters, migrações, seed
  features/      casos de uso e telas, por assunto
  components/    UI compartilhada
```

A regra que sustenta o resto: **nenhuma conta de dinheiro acontece em JSX.** Todo cálculo financeiro vive no domínio, é puro e tem teste.

## As duas contas do app

O Lumi mantém duas identidades, de propósito, e cada tela usa os nomes da sua:

| | Fórmula | Transferências | Onde |
|---|---|---|---|
| **Caixa** | Entradas − Saídas = Saldo | entram | Início |
| **Atividade econômica** | Renda gerada − Gastos operacionais = Economia do mês | ficam fora | Planejamento, Histórico |

Mover dinheiro próprio — usar a reserva, guardar uma sobra — muda o caixa e não muda a atividade econômica. Por isso:

- **renda ≠ transferência**: R$ 100 vindos da reserva aumentam as Entradas, não a renda gerada;
- **gasto operacional ≠ transferência**: R$ 500 guardados aumentam as Saídas, não os gastos — não consomem o limite do plano, não aparecem no gráfico de categorias, não aceleram a projeção do mês e não viram "gastou X% a mais";
- **economia do mês = renda gerada − gastos operacionais**, nunca o saldo.

## Decisões que valem conhecer antes de mexer

**Dinheiro é inteiro em centavos**, com tipo nominal `Money`. Entrada do usuário passa por `parseMoney(string)`, que monta os centavos por concatenação — nunca por `Number()`. `moneyFromReais` é proibido em caminho de usuário e em cálculo, e há regra de lint que falha o build.

**Datas são `PlainDate`** (`YYYY-MM-DD`), aritmética civil própria, sem `Date` no domínio. Dia 31 cai em 28/29 de fevereiro por `makePlainDateClamped`.

**Ausência de informação não é zero.** Métrica sem base retorna `null` e a tela mostra `—`.

**Nada é contado duas vezes, por construção.** A fatura informada de um cartão e as transações vinculadas a ele nunca se somam. Cada gasto recebe exatamente um rótulo de compromisso.

**Recorrência é molde; transação é histórico.** Contas recorrentes têm id de ocorrência determinístico (UUID v5 de `recorrência:mês`), então materializar o mesmo mês N vezes cria uma transação só. Alterar uma recorrência vale para meses ainda não lançados; o que já foi gerado é registro. Ocorrências nascem pendentes — data passada não é prova de pagamento. Exclusão é lógica e nunca em cascata, e uma ocorrência excluída não volta.

**Preparar um mês escreve; ler um mês só lê.** Visitar um mês materializa as recorrências dele antes de qualquer número aparecer, por uma única query de preparação por mês, compartilhada entre telas. O Início de M prepara também M−1, porque compara com ele; o Histórico prepara a janela inteira, nunca além do mês atual.

**Garantia entre abas é do id, não de lock.** O `localStorage` não tem transação entre abas. O que impede duplicata é o id determinístico; a garantia forte entre clientes chega com o Supabase (`PRIMARY KEY` + `ON CONFLICT DO NOTHING`).

## Marca

Símbolo, logo e ícones vivem em `public/brand/`, rastreados da referência aprovada em `docs/brand/reference/`. Nada é desenhado à mão: os scripts geram tudo, em Node puro, sem dependência nova.

```bash
node scripts/brand/trace-reference.mjs   # só se a referência mudar
node scripts/brand/build-assets.mjs      # SVGs, prévia e src/components/brand/brand-geometry.ts
node scripts/brand/render-icons.mjs      # PNGs do PWA, apple-icon e favicon.ico
```

No app, use `BrandMark` e `BrandLogo` (`src/components/brand/`). Eles são inline e em `currentColor`, então seguem o tema escolhido no app, nunca o do sistema. A prévia da identidade está em `docs/brand/preview.html`.

**Identificadores legados.** O projeto se chamava Finan. Três identificadores internos mantêm o nome antigo de propósito, porque mudá-los perderia dados ou cache: a chave `finan:db` do `localStorage`, o namespace UUID v5 (`FINAN_NAMESPACE`) e a raiz `['finan']` das query keys. Eles nunca aparecem para o usuário. Não migre.

## Estado

**v1 concluída** (lotes 0 a 10): Início, Transações, Planejamento, Cartões, Dívidas, Contas recorrentes, Histórico e Ajustes.

Evolução depois da v1, sem data:

- sincronização com Supabase (multi-dispositivo sem backup manual);
- gestão de categorias;
- paginação e busca entre meses — hoje cada lista é de um mês, filtrada em memória, e o volume não justifica;
- mostrar "quanto cabe por dia até o próximo salário": o domínio já calcula (`salaryRunway`), nenhuma tela exibe ainda;
- reservas como contas reais, quando houver mais de uma.

## Vulnerabilidades conhecidas

`npm audit` aponta 5 alertas *high*, todos do mesmo pacote: `braces`, que chega por `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob@3.3.1` → `micromatch`.

- São dependências **de desenvolvimento** (lint). Não entram no bundle entregue.
- O alerta vale para todas as versões de `braces`; não há versão corrigida, e até `eslint-config-next@16.4.0` a cadeia é a mesma.
- A única "correção" que o npm oferece (`audit fix --force`) faz downgrade para `eslint-config-next@14`, incompatível com o Next 16. **Não rode.**

Por isso `npm audit` não é portão do CI. Reavaliar quando o `eslint-config-next` atualizar a cadeia.
