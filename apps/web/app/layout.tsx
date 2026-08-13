import type { Metadata } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import { SessionProvider } from '@/lib/session';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

// Usada so onde o valor e transcrito a mao: o codigo do ingresso na portaria.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Elite Events',
  description:
    'Sessoes de cinema, escolha de poltrona e ingresso com QR. Desafio Elite Dev.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* O header nao mora aqui: as telas de entrada usam o grupo (auth),
            que e centrado e sem navegacao. Ver app/(app)/layout.tsx. */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
