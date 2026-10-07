import type { Metadata } from 'next';
import SourcesLive from '@/components/SourcesLive';

export const metadata: Metadata = { title: 'Fonti e dati' };

const rows = [
  { name: 'GTT GTFS-RT (aperTO, Città di Torino)', site: 'https://aperto.comune.torino.it/dataset/feed-gtfs-real-time-trasporti-gtt', type: 'Passaggi, posizione mezzi, avvisi', rt: 'Sì', gps: 'Sì', pred: 'Sì', freq: 'Dichiarata “continua”; l’intervallo reale è misurato in Diagnostica', lim: 'Copertura per linea non garantita dalla scheda: vedi Diagnostica. Licenza CC BY.' },
  { name: 'GTT GTFS statico (aperTO)', site: 'https://aperto.comune.torino.it/dataset/feed-gtfs-trasporti-gtt', type: 'Linee, fermate, percorsi, orari programmati', rt: 'No', gps: 'No', pred: 'No', freq: 'Rigenerato a ogni pubblicazione del sito (vedi data qui sotto)', lim: 'Orari teorici: non sono arrivi realtime. Licenza CC BY.' },
  { name: 'OpenStreetMap', site: 'https://www.openstreetmap.org/copyright', type: 'Mappa di sfondo', rt: 'No', gps: 'No', pred: 'No', freq: '—', lim: 'Server tile pubblici per uso moderato: per traffico alto serve un fornitore di tile dedicato.' },
];

export default function Page() {
  return (
    <>
      <h1>Fonti e dati</h1>
      <p>Qui sono elencate solo le fonti effettivamente usate dal sito. Se una fonte non è utilizzabile in modo legittimo e automatico, non è inclusa.</p>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Fonte</th><th>Dati</th><th>Realtime</th><th>GPS</th><th>Previsioni</th><th>Aggiornamento</th><th>Limiti</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td><a href={r.site} target="_blank" rel="noopener noreferrer">{r.name}</a></td>
                <td>{r.type}</td><td>{r.rt}</td><td>{r.gps}</td><td>{r.pred}</td><td>{r.freq}</td><td>{r.lim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourcesLive />
      <h2>Come sono classificati gli arrivi</h2>
      <ul className="plain">
        <li>🟢 <strong>Live</strong>: previsione GTT per quella corsa più posizione GPS del mezzo aggiornata da meno di 90 secondi.</li>
        <li>🔵 <strong>Previsione</strong>: previsione GTT per quella corsa, senza GPS recente.</li>
        <li>⚪ <strong>Programmato</strong>: orario teorico da tabella. Non è un arrivo realtime.</li>
        <li>🟠 <strong>Datato</strong>: dato realtime più vecchio di 2 minuti, mostrato con la sua età.</li>
        <li>🔴 <strong>Non disponibile</strong>: nessun dato utilizzabile (ad esempio corsa soppressa).</li>
      </ul>
      <p className="muted">Le soglie di 90 secondi e 2 minuti sono scelte del progetto, non valori dichiarati da GTT.</p>
      <h2>Fonti valutate e non usate</h2>
      <ul className="plain">
        <li><strong>Regione Piemonte / Agenzia della Mobilità Piemontese</strong>: pubblica GTFS programmato (escluso il servizio urbano di Torino), ma non risulta un feed realtime aperto.</li>
        <li><strong>Moovit / MooveTO</strong>: API commerciale a pagamento e contenuti proprietari.</li>
        <li><strong>Extra.To / ExtraMove</strong>: dati realtime solo dentro l’app, nessuna API aperta trovata.</li>
        <li><strong>API non ufficiali</strong>: non verificabili, non usate.</li>
      </ul>
    </>
  );
}
