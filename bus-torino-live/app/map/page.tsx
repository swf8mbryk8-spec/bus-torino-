import type { Metadata } from 'next';
import LiveMap from '@/components/LiveMap';

export const metadata: Metadata = { title: 'Mappa live' };

export default async function Page({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  return (<><h1>🗺️ Mappa live</h1><LiveMap initialLine={line || ''} /></>);
}
