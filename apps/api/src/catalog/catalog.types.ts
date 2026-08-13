/**
 * Filme ja normalizado.
 *
 * O front nunca ve o formato do TMDb: se o catalogo mudar de provedor ou de
 * contrato, a mudanca para aqui. Ver docs/contrato-api.md.
 */
export interface CatalogMovie {
  tmdbId: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
}

/** Resposta crua do TMDb, so os campos que consumimos. */
export interface TmdbMovie {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
}

export interface TmdbPage {
  results: TmdbMovie[];
}
