import type { RecurringBill } from '../entities/recurring-bill';
import { dueDateInMonth, isActiveInMonth } from '../entities/recurring-bill';
import type { Transaction } from '../entities/transaction';
import type { ID } from '../shared/id';
import type { MonthKey } from '../shared/plain-date';
import { monthKeyOf } from '../shared/plain-date';
import { uuidV5 } from '../shared/uuid-v5';

/**
 * ============================================================================
 * Materializacao de contas recorrentes — a DECISAO, nao a escrita.
 * ============================================================================
 *
 * Este modulo e puro. Ele recebe as recorrencias, as transacoes que ja existem
 * no mes e o mes; devolve a lista do que FALTA criar. Quem grava e o adapter,
 * e e la que a transacao do banco acontece.
 *
 * ## Identidade deterministica
 *
 * Cada ocorrencia tem id derivado de `(recorrencia, mes)`, nao sorteado:
 *
 *     occurrenceId(billId, month) = uuidV5(`${billId}:${month}`)
 *
 * Disso decorre toda a idempotencia. Cinco aberturas do app, StrictMode,
 * refresh, duas chamadas em paralelo — todas calculam o MESMO id. Mesmo que
 * duas passem pela verificacao ao mesmo tempo, as duas escrevem o mesmo
 * registro: a segunda sobrescreve a primeira em vez de criar uma segunda
 * Internet de outubro.
 *
 * E por isso que a garantia NAO e "procurar e depois criar". Procurar antes de
 * criar tem uma janela entre as duas operacoes; id determinstico nao tem
 * janela, porque o resultado de duas corridas e indistinguivel de uma.
 *
 * No Supabase isso vira `PRIMARY KEY` com `ON CONFLICT DO NOTHING` — a mesma
 * garantia, imposta pelo banco, sem redesenhar o caso de uso.
 *
 * ## Por que `lastGeneratedMonth` NAO e usado aqui
 *
 * A politica e materializar sob demanda, e os meses sao visitados fora de
 * ordem. Visitar novembro e depois setembro, com a regra
 * `month > lastGeneratedMonth`, pularia setembro para sempre — o campo
 * registra o maior mes gerado, nao o conjunto dos gerados, e nao existe
 * otimizacao segura em cima dele neste modelo.
 *
 * O campo continua no schema (remove-lo exigiria migracao) mas o materializador
 * o ignora por completo. Correcao vale mais que micro-otimizacao.
 *
 * ## Ocorrencia excluida bloqueia regeneracao
 *
 * A verificacao considera transacoes com `deletedAt` preenchido. Excluir a
 * Internet de outubro e recarregar nao a traz de volta — o id continua
 * ocupado. Fosse uma busca entre as nao-excluidas, o app recriaria todo
 * refresh o lancamento que a pessoa acabou de apagar.
 */

/**
 * Identidade de uma ocorrencia. Ninguem deve montar essa string a mao: a
 * forma do nome e detalhe interno e mudar o formato mudaria todos os ids.
 */
export function occurrenceId(recurringBillId: ID, month: MonthKey): ID {
  return uuidV5(`${recurringBillId}:${month}`);
}

/** O que o adapter precisa gravar. Sem id de usuario: quem persiste resolve. */
export interface OccurrenceDraft {
  /** Determinstico. E a chave da idempotencia. */
  readonly id: ID;
  readonly recurringBillId: ID;
  readonly description: string;
  readonly amountCents: Transaction['amountCents'];
  readonly type: Transaction['type'];
  readonly flow: Transaction['flow'];
  readonly categoryId: ID;
  readonly date: Transaction['date'];
  readonly status: Transaction['status'];
  readonly paymentMethod: Transaction['paymentMethod'];
  readonly cardId?: ID;
  readonly debtId?: ID;
}

export interface MaterializationPlan {
  readonly month: MonthKey;
  /** Ocorrencias que faltam criar. Vazio quando o mes ja esta em dia. */
  readonly toCreate: readonly OccurrenceDraft[];
  /** Recorrencias vigentes no mes que ja tinham ocorrencia. */
  readonly alreadyPresent: readonly ID[];
}

export interface MaterializationInput {
  readonly bills: readonly RecurringBill[];
  /**
   * Transacoes do mes, **incluindo as excluidas logicamente**. Sem as
   * excluidas, o plano recriaria o que o usuario apagou.
   */
  readonly existing: readonly Transaction[];
  readonly month: MonthKey;
}

/**
 * Decide o que falta criar. Pura, sem efeito, sem relogio.
 *
 * Uma ocorrencia e considerada existente por DOIS caminhos:
 *
 * 1. uma transacao com o id determinstico — o criterio normal;
 * 2. uma transacao com aquele `recurringBillId` e data dentro do mes — o
 *    criterio de compatibilidade.
 *
 * O segundo existe porque ha dados anteriores a este modelo: as ocorrencias
 * criadas pelo seed e por versoes antigas tem id sorteado, e so o criterio (1)
 * as ignoraria e geraria uma SEGUNDA Internet de outubro. Ele nunca permite
 * uma duplicata — so pode impedir uma criacao — entao nao reintroduz a janela
 * de corrida: o id continua sendo a garantia.
 */
export function planMaterialization({
  bills,
  existing,
  month,
}: MaterializationInput): MaterializationPlan {
  const existingIds = new Set(existing.map((transaction) => transaction.id));

  // Recorrencias que ja tem ocorrencia neste mes por vinculo, com qualquer id.
  const linkedBillIds = new Set(
    existing
      .filter(
        (transaction) =>
          transaction.recurringBillId !== undefined && monthKeyOf(transaction.date) === month,
      )
      .map((transaction) => transaction.recurringBillId as ID),
  );

  const toCreate: OccurrenceDraft[] = [];
  const alreadyPresent: ID[] = [];

  for (const bill of bills) {
    // Cobre inativa, excluida, antes do inicio e depois do `endMonth`.
    if (!isActiveInMonth(bill, month)) continue;

    const id = occurrenceId(bill.id, month);

    if (existingIds.has(id) || linkedBillIds.has(bill.id)) {
      alreadyPresent.push(bill.id);
      continue;
    }

    toCreate.push({
      id,
      recurringBillId: bill.id,
      description: bill.description,
      amountCents: bill.amountCents,
      type: bill.type,
      /**
       * Sempre `operational`.
       *
       * Uma recorrencia representa dinheiro que entra ou sai de verdade todo
       * mes — salario, internet, assinatura. Transferencia entre contas
       * proprias nao vira renda operacional so por ser repetida; se um dia
       * existir recorrencia de transferencia, sera configuracao explicita da
       * recorrencia, nao um padrao silencioso daqui.
       */
      flow: 'operational',
      categoryId: bill.categoryId,
      date: dueDateInMonth(bill, month),
      /**
       * Nasce SEMPRE pendente, inclusive quando o vencimento ja passou.
       *
       * Data passada nao e prova de pagamento. Marcar como pago porque o dia
       * chegou inventaria um fato que ninguem afirmou, e o saldo realizado —
       * o numero principal da tela — passaria a mentir.
       */
      status: 'pending',
      paymentMethod: bill.paymentMethod,
      ...(bill.cardId === undefined ? {} : { cardId: bill.cardId }),
      ...(bill.debtId === undefined ? {} : { debtId: bill.debtId }),
    });
  }

  return { month, toCreate, alreadyPresent };
}

/**
 * Quais meses de um intervalo podem ser preparados (materializados).
 *
 * Regra do Historico: abrir a janela conta como visitar cada mes dela, mas
 * SO ate o mes de referencia. Uma janela que alcance novembro estando em
 * outubro nunca escreve em novembro — o Historico olha para tras, e criar
 * lancamentos futuros a partir de uma tela de leitura do passado seria efeito
 * colateral sem visita.
 *
 * Devolve na ordem recebida, sem repeticoes. Pura: o mes de referencia vem
 * de fora, nunca do relogio.
 */
export function monthsToPrepare(
  months: readonly MonthKey[],
  referenceMonth: MonthKey,
): MonthKey[] {
  return [...new Set(months)].filter((month) => month <= referenceMonth);
}
