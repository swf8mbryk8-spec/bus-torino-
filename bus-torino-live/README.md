# Bus Torino Live

Prossimi arrivi e posizione dei mezzi GTT (Torino e provincia). Mobile-first, PWA, senza account.
Next.js 15 + TypeScript, Leaflet + OpenStreetMap. Nessun dato è scritto a mano: linee, fermate e orari
vengono dal GTFS statico GTT; arrivi, GPS e avvisi dal feed GTFS-RT GTT.

## Stato della verifica (leggere prima di pubblicare)
Questo codice è stato scritto in un ambiente **senza accesso di rete e senza `npm install`**. È stato provato solo:
- lo script `scripts/build-data.ts` su un GTFS minimo di prova (virgolette nei CSV, orari oltre le 24:00, orari mancanti);
- la logica degli arrivi (`lib/arrivals.ts`) con un feed simulato: LIVE, PREVISIONE, PROGRAMMATO, DATATO, corsa soppressa, fonte non raggiungibile.

**Provati con `npm test` (dopo `npm install`): stima, storico e ricerca. Non è stato provato:** `next build`, l'interfaccia nel browser, il download del GTFS reale, la lettura dei feed GTT reali.
Dopo il primo deploy apri `/diagnostics`: mostra se le linee 45/81/43 sono nel feed realtime e se gli ID statico/realtime coincidono.

## Novità della versione 2
- Qualsiasi linea e fermata dei dati GTT (nessuna lista fissa; 45/81/43 sono solo il valore iniziale delle "mie linee"); pagina `/lines` con tutte le linee.
- Ricerca tollerante agli errori (propria, senza librerie esterne) su nome, indirizzo/zona, codice fermata, linea e destinazione; suggerimenti "Forse cercavi".
- Fermate salvate con nome personalizzato (Casa, Lavoro…), con prossimi passaggi nella home.
- Storico dei passaggi **solo locale** (`localStorage`) e stima dal ritardo mediano con affidabilità calcolata dai dati: vedi `/storico`.
- Test automatici: `npm test` (stima, storico e ricerca).

## Versione 3: passaggi in tempo reale
- Per ogni passaggio: conto alla rovescia (N min → "In arrivo" → "Alla fermata"), orario stimato, ritardo, direzione, distanza in linea d'aria del mezzo, se si avvicina o è in movimento, età del dato.
- Colore = affidabilità calcolata (`lib/confidence.ts`, regole nel file): 🟢 alta, 🟡 media, 🔴 bassa, 🟠 dato realtime datato, ⚪ solo programmato. Con "Perché?" si vedono i motivi.
- Senza GPS recente non è mai verde. Previsione incoerente con la distanza => rossa. Orario programmato mai presentato come realtime.
- Realtime + storico: se la previsione GTT differisce di oltre 5 min dal ritardo tipico del tuo storico (≥5 passaggi), l'affidabilità scende di un livello. Senza realtime si mostra la stima dallo storico, dichiarata come tale.
- Non implementato: tempo di arrivo calcolato dalla sola posizione GPS (servirebbe un modello di percorso e dati di viaggio che qui non ci sono). La distanza è in linea d'aria, non sul percorso stradale.
- Da verificare sul feed reale (`/diagnostics`): che le posizioni dei mezzi riportino `trip_id` e che le previsioni abbiano orari per fermata.

## Come si registra lo storico (limite importante)
GTT non fornisce lo storico dei passaggi. L'app lo costruisce da sola: mentre una pagina fermata è aperta, osserva le corse con previsione realtime;
quando una corsa sparisce dopo l'orario previsto, salva il ritardo dell'ultima previsione vista (solo se vista entro 4 minuti dal passaggio).
Quindi: lo storico cresce solo se apri le fermate, è per dispositivo, e misura la previsione GTT, non l'arrivo GPS effettivo.
Per raccogliere dati anche ad app chiusa serve un server con database e un job periodico (es. Vercel Cron + Upstash/Neon): non incluso.

## Avvio locale
```bash
npm install
cp .env.example .env.local   # opzionale
npm run data                 # scarica il GTFS e genera ./data
npm run dev
```

## Pubblicazione su Vercel
1. Carica la cartella su un repository GitHub.
2. Su vercel.com: *Add New → Project*, scegli il repository, lascia i valori predefiniti. Il comando `npm run build` scarica il GTFS e poi compila.
3. Ottieni l'URL pubblico `https://<nome>.vercel.app` (dominio personalizzato opzionale).
4. Aggiornamenti del codice: `git push`. Aggiornamento dati GTFS: crea un *Deploy Hook* in Vercel, salvalo come secret `VERCEL_DEPLOY_HOOK` su GitHub: il workflow settimanale in `.github/workflows` ridistribuisce il sito.

Cloudflare: usa l'adattatore OpenNext per Cloudflare. L'accesso al filesystem per `./data` va verificato (su Vercel funziona tramite `outputFileTracingIncludes`).

## Come ragiona il sito
- `LIVE` = previsione GTT per la corsa + GPS del mezzo più recente di 90 s. `PREVISIONE` = previsione senza GPS recente. `PROGRAMMATO` = orario da tabella (mai mostrato come minuti di attesa). `DATATO` = dato realtime più vecchio di 120 s. Soglie in `lib/arrivals.ts`: sono scelte del progetto.
- Se il feed non risponde, si conserva l'ultimo dato reale con il suo timestamp originale (DATATO); non si inventa nulla.
- Cache lato server: 15 s sui feed GTT, richieste simultanee unificate, timeout 8 s, limite 120 richieste/minuto per IP (per istanza).
- La posizione dell'utente va solo come parametro di `/api/nearby` e non viene salvata né registrata.
- Preferiti (`btl:lines`, `btl:stops`) solo in `localStorage`. 45, 81 e 43 sono solo il valore iniziale.

## Limiti noti
- Copertura realtime per linea non dimostrata: dipende dal feed GTT (vedi `/diagnostics`).
- Ricerca per comune e via: GTT non fornisce un campo comune; funziona sul testo del nome fermata (che di solito include il comune) e sul nome del percorso della linea.
- Tile OpenStreetMap pubblici: uso moderato; per molto traffico serve un fornitore di tile dedicato.
- Il service worker memorizza solo risorse statiche; il realtime non funziona offline.
- Altre fonti (Regione Piemonte, Moovit, Extra.To) non sono integrate: vedi `/sources`.
- Attribuzione obbligatoria dei dati GTT (CC BY) e di OpenStreetMap: già nel footer.
