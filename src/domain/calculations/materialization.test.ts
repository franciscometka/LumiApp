import { describe, expect, it } from 'vitest';

import { makeTransaction } from '../__testing__/factories';
import type { RecurringBill } from '../entities/recurring-bill';
import type { Transaction } from '../entities/transaction';
import { isUuid } from '../shared/id';
import { toMonthKey } from '../shared/plain-date';
import type { MonthKey } from '../shared/plain-date';

import { occurrenceId, planMaterialization } from './materialization';

const m = (value: string) => toMonthKey(value) as MonthKey;

type BillOverrides = Partial<Omit<RecurringBill, 'amountCents'>> & {
  id: string;
  amountCents?: number;
};

function makeBill(overrides: BillOverrides): RecurringBill {
  return {
    userId: 'user-teste',
    description: 'Internet',
    amountCents: 12000,
    type: 'expense',
    categoryId: 'cat-internet',
    dueDay: 10,
    paymentMethod: 'boleto',
    isActive: true,
    startMonth: m('2026-01'),
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  } as RecurringBill;
}

const INTERNET = makeBill({ id: 'bill-internet' });
const OUTUBRO = m('2026-10');

/** Simula gravar o plano: devolve as transacoes resultantes. */
function aplicar(plan: ReturnType<typeof planMaterialization>): Transaction[] {
  return plan.toCreate.map((draft) =>
    makeTransaction({
      id: draft.id,
      description: draft.description,
      amountCents: draft.amountCents,
      type: draft.type,
      flow: draft.flow,
      categoryId: draft.categoryId,
      date: draft.date,
      status: draft.status,
      paymentMethod: draft.paymentMethod,
      recurringBillId: draft.recurringBillId,
    }),
  );
}

describe('occurrenceId', () => {
  it('e determinstico: mesma recorrencia e mes, mesmo id', () => {
    const uma = occurrenceId('bill-internet', OUTUBRO);
    for (let i = 0; i < 20; i += 1) {
      expect(occurrenceId('bill-internet', OUTUBRO)).toBe(uma);
    }
  });

  it('muda com o mes e com a recorrencia', () => {
    const ids = new Set([
      occurrenceId('bill-a', m('2026-10')),
      occurrenceId('bill-a', m('2026-11')),
      occurrenceId('bill-b', m('2026-10')),
      occurrenceId('bill-b', m('2026-11')),
    ]);
    expect(ids.size).toBe(4);
  });

  it('e um UUID valido, para caber na coluna uuid do Postgres', () => {
    expect(isUuid(occurrenceId('bill-internet', OUTUBRO))).toBe(true);
  });
});

describe('idempotencia', () => {
  it('gera a ocorrencia quando o mes esta vazio', () => {
    const plan = planMaterialization({ bills: [INTERNET], existing: [], month: OUTUBRO });

    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]?.description).toBe('Internet');
    expect(plan.toCreate[0]?.amountCents).toBe(12000);
    expect(plan.toCreate[0]?.date).toBe('2026-10-10');
  });

  it('materializar cinco vezes seguidas produz UMA ocorrencia', () => {
    // O cenario de abrir o app cinco vezes.
    let existing: Transaction[] = [];

    for (let i = 0; i < 5; i += 1) {
      const plan = planMaterialization({ bills: [INTERNET], existing, month: OUTUBRO });
      existing = [...existing, ...aplicar(plan)];
    }

    expect(existing).toHaveLength(1);
  });

  it('chamadas concorrentes convergem para o mesmo id', () => {
    /**
     * Duas chamadas que nao enxergam o resultado uma da outra — StrictMode,
     * duas abas, `Promise.all`. As duas produzem um plano com UM item, e os
     * dois itens tem o MESMO id. Gravar os dois e gravar o mesmo registro
     * duas vezes, nao dois registros.
     */
    const a = planMaterialization({ bills: [INTERNET], existing: [], month: OUTUBRO });
    const b = planMaterialization({ bills: [INTERNET], existing: [], month: OUTUBRO });

    expect(a.toCreate[0]?.id).toBe(b.toCreate[0]?.id);

    const gravados = new Set([...aplicar(a), ...aplicar(b)].map((t) => t.id));
    expect(gravados.size).toBe(1);
  });

  it('reconhece a ocorrencia pelo id determinstico', () => {
    const existing = aplicar(
      planMaterialization({ bills: [INTERNET], existing: [], month: OUTUBRO }),
    );

    const plan = planMaterialization({ bills: [INTERNET], existing, month: OUTUBRO });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.alreadyPresent).toEqual(['bill-internet']);
  });

  it('reconhece ocorrencia legada, com id sorteado', () => {
    // Dados anteriores a este modelo — o seed, por exemplo. Sem este criterio
    // o mes ganharia uma SEGUNDA Internet.
    const legada = makeTransaction({
      id: 'id-sorteado-antigo',
      recurringBillId: 'bill-internet',
      date: '2026-10-10',
    });

    const plan = planMaterialization({
      bills: [INTERNET],
      existing: [legada],
      month: OUTUBRO,
    });

    expect(plan.toCreate).toHaveLength(0);
  });

  it('nao confunde ocorrencia de outro mes', () => {
    const setembro = makeTransaction({
      id: occurrenceId('bill-internet', m('2026-09')),
      recurringBillId: 'bill-internet',
      date: '2026-09-10',
    });

    const plan = planMaterialization({
      bills: [INTERNET],
      existing: [setembro],
      month: OUTUBRO,
    });

    expect(plan.toCreate).toHaveLength(1);
  });
});

describe('ocorrencia excluida bloqueia regeneracao', () => {
  it('nao recria o que o usuario apagou', () => {
    /**
     * O caso que torna obrigatorio considerar os excluidos: sem isso, apagar
     * a Internet de outubro e recarregar a traria de volta, todo refresh,
     * para sempre.
     */
    const excluida = makeTransaction({
      id: occurrenceId('bill-internet', OUTUBRO),
      recurringBillId: 'bill-internet',
      date: '2026-10-10',
      deletedAt: '2026-10-11T12:00:00.000Z',
    });

    for (let i = 0; i < 3; i += 1) {
      const plan = planMaterialization({
        bills: [INTERNET],
        existing: [excluida],
        month: OUTUBRO,
      });
      expect(plan.toCreate).toHaveLength(0);
    }
  });

  it('restaurar devolve a MESMA ocorrencia, nao uma nova', () => {
    const id = occurrenceId('bill-internet', OUTUBRO);

    const excluida = makeTransaction({
      id,
      recurringBillId: 'bill-internet',
      date: '2026-10-10',
      deletedAt: '2026-10-11T12:00:00.000Z',
    });
    const restaurada = { ...excluida, deletedAt: undefined };

    expect(restaurada.id).toBe(id);
    expect(
      planMaterialization({ bills: [INTERNET], existing: [restaurada], month: OUTUBRO }).toCreate,
    ).toHaveLength(0);
  });
});

describe('vigencia', () => {
  it('nao gera antes do mes inicial', () => {
    const bill = makeBill({ id: 'b', startMonth: m('2026-11') });
    expect(
      planMaterialization({ bills: [bill], existing: [], month: OUTUBRO }).toCreate,
    ).toHaveLength(0);
  });

  it('gera no proprio mes inicial', () => {
    const bill = makeBill({ id: 'b', startMonth: OUTUBRO });
    expect(
      planMaterialization({ bills: [bill], existing: [], month: OUTUBRO }).toCreate,
    ).toHaveLength(1);
  });

  it('encerrada: gera no endMonth e NAO no mes seguinte', () => {
    // A regra central do encerramento.
    const bill = makeBill({ id: 'b', endMonth: OUTUBRO });

    expect(
      planMaterialization({ bills: [bill], existing: [], month: OUTUBRO }).toCreate,
    ).toHaveLength(1);
    expect(
      planMaterialization({ bills: [bill], existing: [], month: m('2026-11') }).toCreate,
    ).toHaveLength(0);
  });

  it('encerramento na virada do ano', () => {
    const bill = makeBill({ id: 'b', endMonth: m('2026-12') });

    expect(
      planMaterialization({ bills: [bill], existing: [], month: m('2026-12') }).toCreate,
    ).toHaveLength(1);
    expect(
      planMaterialization({ bills: [bill], existing: [], month: m('2027-01') }).toCreate,
    ).toHaveLength(0);
  });

  it('recorrencia excluida nao gera nada', () => {
    const bill = makeBill({ id: 'b', deletedAt: '2026-09-01T12:00:00.000Z' });
    expect(
      planMaterialization({ bills: [bill], existing: [], month: OUTUBRO }).toCreate,
    ).toHaveLength(0);
  });

  it('recorrencia inativa nao gera nada', () => {
    const bill = makeBill({ id: 'b', isActive: false });
    expect(
      planMaterialization({ bills: [bill], existing: [], month: OUTUBRO }).toCreate,
    ).toHaveLength(0);
  });

  it('ignora lastGeneratedMonth por completo', () => {
    /**
     * A regra antiga pularia setembro depois de novembro ter sido visitado.
     * Aqui o campo nao e consultado: setembro gera normalmente.
     */
    const bill = makeBill({ id: 'b', lastGeneratedMonth: m('2026-11') });

    expect(
      planMaterialization({ bills: [bill], existing: [], month: m('2026-09') }).toCreate,
    ).toHaveLength(1);
  });

  it('navegacao fora de ordem materializa cada mes visitado', () => {
    const bill = makeBill({ id: 'b', lastGeneratedMonth: m('2026-11') });
    let existing: Transaction[] = [];

    // Novembro, depois setembro, depois outubro.
    for (const mes of [m('2026-11'), m('2026-09'), m('2026-10')]) {
      const plan = planMaterialization({ bills: [bill], existing, month: mes });
      expect(plan.toCreate, `mes ${mes}`).toHaveLength(1);
      existing = [...existing, ...aplicar(plan)];
    }

    expect(existing).toHaveLength(3);
    expect(new Set(existing.map((t) => t.id)).size).toBe(3);
  });
});

describe('varias recorrencias', () => {
  it('duas recorrencias no mesmo mes geram duas ocorrencias distintas', () => {
    const plan = planMaterialization({
      bills: [INTERNET, makeBill({ id: 'bill-aluguel', description: 'Aluguel', dueDay: 5 })],
      existing: [],
      month: OUTUBRO,
    });

    expect(plan.toCreate).toHaveLength(2);
    expect(new Set(plan.toCreate.map((o) => o.id)).size).toBe(2);
  });

  it('completa so o que falta', () => {
    const outra = makeBill({ id: 'bill-aluguel', description: 'Aluguel' });
    const existing = aplicar(
      planMaterialization({ bills: [INTERNET], existing: [], month: OUTUBRO }),
    );

    const plan = planMaterialization({ bills: [INTERNET, outra], existing, month: OUTUBRO });

    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]?.recurringBillId).toBe('bill-aluguel');
    expect(plan.alreadyPresent).toEqual(['bill-internet']);
  });
});

describe('forma da ocorrencia', () => {
  it('nasce pendente', () => {
    const plan = planMaterialization({ bills: [INTERNET], existing: [], month: OUTUBRO });
    expect(plan.toCreate[0]?.status).toBe('pending');
  });

  it('nasce pendente em qualquer mes, inclusive com vencimento ja vencido', () => {
    /**
     * Data passada nao e prova de pagamento. Repare que esta funcao nem
     * conhece "hoje": o status e `pending` por construcao, entao nao existe
     * caminho em que a passagem do tempo marque algo como pago sozinho.
     */
    for (const mes of ['2026-01', '2026-06', '2026-10', '2030-12']) {
      const plan = planMaterialization({
        bills: [makeBill({ id: 'b', dueDay: 1 })],
        existing: [],
        month: m(mes),
      });

      expect(plan.toCreate[0]?.status, mes).toBe('pending');
    }
  });

  it('entrada recorrente nasce pendente e operacional', () => {
    const salario = makeBill({
      id: 'bill-salario',
      description: 'Salário',
      type: 'income',
      amountCents: 230000,
      categoryId: 'cat-salario',
      dueDay: 5,
    });

    const occurrence = planMaterialization({
      bills: [salario],
      existing: [],
      month: OUTUBRO,
    }).toCreate[0];

    expect(occurrence?.type).toBe('income');
    expect(occurrence?.status).toBe('pending');
    // Reserva nao vira renda so por ser recorrente.
    expect(occurrence?.flow).toBe('operational');
  });

  it('preserva os vinculos de cartao e divida', () => {
    const bill = makeBill({ id: 'b', cardId: 'card-1', debtId: 'debt-1' });
    const occurrence = planMaterialization({
      bills: [bill],
      existing: [],
      month: OUTUBRO,
    }).toCreate[0];

    expect(occurrence?.cardId).toBe('card-1');
    expect(occurrence?.debtId).toBe('debt-1');
  });

  it('omite vinculos ausentes em vez de gravar undefined explicito', () => {
    const occurrence = planMaterialization({
      bills: [INTERNET],
      existing: [],
      month: OUTUBRO,
    }).toCreate[0];

    expect('cardId' in (occurrence ?? {})).toBe(false);
    expect('debtId' in (occurrence ?? {})).toBe(false);
  });
});

describe('dia de vencimento — clamp civil', () => {
  const dia31 = makeBill({ id: 'b', dueDay: 31 });

  it('dia 31 cai em 28 de fevereiro num ano comum', () => {
    const plan = planMaterialization({ bills: [dia31], existing: [], month: m('2027-02') });
    expect(plan.toCreate[0]?.date).toBe('2027-02-28');
  });

  it('dia 31 cai em 29 de fevereiro num ano bissexto', () => {
    const plan = planMaterialization({ bills: [dia31], existing: [], month: m('2028-02') });
    expect(plan.toCreate[0]?.date).toBe('2028-02-29');
  });

  it('dia 31 cai em 30 de abril', () => {
    const plan = planMaterialization({ bills: [dia31], existing: [], month: m('2026-04') });
    expect(plan.toCreate[0]?.date).toBe('2026-04-30');
  });

  it('dia 31 permanece 31 nos meses que tem', () => {
    const plan = planMaterialization({ bills: [dia31], existing: [], month: m('2026-12') });
    expect(plan.toCreate[0]?.date).toBe('2026-12-31');
  });

  it('dezembro para janeiro atravessa o ano corretamente', () => {
    const plan = planMaterialization({ bills: [dia31], existing: [], month: m('2027-01') });
    expect(plan.toCreate[0]?.date).toBe('2027-01-31');
  });

  it('dia 30 tambem e ajustado em fevereiro', () => {
    const plan = planMaterialization({
      bills: [makeBill({ id: 'b', dueDay: 30 })],
      existing: [],
      month: m('2027-02'),
    });
    expect(plan.toCreate[0]?.date).toBe('2027-02-28');
  });

  it('a data gerada e sempre do mes pedido', () => {
    for (const dia of [1, 15, 28, 29, 30, 31]) {
      for (const mes of ['2026-01', '2026-02', '2026-04', '2028-02', '2026-12']) {
        const plan = planMaterialization({
          bills: [makeBill({ id: 'b', dueDay: dia })],
          existing: [],
          month: m(mes),
        });
        expect(plan.toCreate[0]?.date.startsWith(mes), `dia ${String(dia)} em ${mes}`).toBe(true);
      }
    }
  });
});

describe('sem recorrencias', () => {
  it('nao planeja nada', () => {
    const plan = planMaterialization({ bills: [], existing: [], month: OUTUBRO });
    expect(plan.toCreate).toEqual([]);
    expect(plan.alreadyPresent).toEqual([]);
  });
});
