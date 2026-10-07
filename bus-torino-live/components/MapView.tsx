'use client';
import { useEffect, useRef } from 'react';
import type { Map as LMap, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapVehicle = {
  id: string; line: string | null; headsign: string | null; lat: number; lon: number; bearing: number | null;
  timestamp: number | null; label: string | null; source: string;
};
export type MapStop = { id: string; name: string; code?: string; lat: number; lon: number };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

type Props = {
  vehicles?: MapVehicle[];
  stops?: MapStop[];
  shapes?: [number, number][][];
  me?: { lat: number; lon: number } | null;
  fit?: boolean;
  height?: string;
  nowFn?: () => number;
  onBounds?: (bbox: string) => void;
};

export default function MapView({ vehicles = [], stops = [], shapes = [], me, fit = true, height = '60vh', nowFn = Date.now, onBounds }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layers = useRef<{ L: typeof import('leaflet'); veh: LayerGroup; stop: LayerGroup; shape: LayerGroup; me: LayerGroup } | null>(null);
  const fitted = useRef(false);
  const boundsCb = useRef(onBounds);
  boundsCb.current = onBounds;

  useEffect(() => {
    let dead = false;
    (async () => {
      const Lm: any = await import('leaflet');
      const L: typeof import('leaflet') = Lm.default ?? Lm;
      if (dead || !el.current || map.current) return;
      // Vista iniziale su Torino: è solo il punto di partenza della mappa, non un dato di servizio.
      const m = L.map(el.current, { zoomControl: true }).setView([45.07, 7.686], 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      map.current = m;
      layers.current = { L, shape: L.layerGroup().addTo(m), stop: L.layerGroup().addTo(m), veh: L.layerGroup().addTo(m), me: L.layerGroup().addTo(m) };
      const emit = () => { const b = m.getBounds(); boundsCb.current?.([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((x) => x.toFixed(4)).join(',')); };
      m.on('moveend', emit);
      emit();
      draw();
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; layers.current = null; fitted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const ly = layers.current, m = map.current;
    if (!ly || !m) return;
    const { L } = ly;
    ly.shape.clearLayers(); ly.stop.clearLayers(); ly.veh.clearLayers(); ly.me.clearLayers();
    const pts: [number, number][] = [];
    for (const s of shapes) { if (s.length) { L.polyline(s, { color: '#0a5cad', weight: 4, opacity: 0.8 }).addTo(ly.shape); pts.push(...s); } }
    for (const s of stops) {
      L.circleMarker([s.lat, s.lon], { radius: 5, color: '#14202b', weight: 2, fillColor: '#ffc72c', fillOpacity: 1 })
        .bindPopup(`<strong>${esc(s.name)}</strong>${s.code ? '<br>Codice ' + esc(s.code) : ''}<br><a href="/stop/${encodeURIComponent(s.id)}">Prossimi arrivi</a>`)
        .addTo(ly.stop);
      pts.push([s.lat, s.lon]);
    }
    const now = nowFn();
    for (const v of vehicles) {
      const age = v.timestamp ? now - v.timestamp : null;
      const old = age !== null && age > 120000;
      const rot = v.bearing ?? 0;
      const icon = L.divIcon({
        className: 'veh-icon',
        html: `<div class="veh ${old ? 'old' : ''}"><span class="veh-arrow" style="transform:rotate(${rot}deg);${v.bearing === null ? 'display:none' : ''}">▲</span><b>${esc(v.line || '?')}</b></div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      });
      const agoTxt = age === null ? 'orario del dato non indicato dal feed' : age < 90000 ? `${Math.round(age / 1000)} secondi fa` : `${Math.round(age / 60000)} minuti fa`;
      L.marker([v.lat, v.lon], { icon })
        .bindPopup(`<strong>Linea ${esc(v.line || 'sconosciuta')}</strong><br>${v.headsign ? 'Direzione ' + esc(v.headsign) + '<br>' : ''}Ultima posizione: ${agoTxt}${old ? ' (dato datato)' : ''}<br>Mezzo: ${esc(v.label || v.id)}<br>Fonte: ${esc(v.source)}`)
        .addTo(ly.veh);
      pts.push([v.lat, v.lon]);
    }
    if (me) {
      L.circleMarker([me.lat, me.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#1f6fd6', fillOpacity: 1 }).bindPopup('La tua posizione').addTo(ly.me);
      pts.push([me.lat, me.lon]);
    }
    if (fit && !fitted.current && pts.length) { m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 16 }); fitted.current = true; }
  }

  useEffect(draw, [vehicles, stops, shapes, me]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={el} className="map" style={{ height }} role="application" aria-label="Mappa interattiva" />;
}
