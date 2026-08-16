'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * `/portaria` sozinha nao e uma tela — o layout ja garantiu que existe
 * sessao escolhida antes de chegar aqui, entao so falta decidir para onde
 * ir: direto para validar.
 */
export default function PortariaIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portaria/validar');
  }, [router]);

  return null;
}
