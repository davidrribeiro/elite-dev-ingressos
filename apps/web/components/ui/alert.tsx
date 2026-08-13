import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'ok' | 'warn' | 'danger';

const tons: Record<Tone, string> = {
  info: 'bg-accent-soft border-accent/25 text-accent',
  ok: 'bg-ok-soft border-ok/25 text-ok',
  warn: 'bg-warn-soft border-warn/25 text-warn',
  danger: 'bg-danger-soft border-danger/25 text-danger',
};

/**
 * Aviso no fluxo da pagina.
 *
 * `role="alert"` no tom de erro para o leitor de tela anunciar sem o usuario
 * precisar navegar ate o texto: recusa de pagamento e assento tomado aparecem
 * longe do ponto de foco.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn('rounded-md border px-3 py-2', tons[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
    </div>
  );
}
