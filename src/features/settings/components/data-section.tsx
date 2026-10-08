'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ImportPreview } from '@/data/ports/data-source';
import { isDataError } from '@/data/ports/errors';
import { todayPlainDate } from '@/domain/shared/plain-date';

import { useDataSource } from '../../app/data-source-context';
import { backupFileName, describeImportPreview } from '../settings-form';
import { resetAllData } from '../use-settings';

interface PendingImport {
  readonly content: string;
  readonly fileName: string;
  readonly preview: ImportPreview;
}

type Notice = { readonly tone: 'ok' | 'error'; readonly text: string } | null;

/**
 * Exportar, importar e apagar — tudo pela \`MaintenanceApi\`, sem um segundo
 * sistema de backup.
 *
 * Os dados vivem no localStorage DESTE navegador: nao vao para o GitHub nem
 * para outro computador sozinhos. O backup e o caminho para levar os dados a
 * outro PC, guardar uma copia e restaurar depois — e a tela diz isso.
 *
 * Importar e tudo ou nada:
 *   arquivo -> \`previewImport\` (valida tudo, nao grava) -> confirmacao
 *   -> \`importJson\` (mesma validacao, uma escrita) -> \`resetAllData\`.
 * Um arquivo invalido para no primeiro passo e o banco atual fica intacto.
 */
export function DataSection() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const exportBackup = useMutation<void, Error>({
    mutationFn: async () => {
      const content = await dataSource.maintenance.exportJson();
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName(todayPlainDate());
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      setNotice({ tone: 'ok', text: 'Backup exportado. Guarde o arquivo em um lugar seguro.' });
    },
    onError: () => {
      setNotice({ tone: 'error', text: 'Não foi possível exportar. Nada foi alterado.' });
    },
  });

  const inspectFile = useMutation<PendingImport, Error, File>({
    mutationFn: async (file) => {
      const content = await file.text();
      const preview = await dataSource.maintenance.previewImport(content);
      return { content, fileName: file.name, preview };
    },
    onSuccess: (pending) => {
      setNotice(null);
      setPendingImport(pending);
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        text: `${isDataError(error) ? error.message : 'Não foi possível ler o arquivo.'} Seus dados atuais não foram alterados.`,
      });
    },
  });

  const applyImport = useMutation<void, Error, PendingImport>({
    mutationFn: async (pending) => {
      await dataSource.maintenance.importJson(pending.content);
      await resetAllData(queryClient);
    },
    onSuccess: () => {
      setPendingImport(null);
      setNotice({ tone: 'ok', text: 'Backup importado. O app já mostra os dados do arquivo.' });
    },
    onError: (error) => {
      setPendingImport(null);
      setNotice({
        tone: 'error',
        text: `${isDataError(error) ? error.message : 'Não foi possível importar.'} Seus dados atuais não foram alterados.`,
      });
    },
  });

  const applyReset = useMutation<void, Error>({
    mutationFn: async () => {
      await dataSource.maintenance.reset('apagar-tudo');
      await resetAllData(queryClient);
    },
    onSuccess: () => {
      setConfirmReset(false);
      setNotice({ tone: 'ok', text: 'Dados apagados. Categorias e preferências foram mantidas.' });
    },
    onError: () => {
      setConfirmReset(false);
      setNotice({ tone: 'error', text: 'Não foi possível apagar. Nada foi alterado.' });
    },
  });

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Dados</h2>

      <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
        Seus dados ficam salvos{' '}
        <strong className="text-foreground font-medium">só neste navegador</strong>. Eles não vão
        para o GitHub nem para outro computador sozinhos. Use o backup para guardar uma cópia, levar
        os dados para outro PC ou navegador e restaurá-los depois.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          onClick={() => {
            exportBackup.mutate();
          }}
          disabled={exportBackup.isPending}
          className="justify-start gap-2"
        >
          {exportBackup.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Exportar backup
        </Button>

        <Button
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={inspectFile.isPending || applyImport.isPending}
          className="justify-start gap-2"
        >
          {inspectFile.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          Importar backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Limpa o seletor: escolher o mesmo arquivo de novo precisa
            // disparar outra leitura.
            event.target.value = '';
            if (file !== undefined) inspectFile.mutate(file);
          }}
        />
      </div>

      {notice === null ? null : (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={
            notice.tone === 'error'
              ? 'bg-expense-surface text-expense mt-4 rounded-lg px-3 py-2.5 text-sm'
              : 'bg-muted/60 text-foreground mt-4 rounded-lg px-3 py-2.5 text-sm'
          }
        >
          {notice.text}
        </p>
      )}

      <div className="mt-6 border-t pt-5">
        <p className="text-sm font-medium">Apagar dados</p>
        <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
          Remove transações, planos, cartões, dívidas e contas recorrentes deste navegador.
          Categorias e preferências continuam.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setConfirmReset(true);
          }}
          className="text-expense hover:text-expense mt-3 gap-2"
        >
          <Trash2 />
          Apagar dados
        </Button>
      </div>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open && !applyImport.isPending) setPendingImport(null);
        }}
        title="Substituir seus dados?"
        description={
          pendingImport === null
            ? ''
            : `"${pendingImport.fileName}" traz ${describeImportPreview(pendingImport.preview)}. Tudo o que está neste navegador agora será substituído por ele. Se quiser guardar a versão atual, cancele e exporte um backup antes.`
        }
        confirmLabel="Substituir dados"
        isPending={applyImport.isPending}
        onConfirm={() => {
          if (pendingImport !== null) applyImport.mutate(pendingImport);
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={(open) => {
          if (!applyReset.isPending) setConfirmReset(open);
        }}
        title="Apagar todos os dados?"
        description="Serão removidos deste navegador: transações, planos, cartões, dívidas e contas recorrentes. Categorias e preferências continuam, e os dados de demonstração não voltam. Isso não pode ser desfeito — exporte um backup antes se quiser guardar uma cópia."
        confirmLabel="Apagar dados"
        isPending={applyReset.isPending}
        onConfirm={() => {
          applyReset.mutate();
        }}
      />
    </section>
  );
}
