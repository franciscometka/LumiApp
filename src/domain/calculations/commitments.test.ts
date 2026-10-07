import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome } from '../__testing__/factories';
import { roundPercentage } from '../shared/percentage';

import { EMPTY_COMMITMENTS, calculateCommitments, classifyExpense } from './commitments';

/**
 * A regra de transicao do cartao e a precedencia da divida sao a parte deste
 * dominio onde um erro NAO aparece na tela: o total continua certo, mas a
 * fatia de "comprometido" fica errada. Por isso os seis casos pedidos estao
 * travados aqui, um a um.
 */

describe('classificacao de gasto — rotulo unico', () => {
  it('1. credito SEM cardId conta como cartao nao identificado', () => {
    // Regra de transicao: existem lancamentos gravados antes de haver
    // cadastro de cartoes. Deixar de conta-los faria o percentual de
    // comprometimento desses meses cair sozinho.
    const transaction = makeExpense({ paymentMethod: 'credit' });

    expect(classifyExpense(transaction)).toBe('card-unidentified');

    const result = calculateCommitments([transaction]);
    expect(result.cardUnidentifiedCents).toBe(transaction.amountCents);
    expect(result.cardIdentifiedCents).toBe(0);
    expect(result.cardCents).toBe(transaction.amountCents);
  });

  it('2. credito COM cardId conta como cartao identificado', () => {
    const transaction = makeExpense({ paymentMethod: 'credit', cardId: 'card-1' });

    expect(classifyExpense(transaction)).toBe('card-identified');

    const result = calculateCommitments([transaction]);
    expect(result.cardIdentifiedCents).toBe(transaction.amountCents);
    // `cardId` prevalece: nao pode cair tambem no balde de nao identificado.
    expect(result.cardUnidentifiedCents).toBe(0);
    expect(result.cardCents).toBe(transaction.amountCents);
  });

  it('3. transacao vinculada a cartao conta, mesmo paga em outro meio', () => {
    // Pix usado para pagar a fatura, vinculado ao cartao: continua sendo
    // compromisso de cartao, porque o vinculo e explicito.
    const transaction = makeExpense({ paymentMethod: 'pix', cardId: 'card-1' });

    expect(classifyExpense(transaction)).toBe('card-identified');
    expect(calculateCommitments([transaction]).cardIdentifiedCents).toBe(transaction.amountCents);
  });

  it('4. vinculada a divida E a cartao conta uma vez so', () => {
    const transaction = makeExpense({
      amountCents: 44000,
      debtId: 'debt-1',
      cardId: 'card-1',
      paymentMethod: 'credit',
    });

    expect(classifyExpense(transaction)).toBe('debt');

    const result = calculateCommitments([transaction]);
    expect(result.debtCents).toBe(44000);
    expect(result.cardCents).toBe(0);
    expect(result.cardIdentifiedCents).toBe(0);
    expect(result.cardUnidentifiedCents).toBe(0);
    expect(result.committedCents).toBe(44000);
  });

  it('5. a divida tem precedencia sobre qualquer sinal de cartao', () => {
    const casos = [
      makeExpense({ debtId: 'debt-1' }),
      makeExpense({ debtId: 'debt-1', cardId: 'card-1' }),
      makeExpense({ debtId: 'debt-1', paymentMethod: 'credit' }),
      makeExpense({ debtId: 'debt-1', cardId: 'card-1', paymentMethod: 'credit' }),
    ];

    for (const transaction of casos) {
      expect(classifyExpense(transaction)).toBe('debt');
    }
  });

  it('6. nenhum valor aparece em mais de um balde', () => {
    const transactions = [
      makeExpense({ amountCents: 10000 }), // livre
      makeExpense({ amountCents: 20000, paymentMethod: 'credit' }), // nao identificado
      makeExpense({ amountCents: 30000, cardId: 'card-1' }), // identificado
      makeExpense({ amountCents: 40000, debtId: 'debt-1', cardId: 'card-1' }), // divida
    ];

    const r = calculateCommitments(transactions);

    // Cada balde tem exatamente o seu.
    expect(r.freeCents).toBe(10000);
    expect(r.cardUnidentifiedCents).toBe(20000);
    expect(r.cardIdentifiedCents).toBe(30000);
    expect(r.debtCents).toBe(40000);

    // E a soma das partes fecha o total, sem sobra nem duplicacao.
    expect(r.cardCents).toBe(50000);
    expect(r.committedCents).toBe(90000);
    expect(r.totalExpenseCents).toBe(100000);
    expect(r.committedCents + r.freeCents).toBe(r.totalExpenseCents);
    expect(r.cardIdentifiedCents + r.cardUnidentifiedCents).toBe(r.cardCents);
  });
});

describe('percentuais', () => {
  it('comprometido nunca passa de 100%', () => {
    const r = calculateCommitments([
      makeExpense({ amountCents: 50000, debtId: 'debt-1', cardId: 'card-1' }),
      makeExpense({ amountCents: 50000, paymentMethod: 'credit' }),
    ]);

    expect(r.committedPercentage).toBe(100);
  });

  it('devolve null, nao zero, quando nao ha gasto', () => {
    const r = calculateCommitments([]);
    expect(r.cardPercentage).toBeNull();
    expect(r.debtPercentage).toBeNull();
    expect(r.committedPercentage).toBeNull();
  });

  it('ignora entradas por completo', () => {
    const r = calculateCommitments([
      makeIncome({ amountCents: 300000, paymentMethod: 'credit' }),
      makeExpense({ amountCents: 10000 }),
    ]);

    expect(r.totalExpenseCents).toBe(10000);
    expect(r.cardCents).toBe(0);
  });

  it('EMPTY_COMMITMENTS equivale a calcular sobre lista vazia', () => {
    expect(calculateCommitments([])).toEqual(EMPTY_COMMITMENTS);
  });
});

describe('cenario do briefing', () => {
  it('mede o comprometimento do mes', () => {
    const c = calculateCommitments(briefingScenario());

    expect(c.cardCents).toBe(37400 + 76500);
    expect(c.debtCents).toBe(44000);
    expect(c.committedCents).toBe(157900);
    expect(c.freeCents).toBe(91100 + 12000);
    expect(c.totalExpenseCents).toBe(261000);

    // "Cartoes representam 44% dos seus gastos."
    expect(roundPercentage(c.cardPercentage as number, 0)).toBe(44);
    expect(roundPercentage(c.committedPercentage as number, 1)).toBe(60.5);
  });

  it('as partes sempre somam o total de gastos', () => {
    const c = calculateCommitments(briefingScenario());
    expect(c.cardCents + c.debtCents + c.freeCents).toBe(c.totalExpenseCents);
  });

  it('o cartao do briefing ja vem identificado, e o total nao muda por isso', () => {
    // As duas faturas do cenario tem `cardId`. O ponto do teste e que a
    // repartição entre identificado e nao identificado NUNCA altera o total:
    // conforme o usuario cadastra cartoes, o valor migra de um balde para o
    // outro e `cardCents` permanece o mesmo.
    const c = calculateCommitments(briefingScenario());

    expect(c.cardIdentifiedCents).toBe(113900);
    expect(c.cardUnidentifiedCents).toBe(0);
    expect(c.cardCents).toBe(113900);
  });

  it('migrar de credito avulso para cartao vinculado nao muda nenhum total', () => {
    const avulso = [makeExpense({ amountCents: 113900, paymentMethod: 'credit' })];
    const vinculado = [
      makeExpense({ amountCents: 113900, paymentMethod: 'credit', cardId: 'card-inter' }),
    ];

    const a = calculateCommitments(avulso);
    const b = calculateCommitments(vinculado);

    expect(a.cardCents).toBe(b.cardCents);
    expect(a.committedCents).toBe(b.committedCents);
    expect(a.totalExpenseCents).toBe(b.totalExpenseCents);
    expect(a.cardPercentage).toBe(b.cardPercentage);
  });
});
