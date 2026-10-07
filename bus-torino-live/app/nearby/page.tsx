import type { Metadata } from 'next';
import NearbyView from '@/components/NearbyView';

export const metadata: Metadata = { title: 'Vicino a te' };

export default function Page() {
  return (<><h1>📍 Vicino a te</h1><NearbyView /></>);
}
