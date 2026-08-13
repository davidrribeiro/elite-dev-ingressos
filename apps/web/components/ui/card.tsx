import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Superficie elevada. Borda em vez de sombra: o partido e chapado. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  aside,
  className,
}: {
  title: ReactNode;
  /** Canto direito: etiqueta de estado, acao secundaria, contagem. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-line px-4 py-3',
        className,
      )}
    >
      <h2 className="font-semibold text-ink">{title}</h2>
      {aside}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
