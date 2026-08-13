'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, TOKEN_STORAGE_KEY } from './api';
import { isApiError } from './api-error';
import type { AuthResponse, Role, User } from './types';

interface SessionValue {
  user: User | null;
  /** Falso apenas na primeira leitura do token guardado. */
  loading: boolean;
  entrar: (email: string, password: string) => Promise<User>;
  cadastrar: (dados: {
    name: string;
    email: string;
    password: string;
  }) => Promise<User>;
  sair: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Sessao do usuario no navegador.
 *
 * O token fica em localStorage e nao em cookie httpOnly. E a escolha menos
 * segura das duas — um XSS alcanca o token —, e foi feita porque a API e um
 * servico separado com autenticacao Bearer: cookie httpOnly exigiria as
 * paginas passarem por um proxy no Next so para anexar o header, o que
 * duplicaria o caminho de rede de toda chamada. Registrado em docs/decisoes.md.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Revalida o token guardado contra a API em vez de confiar nele. Um token
  // expirado no localStorage renderizaria um header logado e derrubaria o
  // usuario no primeiro clique.
  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    let ativo = true;
    api
      .get<User>('/auth/me', undefined, { token })
      .then((encontrado) => {
        if (ativo) setUser(encontrado);
      })
      .catch((erro: unknown) => {
        // Token invalido some. Falha de rede nao: derrubar a sessao porque a
        // API piscou obrigaria a entrar de novo sem motivo.
        if (isApiError(erro) && erro.status === 401) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const guardar = useCallback(({ token, user: autenticado }: AuthResponse) => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(autenticado);
    return autenticado;
  }, []);

  const entrar = useCallback(
    async (email: string, password: string) =>
      guardar(await api.post<AuthResponse>('/auth/login', { email, password })),
    [guardar],
  );

  const cadastrar = useCallback(
    async (dados: { name: string; email: string; password: string }) =>
      guardar(await api.post<AuthResponse>('/auth/register', dados)),
    [guardar],
  );

  const sair = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  const valor = useMemo(
    () => ({ user, loading, entrar, cadastrar, sair }),
    [user, loading, entrar, cadastrar, sair],
  );

  return (
    <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const contexto = useContext(SessionContext);
  if (!contexto) {
    throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  }
  return contexto;
}

/** Para onde cada papel vai depois de entrar. */
export const AREA_INICIAL: Record<Role, string> = {
  CUSTOMER: '/',
  ORGANIZER: '/organizador',
  GATE: '/portaria',
};
