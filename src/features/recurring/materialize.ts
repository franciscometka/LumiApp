import type { DataSource } from '@/data/ports/data-source';
import type { MaterializationPlan } from '@/domain/calculations/materialization';
import { planMaterialization } from '@/domain/calculations/materialization';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';

/**
 * Execucao da materializacao: le, decide com a funcao pura, grava.
 *
 * A decisao vive no dominio (`planMaterialization`); aqui so existe o acesso
 * ao repositorio. Essa separacao e o que torna todos os casos de borda —
 * encerramento, exclusao, clamp de dia 31, navegacao fora de ordem —
 * testaveis sem storage nenhum.
 *
 * ## Sobre atomicidade, honestamente
 *
 * O adapter local grava com `database.mutate()`, que opera sobre um snapshot
 * e e sincrono dentro de uma mesma aba. Isso NAO e uma transacao de verdade
 * entre varias abas: o `localStorage` nao oferece lock, e duas abas podem
 * ler o mesmo estado e escrever uma por cima da outra.
 *
 * O que garante a ausencia de duplicata nao e o lock — e o id determinstico.
 * Duas abas que materializam outubro ao mesmo tempo calculam o MESMO id, e o
 * pior resultado possivel e a mesma ocorrencia ser escrita duas vezes, o que
 * e indistinguivel de ter sido escrita uma vez. A ultima escrita pode perder
 * uma ocorrencia de OUTRA recorrencia gravada em paralelo, mas a proxima
 * visita ao mes a recria — sem duplicar, porque o id ja e conhecido.
 *
 * No Supabase o mesmo id vira `PRIMARY KEY` e a garantia passa a ser do banco
 * (`ON CONFLICT DO NOTHING`), sem mudar este caso de uso.
 */
export interface MaterializationResult {
  readonly month: MonthKey;
  /** Quantas ocorrencias foram efetivamente criadas agora. */
  readonly created: number;
  /** Descricoes do que foi criado, para o aviso discreto na tela. */
  readonly createdDescriptions: readonly string[];
}

export async function materializeMonth(
  dataSource: DataSource,
  month: MonthKey,
): Promise<MaterializationResult> {
  const [bills, existing] = await Promise.all([
    dataSource.recurringBills.findAll(),
    /**
     * `includeDeleted: true` e obrigatorio.
     *
     * Uma ocorrencia excluida precisa continuar bloqueando a regeneracao.
     * Sem isso, apagar a Internet de outubro faria o app recria-la no proximo
     * refresh, e no seguinte, e no seguinte.
     */
    dataSource.transactions.findByFilter(
      { period: civilMonthResolver.resolve(month), includeDeleted: true },
      { includeDeleted: true },
    ),
  ]);

  const plan: MaterializationPlan = planMaterialization({ bills, existing, month });

  if (plan.toCreate.length === 0) {
    return { month, created: 0, createdDescriptions: [] };
  }

  const settings = await dataSource.settings.get();

  /**
   * `insertManyIgnoringExisting`, nao `createMany`: o id vem do dominio e
   * colisao e um nao-evento, nao um erro. Se outra aba materializou o mesmo
   * mes entre a leitura e esta escrita, as linhas dela permanecem e estas
   * sao descartadas — o resultado e o mesmo.
   */
  const inserted = await dataSource.transactions.insertManyIgnoringExisting(
    plan.toCreate.map((occurrence) => ({ ...occurrence, userId: settings.userId })),
  );

  return {
    month,
    // Conta o que REALMENTE entrou, nao o que foi planejado.
    created: inserted.length,
    createdDescriptions: inserted.map((occurrence) => occurrence.description),
  };
}
