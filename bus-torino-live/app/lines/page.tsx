import type { Metadata } from 'next';
import AllLines from '@/components/AllLines';

export const metadata: Metadata = { title: 'Tutte le linee' };

export default function Page() {
  return (<><h1>Tutte le linee</h1><AllLines /></>);
}
