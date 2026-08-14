import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { CatalogMovie, TmdbMovie, TmdbPage } from './catalog.types';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const REQUEST_TIMEOUT_MS = 8000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Busca por titulo. Sem termo, devolve o que esta em cartaz no Brasil — que e
   * o que o enunciado pede quando fala em "filmes em cartaz".
   */
  async searchMovies(query?: string): Promise<CatalogMovie[]> {
    const trimmed = query?.trim();

    const page = trimmed
      ? await this.get<TmdbPage>('/search/movie', {
          query: trimmed,
          include_adult: 'false',
        })
      : await this.get<TmdbPage>('/movie/now_playing', { region: 'BR' });

    return page.results.map((movie) => this.normalize(movie));
  }

  async getMovie(tmdbId: number): Promise<CatalogMovie> {
    const movie = await this.get<TmdbMovie>(`/movie/${tmdbId}`);
    return this.normalize(movie);
  }

  private normalize(movie: TmdbMovie): CatalogMovie {
    const posterPath = movie.poster_path ?? null;
    return {
      tmdbId: movie.id,
      title: movie.title,
      overview: movie.overview?.trim() || null,
      posterPath,
      posterUrl: this.posterUrl(posterPath),
      releaseDate: movie.release_date || null,
    };
  }

  /** Monta a URL publica do poster. O TMDb serve a imagem em outro dominio. */
  posterUrl(posterPath: string | null, size = 'w500'): string | null {
    if (!posterPath) return null;
    const base = this.config.getOrThrow<string>('TMDB_IMAGE_BASE_URL');
    return `${base}/${size}${posterPath}`;
  }

  /**
   * Chamada ao TMDb com cache em memoria.
   *
   * O cache existe porque a busca do organizador dispara a cada tecla digitada;
   * sem ele, a chave gratuita bate no limite de requisicoes no primeiro teste
   * serio de digitacao. TTL curto porque catalogo de cinema muda devagar.
   */
  private async get<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const cacheKey = url.toString();

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Rede fora, DNS, timeout. O organizador precisa saber que o problema e
      // do catalogo externo, nao do formulario dele.
      this.logger.error(`TMDb inacessivel em ${path}`, error as Error);
      throw new AppError(
        ErrorCode.CATALOG_UNAVAILABLE,
        'O catalogo de filmes esta indisponivel. Tente em instantes.',
        502,
      );
    }

    if (response.status === 404) {
      throw new AppError(
        ErrorCode.MOVIE_NOT_FOUND,
        'Filme nao encontrado no catalogo.',
        404,
      );
    }

    if (!response.ok) {
      this.logger.error(`TMDb respondeu ${response.status} em ${path}`);
      throw new AppError(
        ErrorCode.CATALOG_UNAVAILABLE,
        'O catalogo de filmes recusou a consulta. Confira a TMDB_API_KEY.',
        502,
      );
    }

    const value = (await response.json()) as T;
    this.cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /**
   * O TMDb tem duas credenciais na mesma tela de configuracoes: a API Key
   * curta (autenticacao v3, vai na query string) e o API Read Access Token
   * (autenticacao v4, um JWT, vai no header `Authorization`). As duas
   * funcionam para as rotas de leitura usadas aqui.
   *
   * Em vez de exigir uma das duas e falhar com 401 sem explicar por que,
   * detecta o formato: um JWT tem tres segmentos separados por ponto: header,
   * payload e assinatura. Nenhuma API Key v3 tem ponto no meio.
   */
  /** Um JWT tem tres segmentos separados por ponto; a API Key v3 nao tem ponto. */
  private isV4Token(apiKey: string): boolean {
    return apiKey.split('.').length === 3;
  }

  private buildHeaders(): HeadersInit {
    const apiKey = this.config.getOrThrow<string>('TMDB_API_KEY');
    const headers: HeadersInit = { accept: 'application/json' };

    if (this.isV4Token(apiKey)) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  private buildUrl(path: string, params: Record<string, string>): URL {
    const url = new URL(
      `${this.config.getOrThrow<string>('TMDB_BASE_URL')}${path}`,
    );

    const apiKey = this.config.getOrThrow<string>('TMDB_API_KEY');
    // Chave v3: vai na query. Token v4 ja foi anexado como Bearer em
    // buildHeaders() e nao deve duplicar aqui.
    if (!this.isV4Token(apiKey)) {
      url.searchParams.set('api_key', apiKey);
    }

    url.searchParams.set('language', 'pt-BR');

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url;
  }
}
