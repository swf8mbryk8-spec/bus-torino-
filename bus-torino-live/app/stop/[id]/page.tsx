import type { Metadata } from 'next';
import StopView from '@/components/StopView';
import { dataAvailable, stopById } from '@/lib/data';

type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const s = dataAvailable() ? stopById(decodeURIComponent(id)) : undefined;
  return { title: s ? `Fermata ${s.n}` : 'Fermata', description: s ? `Prossimi arrivi alla fermata ${s.n}` : undefined };
}

export default async function Page({ params }: P) {
  const { id } = await params;
  return <StopView id={decodeURIComponent(id)} />;
}
