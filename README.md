# CoverCam — Fotocamera Editoriale (PWA)

Progressive Web App in vanilla HTML/CSS/JavaScript (ES Modules) per graphic designer: sovrappone in tempo reale 50 layout di copertine editoriali allo stream della fotocamera e genera ad ogni scatto due file JPG alla massima risoluzione (`_clean.jpg` e `_cover.jpg`).

## Struttura del progetto

- `index.html` — Interfaccia principale in italiano, dark minimal e thumb-friendly.
- `styles.css` — Stili nativi CSS senza dipendenze esterne.
- `presets.json` — 50 preset divisi in 4 generi (`fashion`, `news`, `product`, `luxury`) con coordinate relative `0–1`, gerarchia tipografica e colori.
- `manifest.json` + `sw.js` + `icons/` — Configurazione PWA installabile su Android Chrome e caching offline.
- `js/app.js` — Orchestrazione UI, swipe tra varianti, gestione stato e campionamento scena ogni 500 ms.
- `js/camera.js` — Gestione `getUserMedia` con richiesta della massima risoluzione disponibile sulla fotocamera posteriore (`environment`).
- `js/renderer.js` — Motore di rendering vettoriale su Canvas 2D adattivo ai 3 formati (`4:5.3`, `4:5`, `9:16`), zone sicure Story e livella.
- `js/color.js` — Campionamento su canvas ridotto e calcolo del rapporto di contrasto secondo formula WCAG 2.1.
- `js/horizon.js` — Livella orizzontale tramite `DeviceOrientationEvent` (diventa verde entro ±1.5°).
- `js/exporter.js` — Esportazione doppia a piena risoluzione (`covercam_YYYYMMDD_HHMMSS_clean.jpg` e `covercam_YYYYMMDD_HHMMSS_cover.jpg`) con download diretto e Web Share API.
- `js/logger.js` — Logger persistente in memoria e `localStorage` (ultime 500 voci), consultabile con pressione prolungata sul titolo `COVERCAM`.

## Avvio in locale

Servire la cartella con un qualunque server HTTP statico su `localhost` (contesto sicuro abilitato per `getUserMedia` e Service Worker):

```bash
python3 -m http.server 8080
```

Aprire `http://localhost:8080` in Chrome.

## Deploy su HTTPS (GitHub Pages) per installazione su Android

1. Creare un repository Git e caricare tutti i file nella root (o nella cartella `/docs`):
   ```bash
   git init
   git add .
   git commit -m "Initial CoverCam PWA"
   git branch -M main
   git remote add origin https://github.com/<utente>/<repo>.git
   git push -u origin main
   ```
2. Su GitHub aprire **Settings → Pages**, selezionare il branch `main` (cartella `/root`) e salvare.
3. Visitare l'URL `https://<utente>.github.io/<repo>/` da **Chrome su Android**: toccare il menu di Chrome → **Installa app** (o **Aggiungi a schermata Home**).
4. In alternativa per test immediato da smartphone collegato via USB: attivare il port forwarding in `chrome://inspect/#devices` sulla porta `8080` (Chrome tratta `localhost` inoltrato via ADB come contesto sicuro).
