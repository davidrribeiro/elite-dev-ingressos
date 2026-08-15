import { TicketView } from './ticket-view';

export default async function IngressoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketView ticketId={id} />;
}
