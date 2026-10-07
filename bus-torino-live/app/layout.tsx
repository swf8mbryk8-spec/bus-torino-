import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import ThemeToggle from '@/components/ThemeToggle';
import SwRegister from '@/components/SwRegister';

const font = Atkinson_Hyperlegible({ weight: ['400', '700'], subsets: ['latin'], display: 'swap', fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] });

export const metadata: Metadata = {
  title: { default: 'Bus Torino Live', template: '%s · Bus Torino Live' },
  description: 'Prossimi arrivi e posizione dei mezzi del trasporto pubblico di Torino e provincia, con dati aperti GTT.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Bus Torino', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  openGraph: { title: 'Bus Torino Live', description: 'Quando arriva il prossimo bus? Dati reali GTT, senza account.', type: 'website', locale: 'it_IT' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f3f5f7' }, { media: '(prefers-color-scheme: dark)', color: '#0e141a' }],
};

const themeScript = `try{var t=localStorage.getItem('btl:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={font.className} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <a className="skip" href="#main">Vai al contenuto</a>
        <header className="topbar">
          <Link href="/" className="brand">BUS TORINO LIVE</Link>
          <ThemeToggle />
        </header>
        <main id="main" className="page">{children}</main>
        <footer className="sitefoot">
          <Link href="/storico">Storico</Link>
          <Link href="/lines">Linee</Link>
          <Link href="/sources">Fonti e dati</Link>
          <Link href="/diagnostics">Diagnostica</Link>
          <span className="muted">Dati: GTT, licenza CC BY · Mappa © OpenStreetMap</span>
        </footer>
        <SwRegister />
      </body>
    </html>
  );
}
