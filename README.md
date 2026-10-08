# Finan

App de finanças pessoais. Mobile-first, pt-BR, offline por enquanto.

Responde três perguntas, nessa ordem: **quanto eu tenho agora**, **quanto ainda vou gastar** e **para onde o dinheiro está indo**.

## Stack

Next.js 16 (App Router) · TypeScript 6 estrito · Tailwind 4 · TanStack Query · Zustand (só UI) · Zod · Recharts · Vitest

Persistência em `localStorage` atrás de uma camada de portas e adapters, desenhada para trocar por Supabase sem tocar na aplicação.

## Rodando

```bash
npm install
npm run dev
```

| Comando | O quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run build` | Build de produção |

Os quatro últimos são os portões de cada entrega. Nenhum lote fecha com algum deles vermelho.

## Arquitetura

```
src/
  domain/        dinheiro, datas, cálculos, regras — sem React, sem I/O
  data/          portas, adapters, migrações, seed
  features/      casos de uso e telas, por assunto
  components/    UI compartilhada
```

A regra que sustenta o resto: **nenhuma conta de dinheiro acontece em JSX.** Todo cálculo financeiro vive no domínio, é puro e tem teste.

## Decisões que valem conhecer antes de mexer

**Dinheiro é inteiro em centavos**, com tipo nominal `Money`. Entrada do usuário passa por `parseMoney(string)`, que monta os centavos por concatenação — nunca por `Number()`. `moneyFromReais` é proibido em caminho de usuário e em cálculo, e há regra de lint que falha o build.

**Datas são `PlainDate`** (`YYYY-MM-DD`), aritmética civil própria, sem `Date` no domínio. Dia 31 cai em 28/29 de fevereiro por `makePlainDateClamped`. Os testes rodam fixados em `America/Sao_Paulo` para que qualquer regressão a `Date` falhe na hora.

**Ausência de informação não é zero.** Métrica sem base retorna `null` e a tela mostra `—`. Dívida sem prazo informado não exibe "0 de 0"; exibe que não se sabe.

**Dinheiro movido não é dinheiro ganho.** Usar a reserva aumenta o caixa do mês, não a renda gerada. As duas grandezas são separadas em todo cálculo.

**Nada é contado duas vezes, por construção.** A fatura informada de um cartão e as transações vinculadas a ele nunca se somam. Cada gasto recebe exatamente um rótulo de compromisso. Contas recorrentes têm id de ocorrência determinístico (UUID v5 de `recorrência:mês`), então materializar o mesmo mês N vezes cria uma transação só.

**Histórico não muda sozinho.** Alterar uma recorrência vale para meses ainda não lançados; o que já foi gerado é registro. Exclusão é lógica e nunca em cascata.

**Preparar um mês escreve; ler um mês só lê.** Visitar um mês materializa as recorrências dele antes de qualquer número aparecer, por uma única query de preparação por mês (`materialization(mês)`), compartilhada entre telas. O Dashboard de M prepara também M−1, porque compara com ele; o Histórico prepara a janela inteira, nunca além do mês atual. As queries que exibem dados não escrevem.

**Garantia entre abas é do id, não de lock.** O `localStorage` não tem transação entre abas. O que impede duplicata é o id determinístico; a garantia forte entre clientes chega com o Supabase (`PRIMARY KEY` + `ON CONFLICT DO NOTHING`).

## Estado

Lotes 0 a 9 concluídos: fundação, domínio, persistência, casca, Dashboard, Transações, Cartões e Dívidas, Contas recorrentes, Planejamento e Histórico. Próximo: Lote 10 — Ajustes e polimento.
