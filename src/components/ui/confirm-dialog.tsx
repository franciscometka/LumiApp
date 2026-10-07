'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Confirmacao de acao destrutiva.
 *
 * Nao usa `window.confirm`: ele nao e estilizavel, aparece fora do app e, no
 * iOS, pode ser suprimido. Tambem nao reaproveita a `Sheet`, porque esta
 * caixa precisa ser modal de verdade — nada atras dela deve ser clicavel
 * enquanto a pergunta esta aberta.
 *
 * O botao de confirmar fica a direita e carrega o verbo da acao ("Excluir"),
 * nunca "OK": quem le rapido precisa saber o que vai acontecer pela palavra
 * do botao, nao pelo texto acima dele.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  isPending = false,
  tone = 'destructive',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  tone?: 'destructive' | 'default';
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'bg-card fixed top-1/2 left-1/2 z-[60] w-[min(24rem,calc(100vw-2rem))]',
            '-translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-xl',
          )}
          // Fechar com Esc ou clicando fora equivale a cancelar, nunca a
          // confirmar: o caminho acidental tem de ser sempre o seguro.
          onEscapeKeyDown={() => {
            if (isPending) return;
            onOpenChange(false);
          }}
        >
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            {description}
          </DialogPrimitive.Description>

          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={tone === 'destructive' ? 'destructive' : 'default'}
              className="flex-1"
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
