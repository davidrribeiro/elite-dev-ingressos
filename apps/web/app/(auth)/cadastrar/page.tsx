import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Criar conta | Elite Events' };

export default function CadastrarPage() {
  return <AuthForm modo="cadastrar" />;
}
