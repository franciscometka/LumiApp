import type { ID } from '@/domain/shared/id';

/**
 * Opcoes de vinculo (cartao, divida) para um `<select>`.
 *
 * O problema que este modulo resolve e silencioso e destrutivo.
 *
 * Um `<select>` cujo `value` nao corresponde a nenhuma `<option>` nao mostra
 * erro: o navegador simplesmente seleciona nada, e o campo passa a valer `''`.
 * Se a pessoa abrir para editar um lancamento antigo cujo cartao foi excluido
 * e salvar qualquer outra coisa — so a descricao, por exemplo —, o vinculo
 * desaparece sem que nada na tela tenha indicado que ele existia.
 *
 * A regra do lote e explicita: excluir um cartao ou uma divida NAO altera
 * transacoes historicas. Para isso valer na pratica, o valor atual precisa
 * sempre existir entre as opcoes. Quando a entidade referida nao esta mais
 * disponivel, a opcao aparece rotulada como removida — um estado explicito,
 * em vez de fingir que nunca houve vinculo.
 */
export interface LinkOption {
  readonly id: ID;
  readonly label: string;
  /** Referencia a uma entidade excluida/arquivada, preservada para nao perder o vinculo. */
  readonly removed: boolean;
}

interface Linkable {
  readonly id: ID;
  readonly name: string;
  readonly deletedAt?: string | undefined;
  readonly archivedAt?: string | undefined;
}

function isAvailable(entity: Linkable): boolean {
  return entity.deletedAt === undefined && entity.archivedAt === undefined;
}

/** Entidades que podem receber NOVOS vinculos. */
export function availableForLinking<T extends Linkable>(entities: readonly T[]): T[] {
  return entities.filter(isAvailable).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Lista para o `<select>`: as disponiveis mais, quando necessario, a referida
 * pelo valor atual.
 *
 * `removedLabel` recebe o nome quando a entidade ainda existe no repositorio
 * (excluida logicamente, entao sabemos o nome) e `null` quando ela sumiu de
 * vez — caso em que a UI mostra so "Cartao removido", sem inventar um nome.
 */
export function linkOptions<T extends Linkable>(
  entities: readonly T[],
  currentId: string,
  removedLabel: (name: string | null) => string,
): LinkOption[] {
  const options: LinkOption[] = availableForLinking(entities).map((entity) => ({
    id: entity.id,
    label: entity.name,
    removed: false,
  }));

  if (currentId === '') return options;
  if (options.some((option) => option.id === currentId)) return options;

  // O valor atual aponta para algo indisponivel. Ele entra assim mesmo, senao
  // salvar o formulario apagaria o vinculo.
  const known = entities.find((entity) => entity.id === currentId);

  return [
    ...options,
    {
      id: currentId as ID,
      label: removedLabel(known?.name ?? null),
      removed: true,
    },
  ];
}

/** `true` se o valor atual aponta para algo que nao esta mais disponivel. */
export function isRemovedReference<T extends Linkable>(
  entities: readonly T[],
  currentId: string,
): boolean {
  if (currentId === '') return false;
  const entity = entities.find((item) => item.id === currentId);
  return entity === undefined || !isAvailable(entity);
}
