import type { Metadata } from 'next';
import LineView from '@/components/LineView';

type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  return { title: `Linea ${decodeURIComponent(id)}` };
}

export default async function Page({ params }: P) {
  const { id } = await params;
  return <LineView id={decodeURIComponent(id)} />;
}
