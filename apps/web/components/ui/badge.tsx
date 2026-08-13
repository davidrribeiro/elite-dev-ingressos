import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

const tons: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/20',
  ok: 'bg-ok-soft text-ok border-ok/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
};

/**
 * Etiqueta de estado. Usada em status de sessao, de pedido e de ingresso.
 *
 * Nao serve para o resultado da portaria: la o retorno precisa ser legivel a
 * alguns passos de distancia, o que pede um bloco proprio e nao uma etiqueta.
 */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-1.5 py-0.5',
        'text-xs font-medium uppercase tracking-wide',
        tons[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
