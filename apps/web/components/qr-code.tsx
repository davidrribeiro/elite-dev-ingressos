'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/**
 * QR do ingresso.
 *
 * O plano original (research.md R7) previa SVG gerado em Server Component,
 * zero JS no cliente. Nao da: o ingresso e dado do dono, autenticado por
 * token em localStorage, e um Server Component nao tem acesso a
 * localStorage — so da para buscar o `code` depois que o componente montou
 * no navegador. A geracao do SVG continua sincrona e sem rede, so que aqui
 * dentro em vez de no servidor.
 */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    QRCode.toString(value, { type: 'svg', margin: 1, width: size })
      .then((gerado) => {
        if (ativo) setSvg(gerado);
      })
      .catch(() => {
        // QR e conveniencia, nao o unico caminho: a portaria aceita
        // digitacao manual. Uma falha aqui nao pode quebrar a tela inteira.
        if (ativo) setSvg(null);
      });

    return () => {
      ativo = false;
    };
  }, [value, size]);

  if (!svg) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-md bg-surface-sunken"
        aria-label="Gerando QR"
      />
    );
  }

  return (
    // O SVG vem de QRCode.toString() a partir de `value`, que so contem o
    // alfabeto Crockford do codigo do ingresso (0-9, A-Z sem I/L/O/U) —
    // nunca texto de usuario. Nao ha caminho para HTML arbitrario chegar
    // aqui, entao dangerouslySetInnerHTML nao abre brecha nenhuma.
    <div
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
