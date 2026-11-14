# CoverCam v33 - Interlinea e spaziature Animali

Data: 2026-11-14

## Problema riscontrato
Il renderer applicava un'interlinea minima per ruolo (titolo 1.38, sommario 1.54) anche quando nei quattro preset Animali era specificata una interlinea più contenuta. Per il preset `ani-02` nel formato Post, il modello di misura restituiva solo 9 px tra sommario e linea del footer, con una collisione titolo/sommario.

## Correzioni
- Interlinea titolo 1.18, sommario 1.27, specifica per Animali. Gli altri generi mantengono esattamente il precedente comportamento del renderer.
- Riposizionamento mirato dei blocchi troppo affollati in `ani-02` (occhiello, titolo, sommario) e `ani-03` (titolo, sommario).
- Nessuna variazione a corpi tipografici, testi, font o larghezze delle colonne.
- Asset versionati: `app.js?v=33`, `renderer.js?v=33`, `exporter.js?v=33`.

## Verifiche simulate
- 63 preset × 3 formati × 2 modalità (anteprima/export) × 3 profili di larghezza glifi: 1.134 renderizzazioni simulate.
- Zero eccezioni nella simulazione; zero collisioni rilevate, troncamenti, box fuori canvas nei 4 preset Animali.
- Distanze minime nel modello da 1.000px di larghezza: titolo-sommario 25 px; sommario-linea footer 39 px.
- Le geometrie delle altre 8 categorie sono identiche alla v32 nei test eseguiti.
- Integrità dei 63 preset, 9 generi e riferimenti DOM verificata.

## Limiti
Questi test utilizzano metriche tipografiche simulate, non il rendering visivo dei font reali su telefono. L'avvio fotocamera, zoom e download reale non sono stati testati su dispositivo in questa sessione. Verificare il risultato su Android/iOS e la resa delle tre dimensioni cover prima di dichiarare il controllo visuale concluso.
