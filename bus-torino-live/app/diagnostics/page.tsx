import type { Metadata } from 'next';
import Diag from '@/components/Diag';

export const metadata: Metadata = { title: 'Diagnostica' };

export default function Page() {
  return (<><h1>Diagnostica dei dati</h1><Diag /></>);
}
