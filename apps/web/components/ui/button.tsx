import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantes: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover disabled:bg-line-strong disabled:text-faint',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-sunken disabled:text-faint',
  ghost: 'text-muted hover:text-ink hover:bg-surface-sunken',
  danger: 'bg-danger text-white hover:brightness-90 disabled:bg-line-strong',
};

const tamanhos: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3.5',
  lg: 'h-11 px-5 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Bloqueia o clique e troca o rotulo. Usado no envio de formulario. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        // `loading` desabilita de verdade em vez de so mudar a aparencia: sem
        // isso, o duplo clique no pagamento vira duas requisicoes. A defesa
        // real esta no servidor, mas nao ha motivo para provoca-la aqui.
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium',
          'transition-colors disabled:cursor-not-allowed',
          variantes[variant],
          tamanhos[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
