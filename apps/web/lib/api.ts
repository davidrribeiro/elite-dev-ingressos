import { ApiError, ApiErrorBody, ErrorCode } from './api-error';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

/** Chave do token no navegador. Exportada porque o contexto de sessao a usa. */
export const TOKEN_STORAGE_KEY = 'elite.token';

export interface RequestOptions {
  /**
   * Token explicito. Sem ele, o fetcher pega o do navegador.
   *
   * Server Component nao tem localStorage, entao quem chama do servidor
   * precisa passar o token na mao — ou nao passar nenhum, para rota publica.
   */
  token?: string | null;
  signal?: AbortSignal;
  /** Repassado ao fetch do Next para controlar cache e revalidacao. */
  cache?: RequestCache;
}

function tokenDoNavegador(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const token = options.token !== undefined ? options.token : tokenDoNavegador();

  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
      cache: options.cache,
    });
  } catch (causa) {
    // A requisicao nem chegou na API: rede fora, servidor parado, CORS.
    // Vira ApiError igual as demais para a tela ter um unico caminho de erro.
    if (causa instanceof DOMException && causa.name === 'AbortError') throw causa;
    throw new ApiError(
      ErrorCode.NETWORK,
      'Nao consegui falar com o servidor. Confira se a API esta no ar.',
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw paraApiError(payload, response.status);
  }

  return payload as T;
}

/**
 * Desembrulha o envelope `{ error: { code, message, details } }`.
 *
 * Se a resposta nao tiver esse formato — um 502 do proxy, uma pagina de erro
 * em HTML — cai em INTERNAL com o status real preservado, em vez de estourar
 * um TypeError dentro do catch de quem chamou.
 */
function paraApiError(payload: unknown, status: number): ApiError {
  const envelope = payload as ApiErrorBody | null;
  const erro = envelope?.error;

  if (!erro || typeof erro.code !== 'string') {
    return new ApiError(
      ErrorCode.INTERNAL,
      'Erro inesperado no servidor.',
      status,
    );
  }

  return new ApiError(erro.code, erro.message, status, erro.details);
}

function comQuery(path: string, params?: Record<string, string | undefined>) {
  if (!params) return path;

  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') query.set(chave, valor);
  }

  const texto = query.toString();
  return texto ? `${path}?${texto}` : path;
}

export const api = {
  get<T>(
    path: string,
    params?: Record<string, string | undefined>,
    options?: RequestOptions,
  ) {
    return request<T>('GET', comQuery(path, params), undefined, options);
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('POST', path, body, options);
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('PATCH', path, body, options);
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>('DELETE', path, undefined, options);
  },
};

export { ApiError, ErrorCode, isApiError } from './api-error';
