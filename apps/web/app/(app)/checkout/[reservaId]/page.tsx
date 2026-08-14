import { CheckoutView } from './checkout-view';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ reservaId: string }>;
}) {
  const { reservaId } = await params;
  return <CheckoutView reservaId={reservaId} />;
}
