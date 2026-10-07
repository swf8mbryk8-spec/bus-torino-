export type Stop = { i: string; c: string; n: string; d: string; la: number; lo: number; r: string[] };
export type Route = { id: string; s: string; l: string; t: number };
export type Service = { id: string; d: number[]; s: string; e: string; add: string[]; rem: string[] };

/** Livelli di affidabilità mostrati all'utente. */
export type Tier = 'live' | 'prevision' | 'scheduled' | 'stale' | 'unavailable';

export type Arrival = {
  tripId: string;
  routeId: string;
  line: string;
  headsign: string;
  tier: Tier;
  /** epoch ms dell'orario da mostrare (previsto se realtime, programmato altrimenti) */
  time: number;
  /** orario programmato, se noto */
  scheduled: number | null;
  /** ritardo in secondi, solo se il feed lo fornisce o è calcolabile da una previsione reale */
  delaySec: number | null;
  /** epoch ms dell'ultimo dato realtime usato (feed o veicolo); null se programmato */
  dataTimestamp: number | null;
  vehicleId: string | null;
  source: string;
  note?: string;
  /** Affidabilità calcolata dai dati (solo per arrivi con previsione realtime). */
  confidence: 'high' | 'medium' | 'low' | null;
  /** Motivi leggibili dell'affidabilità. */
  why: string[];
  /** Distanza in linea d'aria tra il mezzo e la fermata, se c'è un GPS recente. */
  distanceM: number | null;
  approaching: boolean | null;
  moving: boolean | null;
  gpsAgeMs: number | null;
  /** Il feed GPS indica il mezzo alla fermata. */
  atStop: boolean;
};

export type VehiclePos = {
  id: string;
  label: string | null;
  tripId: string | null;
  routeId: string | null;
  line: string | null;
  headsign: string | null;
  lat: number;
  lon: number;
  bearing: number | null;
  speed: number | null;
  /** 0 in arrivo, 1 fermo alla fermata, 2 in transito verso la fermata (GTFS-RT current_status) */
  status: number | null;
  stopId: string | null;
  timestamp: number | null; // epoch ms
  source: string;
};

export type AlertItem = {
  id: string;
  header: string;
  description: string;
  url: string | null;
  routeIds: string[];
  stopIds: string[];
  start: number | null;
  end: number | null;
};
