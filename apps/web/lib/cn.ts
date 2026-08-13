/**
 * Junta classes ignorando falsy.
 *
 * Doze linhas no lugar de clsx + tailwind-merge. Nao ha conflito de classes
 * para resolver aqui porque os primitivos nao aceitam sobrescrita arbitraria
 * de estilo — quem precisa de outra aparencia usa outra variante.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
