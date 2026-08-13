import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Mensagem de erro. Presente = campo em estado invalido. */
  error?: string | null;
  /** Explicacao curta abaixo do campo. Some quando ha erro. */
  hint?: ReactNode;
}

/**
 * Rotulo, campo, dica e erro em uma peca so.
 *
 * Junto de proposito: separar Label e Input em dois componentes deixa cada
 * formulario responsavel por lembrar do htmlFor e do aria-describedby, e um
 * dia alguem esquece.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const gerado = useId();
  const campoId = id ?? gerado;
  const auxiliarId = `${campoId}-aux`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="font-medium text-ink">
        {label}
      </label>

      <input
        ref={ref}
        id={campoId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? auxiliarId : undefined}
        className={cn(
          'h-9 rounded-md border bg-surface px-3 text-ink',
          'placeholder:text-faint',
          error ? 'border-danger' : 'border-line-strong',
          'disabled:bg-surface-sunken disabled:text-faint',
          className,
        )}
        {...props}
      />

      {(error || hint) && (
        <p
          id={auxiliarId}
          className={cn('text-xs', error ? 'text-danger' : 'text-muted')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
