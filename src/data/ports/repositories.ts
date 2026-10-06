import type { TransactionFilter } from '@/domain/calculations/filters';
import type { Card } from '@/domain/entities/card';
import type { Category } from '@/domain/entities/category';
import type { Debt } from '@/domain/entities/debt';
import type { MonthlyPlan } from '@/domain/entities/monthly-plan';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import type { Transaction } from '@/domain/entities/transaction';
import type { UserSettings } from '@/domain/entities/user-settings';
import type { ID } from '@/domain/shared/id';
import type { MonthKey } from '@/domain/shared/plain-date';

import type { ListOptions, Repository } from './repository';

/**
 * Ports por entidade. Cada um adiciona ao contrato generico apenas as
 * consultas que o dominio realmente precisa — nada de `query(sql)` generico,
 * que vazaria o adapter para dentro da aplicacao.
 */

export interface TransactionRepository extends Repository<Transaction> {
  /**
   * Aplica o mesmo `TransactionFilter` do dominio.
   *
   * Hoje o adapter local filtra em memoria com a funcao pura de
   * `calculations/filters`; amanha o adapter Supabase pode traduzir o mesmo
   * objeto para `WHERE`. O chamador nao percebe diferenca.
   */
  findByFilter(filter: TransactionFilter, options?: ListOptions): Promise<Transaction[]>;
  findByCardId(cardId: ID, options?: ListOptions): Promise<Transaction[]>;
  findByDebtId(debtId: ID, options?: ListOptions): Promise<Transaction[]>;
  /** Gravacao em lote, usada pela materializacao de contas recorrentes. */
  createMany(inputs: readonly Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[]): Promise<Transaction[]>;
}

export interface CategoryRepository extends Repository<Category> {
  findByName(name: string): Promise<Category | null>;
}

export type CardRepository = Repository<Card>;

export type DebtRepository = Repository<Debt>;

export interface RecurringBillRepository extends Repository<RecurringBill> {
  findActive(): Promise<RecurringBill[]>;
}

export interface MonthlyPlanRepository extends Repository<MonthlyPlan> {
  findByMonth(month: MonthKey): Promise<MonthlyPlan | null>;
}

/**
 * Configuracoes sao um singleton por usuario, nao uma colecao.
 * `get` sempre devolve algo: na ausencia de registro, os padroes.
 */
export interface SettingsRepository {
  get(): Promise<UserSettings>;
  save(settings: UserSettings): Promise<UserSettings>;
  /** Se ja existe preferencia gravada, em vez dos padroes. */
  exists(): Promise<boolean>;
}
