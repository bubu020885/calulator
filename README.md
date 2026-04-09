# Besucher-Budget-Rechner

Eine einfache, statische Web-App zum Planen eines Besucher-Budgets für ein komplettes Kalenderjahr.

## Funktionen

- **Eingabemaske**
  - Kalenderjahr auswählen
  - Bundesland auswählen (alle 16 deutschen Bundesländer)
  - Maximale Besucherzahl pro Tag festlegen
- **Automatisch erzeugte Tabelle** für jeden Tag des Jahres mit:
  - Datum
  - Wochentag
  - Feiertag & Schulferien (für das gewählte Bundesland)
  - Dropdown für Auslastung: `Close (0%)`, `Off (0%)`, `Low (25%)`, `Medium (50%)`, `High (75%)`, `Peak (100%)`
  - Berechnete Besucherzahl pro Tag (`max × Auslastung %`)
  - Frei editierbare Notizen je Tag
- **Zusammenfassungen**
  - Jahresbudget gesamt
  - Monatsbudgets
  - Anzahl der Tage je Auslastungsstufe (z. B. wie viele Close- oder Peak-Tage)
- **Export**
  - Excel (`.xlsx`) – inklusive Zusammenfassungs-Tabellenblatt
  - PDF (`.pdf`) – Tabelle + Zusammenfassungsseite
- **Persistenz**: Alle Änderungen (Auslastung, Notizen, Max-Besucher) werden pro Jahr/Bundesland automatisch im Browser (`localStorage`) gespeichert.

## Start

Einfach `index.html` in einem modernen Browser öffnen – es ist keine Installation, kein Build und kein Server erforderlich.

Optional kann ein statischer HTTP-Server verwendet werden (empfohlen, damit auch die Schulferien-API sauber geladen werden kann):

```bash
# Python 3
python3 -m http.server 8000
# dann im Browser öffnen:  http://localhost:8000/
```

## Datenquellen

- **Feiertage**: intern berechnet (Ostern nach Meeus/Jones/Butcher + bundesweite & länderspezifische Feiertage).
- **Schulferien**: werden live von [ferien-api.de](https://ferien-api.de/) geladen. Sollte die API nicht erreichbar sein, wird ein Hinweis angezeigt und die Tabelle funktioniert weiter (nur ohne Ferien-Informationen).

## Verwendete Bibliotheken (via CDN)

- [SheetJS (xlsx)](https://sheetjs.com/) für den Excel-Export
- [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) für den PDF-Export
