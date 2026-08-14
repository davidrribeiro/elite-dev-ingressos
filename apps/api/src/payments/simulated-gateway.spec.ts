import { chargeSimulated } from './simulated-gateway';

describe('chargeSimulated', () => {
  it('aprova o cartao de teste aprovado', () => {
    expect(chargeSimulated('4242424242424242')).toEqual({ status: 'APPROVED' });
  });

  it('recusa por saldo insuficiente', () => {
    expect(chargeSimulated('4000000000000002')).toEqual({
      status: 'DECLINED',
      declineReason: 'Saldo insuficiente',
    });
  });

  it('recusa por cartao expirado', () => {
    expect(chargeSimulated('4000000000000069')).toEqual({
      status: 'DECLINED',
      declineReason: 'Cartao expirado',
    });
  });

  it('recusa qualquer outro numero valido como nao reconhecido', () => {
    expect(chargeSimulated('5555555555554444')).toEqual({
      status: 'DECLINED',
      declineReason: 'Cartao nao reconhecido pela simulacao',
    });
  });

  it('normaliza espacos e hifens antes de decidir', () => {
    expect(chargeSimulated('4242 4242 4242 4242')).toEqual({
      status: 'APPROVED',
    });
    expect(chargeSimulated('4242-4242-4242-4242')).toEqual({
      status: 'APPROVED',
    });
  });

  it.each(['123', 'abcd', '', '42424242424242424242'])(
    'rejeita formato invalido sem cobrar nem recusar: %s',
    (numero) => {
      expect(chargeSimulated(numero)).toEqual({ status: 'INVALID_FORMAT' });
    },
  );
});
