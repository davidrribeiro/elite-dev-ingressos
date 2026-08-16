'use client';

import { BrowserQRCodeReader } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';

/**
 * Leitura de QR pela camera.
 *
 * `@zxing/browser` sobre `html5-qrcode`: devolve o resultado decodificado e
 * deixa a interface por conta do autor, em vez de injetar a propria caixa de
 * scanner com botoes e bordas proprios. Ver research.md R6.
 *
 * `ativo` controla quando a camera esta ouvindo: o pai desliga enquanto
 * mostra um resultado, para o mesmo QR parado no quadro nao disparar dez
 * leituras seguidas do mesmo ingresso.
 */
export function QrScanner({
  ativo,
  onLeitura,
}: {
  ativo: boolean;
  onLeitura: (texto: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Ref, nao state: onLeitura pode mudar de identidade a cada render do pai,
  // e o efeito abaixo nao deve reiniciar a camera por causa disso. A
  // atribuicao mora num efeito proprio, sem deps — refs nao podem ser
  // escritas durante o render.
  const onLeituraRef = useRef(onLeitura);
  useEffect(() => {
    onLeituraRef.current = onLeitura;
  });

  const [statusCamera, setStatusCamera] = useState<'pedindo' | 'ok' | 'negada'>('pedindo');

  useEffect(() => {
    if (!ativo || !videoRef.current) return;

    let cancelado = false;
    let parar: (() => void) | null = null;

    new BrowserQRCodeReader()
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (resultado) => {
          if (resultado && !cancelado) {
            onLeituraRef.current(resultado.getText());
          }
        },
      )
      .then((controles) => {
        if (cancelado) {
          controles.stop();
          return;
        }
        setStatusCamera('ok');
        parar = () => controles.stop();
      })
      .catch(() => {
        // Permissao negada, sem camera no dispositivo, ou fora de contexto
        // seguro (getUserMedia exige https ou localhost). A digitacao
        // manual continua funcionando — a camera e conveniencia, nao o
        // unico caminho.
        if (!cancelado) setStatusCamera('negada');
      });

    return () => {
      cancelado = true;
      parar?.();
    };
  }, [ativo]);

  if (!ativo) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-sunken">
      {statusCamera === 'negada' && (
        <div className="p-4 text-center">
          <p className="font-medium text-ink">Nao foi possivel abrir a camera</p>
          <p className="mt-1 text-muted">
            Isso e esperado fora de <code className="font-mono">https</code>{' '}
            ou <code className="font-mono">localhost</code> — o navegador
            bloqueia o acesso a camera em qualquer outro endereco. Use a
            digitacao manual abaixo.
          </p>
        </div>
      )}

      {/* O video fica montado mesmo enquanto a permissao ainda nao respondeu,
          porque decodeFromConstraints precisa do elemento pronto para anexar
          o stream assim que a permissao for concedida. */}
      <video
        ref={videoRef}
        className={statusCamera === 'negada' ? 'hidden' : 'aspect-square w-full object-cover'}
        muted
        playsInline
      />
    </div>
  );
}
