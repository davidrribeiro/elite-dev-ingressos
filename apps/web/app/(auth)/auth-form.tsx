'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { ErrorCode, isApiError } from '@/lib/api-error';
import { AREA_INICIAL, useSession } from '@/lib/session';

/**
 * Entrar e cadastrar sao o mesmo formulario com um campo a mais.
 *
 * Manter os dois em um componente so evita que a mensagem de erro e o
 * tratamento de foco divirjam entre telas que o usuario alterna o tempo todo.
 */
export function AuthForm({ modo }: { modo: 'entrar' | 'cadastrar' }) {
  const router = useRouter();
  const { entrar, cadastrar } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cadastrando = modo === 'cadastrar';

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const user = cadastrando
        ? await cadastrar({ name, email, password })
        : await entrar(email, password);

      // Cada papel cai na area que opera. Mandar a portaria para a listagem de
      // sessoes obrigaria a navegar ate a unica tela que ela usa.
      router.push(AREA_INICIAL[user.role]);
      router.refresh();
    } catch (causa) {
      setErro(mensagemDe(causa));
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 p-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">
            {cadastrando ? 'Criar conta' : 'Entrar'}
          </h1>
          <p className="mt-1 text-muted">
            {cadastrando
              ? 'A conta criada aqui e de cliente. Organizador e portaria vem semeados.'
              : 'Use uma das contas do seed para percorrer o fluxo.'}
          </p>
        </div>

        {erro && <Alert tone="danger">{erro}</Alert>}

        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          {cadastrando && (
            <Field
              label="Nome"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Field
            label="Senha"
            type="password"
            autoComplete={cadastrando ? 'new-password' : 'current-password'}
            required
            minLength={cadastrando ? 6 : undefined}
            hint={cadastrando ? 'Pelo menos 6 caracteres.' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" size="lg" loading={enviando}>
            {cadastrando ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>

        <p className="text-center text-muted">
          {cadastrando ? 'Ja tem conta? ' : 'Ainda nao tem conta? '}
          <Link
            href={cadastrando ? '/entrar' : '/cadastrar'}
            className="font-medium text-accent hover:underline"
          >
            {cadastrando ? 'Entrar' : 'Criar conta'}
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Traduz o erro da API para uma frase util.
 *
 * A decisao e pelo `code`, nunca pelo texto: a mensagem do servidor serve de
 * padrao, mas alguns casos merecem uma orientacao que so o front conhece.
 */
function mensagemDe(causa: unknown): string {
  if (!isApiError(causa)) {
    return 'Algo deu errado. Tente novamente.';
  }

  if (causa.is(ErrorCode.INVALID_CREDENTIALS)) {
    return 'E-mail ou senha incorretos.';
  }

  if (causa.is(ErrorCode.EMAIL_ALREADY_USED)) {
    return 'Ja existe uma conta com este e-mail. Tente entrar.';
  }

  if (causa.is(ErrorCode.VALIDATION_ERROR)) {
    return causa.fields[0] ?? 'Confira os dados preenchidos.';
  }

  if (causa.is(ErrorCode.NETWORK)) {
    return 'Nao consegui falar com o servidor. A API esta rodando na porta 3333?';
  }

  return causa.message;
}
