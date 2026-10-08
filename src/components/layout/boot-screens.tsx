'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';

import { BRAND_NAME } from '@/components/brand/brand';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import type { DataError } from '@/data/ports/errors';
import { retryInitialization } from '@/features/app/data-source-store';

/**
 * Tela de inicializacao.
 *
 * Sem spinner girando: a abertura do armazenamento local e praticamente
 * instantanea, e um spinner que pisca por um quadro chama mais atencao para a
 * espera do que a propria espera. O que aparece aqui e so a marca, estavel,
 * para que a transicao para o app seja silenciosa.
 */
export function AppBootScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6" role="status" aria-live="polite">
      <BrandLogo size={44} className="text-foreground opacity-60" />
      <span className="sr-only">Carregando seus dados</span>
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  storage_unavailable:
    'O navegador não permitiu salvar dados neste dispositivo. Isso costuma acontecer em janelas anônimas ou com o armazenamento bloqueado nas configurações do site.',
  storage_write_failed:
    'Não foi possível gravar os dados. O espaço reservado para o site pode ter acabado.',
  corrupted_json: 'Os dados salvos não puderam ser lidos.',
  corrupted_structure: 'Os dados salvos não estão no formato esperado.',
  unsupported_schema_version:
    `Estes dados foram criados por uma versão mais nova do ${BRAND_NAME}. Atualize o aplicativo para abri-los.`,
  migration_failed: 'Não foi possível atualizar o formato dos dados salvos.',
};

/**
 * Erro de persistencia.
 *
 * Estado controlado, nunca tela branca. O texto diz o que houve em portugues
 * comum e, quando ha conteudo a preservar, afirma explicitamente que nada foi
 * apagado — porque de fato nao foi: a camada de dados recusa abrir e mantem o
 * conteudo bruto intacto.
 *
 * A tela completa de recuperacao (exportar, inspecionar, resetar) vem depois.
 * Aqui o compromisso e nao mentir e nao destruir.
 */
export function StorageErrorScreen({ error }: { error: DataError }) {
  const description = ERROR_MESSAGES[error.code] ?? 'Não foi possível abrir seus dados.';

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="bg-card w-full max-w-md rounded-xl border p-6">
        <div className="bg-expense-surface text-expense grid size-10 place-items-center rounded-lg">
          <TriangleAlert className="size-5" />
        </div>

        <h1 className="mt-4 text-lg font-semibold tracking-tight">
          Não foi possível abrir seus dados
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>

        {error.isRecoverable ? (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Nada foi apagado. Seus dados continuam salvos neste dispositivo e poderão ser
            exportados ou recuperados.
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-2">
          <Button onClick={retryInitialization} className="gap-2">
            <RotateCcw />
            Tentar de novo
          </Button>
        </div>

        <p className="text-muted-foreground mt-5 font-mono text-[11px]">{error.code}</p>
      </div>
    </div>
  );
}
