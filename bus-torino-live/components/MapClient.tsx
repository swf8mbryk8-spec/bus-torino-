'use client';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div className="map muted" style={{ height: '60vh', display: 'grid', placeItems: 'center' }}>Carico la mappa…</div> });
export default MapView;
