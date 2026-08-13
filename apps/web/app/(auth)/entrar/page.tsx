import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Entrar | Elite Events' };

export default function EntrarPage() {
  return <AuthForm modo="entrar" />;
}
