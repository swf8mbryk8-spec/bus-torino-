import type { Metadata } from 'next';
import HistoryView from '@/components/HistoryView';

export const metadata: Metadata = { title: 'Storico e stime' };

export default function Page() {
  return (<><h1>Storico e stime</h1><HistoryView /></>);
}
