import type { DataError, RecordIssue } from './errors';
import type {
  CardRepository,
  CategoryRepository,
  DebtRepository,
  MonthlyPlanRepository,
  RecurringBillRepository,
  SettingsRepository,
  TransactionRepository,
} from './repositories';

export type DatabaseState =
  /** Nunca houve gravacao. Candidato a seed. */
  | 'empty'
  /** Aberto e integro. */
  | 'ready'
  /** JSON invalido ou estrutura irreconhecivel. */
  | 'corrupted'
  /** Gravado por uma versao mais nova do app. */
  | 'unsupported_version';

export interface DatabaseStatus {
  readonly state: DatabaseState;
  readonly schemaVersion: number | null;
  readonly currentSchemaVersion: number;
  readonly recordCount: number;
  /** Registros recusados pela validacao. Vazio quando `state` e 'ready'. */
  readonly issues: readonly RecordIssue[];
  readonly error: DataError | null;
  readonly seededAt: string | null;
}

/**
 * Superficie de manutencao e recuperacao.
 *
 * Existe para que a UI possa, no futuro, oferecer um caminho honesto quando os
 * dados quebram: mostrar o que houve, deixar exportar o conteudo bruto e so
 * entao, com confirmacao, resetar. Nada aqui e chamado automaticamente.
 */
export interface MaintenanceApi {
  /** Diagnostico. Nunca lanca — e justamente o que se chama quando algo quebrou. */
  status(): Promise<DatabaseStatus>;

  /** Conteudo cru do storage, sem interpretacao. Base do "baixar meus dados". */
  exportRaw(): Promise<string | null>;

  /** Exportacao estruturada. Falha se os dados nao puderem ser lidos. */
  exportJson(): Promise<string>;

  /** Substitui todo o conteudo. Valida antes de gravar; recusa lixo. */
  importJson(content: string): Promise<void>;

  /**
   * Tenta abrir descartando apenas os registros invalidos, mantendo o resto.
   * Devolve o que foi recusado para que o usuario veja o que perdeu.
   * Nao grava nada: e uma leitura de diagnostico.
   */
  recover(): Promise<{ recovered: number; discarded: readonly RecordIssue[] }>;

  /**
   * Apaga tudo. E a UNICA operacao destrutiva da camada, e exige confirmacao
   * explicita no proprio argumento para que nao possa ser chamada por engano.
   */
  reset(confirmation: 'apagar-tudo'): Promise<void>;
}

/**
 * Ponto unico de acesso a persistencia. A aplicacao conhece esta interface,
 * jamais um adapter concreto.
 */
export interface DataSource {
  readonly id: string;
  readonly transactions: TransactionRepository;
  readonly categories: CategoryRepository;
  readonly cards: CardRepository;
  readonly debts: DebtRepository;
  readonly recurringBills: RecurringBillRepository;
  readonly monthlyPlans: MonthlyPlanRepository;
  readonly settings: SettingsRepository;
  readonly maintenance: MaintenanceApi;
}
