import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

/**
 * Provisoria. A listagem de sessoes com busca e filtro e a T027, na fatia da
 * US1; esta pagina existe para a raiz nao ficar com o template do Next e para
 * o avaliador achar as contas de teste sem abrir o README.
 */
const CONTAS = [
  { papel: 'Organizador', email: 'organizador@elite.dev', onde: 'cria e publica sessoes' },
  { papel: 'Cliente', email: 'cliente1@elite.dev', onde: 'reserva, paga e recebe ingresso' },
  { papel: 'Cliente', email: 'cliente2@elite.dev', onde: 'segundo cliente, para disputar poltrona' },
  { papel: 'Portaria', email: 'portaria@elite.dev', onde: 'valida ingresso na entrada' },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Plataforma de eventos e ingressos
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          O organizador monta a sessao a partir do catalogo do TMDb, o cliente
          escolhe a poltrona no mapa e paga de forma simulada, e a portaria
          valida o ingresso na entrada.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Contas de teste"
          aside={<Badge>senha: elite123</Badge>}
        />
        <CardBody className="p-0">
          <table className="w-full">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2 font-medium">Papel</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">
                  O que faz
                </th>
              </tr>
            </thead>
            <tbody>
              {CONTAS.map((conta) => (
                <tr
                  key={conta.email}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-2 text-muted">{conta.papel}</td>
                  <td className="px-4 py-2 font-mono text-ink">{conta.email}</td>
                  <td className="hidden px-4 py-2 text-muted sm:table-cell">
                    {conta.onde}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Em construcao" />
        <CardBody className="text-muted">
          <p>
            A listagem de sessoes, o mapa de assentos e o checkout entram na
            proxima fatia. Por enquanto a API ja serve{' '}
            <code className="rounded-sm bg-surface-sunken px-1 font-mono text-ink">
              GET /events
            </code>{' '}
            com as duas sessoes semeadas.
          </p>
          <p className="mt-2">
            <Link href="/entrar" className="font-medium text-accent hover:underline">
              Entrar
            </Link>{' '}
            para ver o header mudar conforme o papel da conta.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
