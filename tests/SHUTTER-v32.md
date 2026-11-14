# CoverCam v32 - Risposta immediata dello scatto

Data: 2026-11-14.

## Problema verificato nel codice
Prima di v32 la pressione del pulsante attendeva l'intero processo `captureDualResolution`, inclusa `document.fonts.ready`, rendering su Canvas e doppia codifica JPEG, prima di mostrare la finestra di anteprima. Durante l'attesa non compariva una conferma evidente.

## Intervento
- Flash breve, feedback visivo di pulsante premuto e banner accessibile (`role=status`, `aria-live=polite`).
- Copia sincrona del fotogramma all'inizio di `handleShutter` **prima del primo await**. La copia include il ritaglio e lo zoom selezionato.
- Anteprima congelata della copertina, comprensiva dell'overlay editoriale già visibile al clic, durante la preparazione dei file.
- Conferma «Foto acquisita» e stato «Preparo i due file JPEG...» mostrati prima dell'encoder tramite due frame di `requestAnimationFrame`.
- Entrambi gli export clean/cover partono dallo stesso Canvas congelato; `renderOptions.zoom=1` evita un secondo zoom.
- Disabilitazione temporanea del pulsante per ignorare doppi clic, riabilitazione al termine o in caso di errore.
- Errore comunicato visivamente, con possibilità di riprovare; nessuna falsa conferma se la sorgente non è pronta.
- `presets.json`, `js/renderer.js`, `js/camera.js`, `js/exporter.js` non modificati.

## Test eseguiti (simulati)
- 10 verifiche sul flusso: freeze prima dell'attesa, feedback immediato, doppio clic ignorato, due frame per renderizzare la UI, sorgente congelata usata nell'export, nessun doppio zoom, apertura modale, gestione errore e galleria.
- 36 combinazioni di ritaglio tra 4 risoluzioni/orientamenti, 3 formati, zoom 1×/1,8×/3×, con `captureDualResolution` reale e Canvas mock.
- Bootstrap completo con DOM e fotocamera simulati: 63 preset, 9 categorie, handler dello scatto e controlli zoom/aloni presenti.
- Verifica ID DOM contro HTML: nessun riferimento mancante, nessun ID duplicato.

## Limiti
- Nessun test eseguito su fotocamera fisica Android/iOS, latenza JPEG misurata o verifica visiva su schermo reale.
- La cattura del Canvas ad alta risoluzione avviene nell'evento del clic; il tempo può dipendere dall'hardware. L'elaborazione dei due JPEG segue in modo asincrono, con progress visibile.
- Il flash non è un suono di scatto: evitare audio indesiderato in ambienti pubblici.
