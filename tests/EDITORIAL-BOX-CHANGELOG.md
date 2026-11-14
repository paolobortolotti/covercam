# CoverCam v30 - Ritmo editoriale e box

## Intervento

- Calcolo dei box sul testo effettivamente misurato, compresi bar, frame, bracket e separatori.
- Interlinea differenziata per ruolo (testata, kicker, titolo, sommario, body, footer).
- Separatore inferiore distanziato dal testo; fascia footer riservata e vincoli allo spostamento verticale.
- Riorganizzazione manuale dei preset più densi in `presets.json`, senza cambiare i testi.
- Aggiornamento delle importazioni con query `v=30`. Nessuna modifica alle API della fotocamera.

## Verifica deterministica

- 63 preset, 9 categorie, 3 formati: 189 combinazioni.
- Test di anteprima ed esportazione con contesto Canvas simulato.
- Due profili sintetici di larghezza dei glifi, standard e prudenziale.
- Esiti dei profili: nessuna eccezione, sovrapposizione rilevata, riga tagliata, fuoriuscita o footer fuori fascia.
- Integrità del testo dei preset e degli import JS verificata.

## Limite

Le larghezze tipografiche sono stime: questa prova non sostituisce il rendering con i font effettivi su Chrome/Android, il controllo fotografico e la verifica della fotocamera, delle autorizzazioni e dell'export su dispositivo.
