# CoverCam v31 - Zoom digitale e colore aloni

## Funzioni
- Zoom digitale 1.0×–3.0× su fotocamera e immagine importata.
- Slider, pulsanti +/−, reset su valore e gesto pinch a due dita nella copertina.
- Pinch maschera volto preesistente preservato quando la maschera è attiva.
- Zoom applicato al ritaglio centrale di entrambi gli export (clean e cover), mantenendo la dimensione di output del formato.
- Scelta colore indipendente dal grading per gli aloni; ogni alone memorizza `color`.
- Picker sincronizzati in HUD e impostazioni; editing sul punto selezionato o su tutti se non è selezionato alcun punto.

## Controlli effettuati - 14 novembre 2026
- Parsing JS: applicazione, renderer ed exporter senza errori.
- Bootstrap simulato con DOM e fotocamera mock: 63 preset e 9 generi caricati; nuovi handler registrati.
- 9 test di interazione: zoom, clamp, reset, pinch, colore per singolo alone, sincronizzazione input.
- 60 casi matematici di crop su 4 dimensioni e 3 formati; 9 verifiche export a zoom 1×/2×/3×.
- Smoke rendering: 378 combinazioni (63 preset × 3 formati × anteprima/export), due aloni con colori distinti, 0 eccezioni.
- Mappatura dei 119 riferimenti DOM all'HTML, nessun ID mancante.
- `js/camera.js` e `presets.json` non modificati.

## Limiti e controlli manuali mancanti
- Zoom **digitale**, non controllo dell'ottica hardware. A ingrandimenti elevati la definizione effettiva diminuisce.
- Non verificato il funzionamento reale su fotocamera Android/iOS o la corrispondenza visiva su display fisico.
- Test Canvas e DOM simulati non sostituiscono controlli in browser reale.
