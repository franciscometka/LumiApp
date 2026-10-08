/**
 * Identidade do produto.
 *
 * O nome que o usuario ve e "Lumi". O projeto nasceu como "Finan", e alguns
 * identificadores internos guardam esse nome DE PROPOSITO — sao legado
 * estavel, nunca exibidos, e mudar qualquer um deles perderia dados ou cache:
 *
 * - `STORAGE_KEY = 'finan:db'` (data/adapters/local/persisted-schema.ts):
 *   a chave do localStorage onde vivem os dados do usuario.
 * - `FINAN_NAMESPACE` (domain/shared/uuid-v5.ts): o namespace dos ids
 *   deterministicos; mudar gera ids novos para as mesmas entidades.
 * - `queryKeys.all = ['finan']` (features/app/query-keys.ts): a raiz das
 *   chaves de cache.
 * - A pasta `components/finan/`: so organizacao de codigo.
 *
 * Nao migrar. Sao nomes de coisas, nao marca.
 */
export const BRAND_NAME = 'Lumi';
export const BRAND_TAGLINE = 'Finanças com mais clareza';
export const BRAND_DESCRIPTION = 'Controle das suas finanças do mês, sem planilha.';
