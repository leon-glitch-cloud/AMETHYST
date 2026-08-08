# Amethyst – Internes Verwaltungstool für LUCICA (Armbandbusiness)

## Zweck
Internes Arbeitstool für unser Armband-/Schmuckbusiness. Verwaltung von
Armband-Bestand, Material-/Perlenbestand und einer laufenden Bilanz.
Reines Arbeitswerkzeug für 2–3 Personen, kein öffentliches Produkt.

## Tech-Stack
- **Frontend/Framework:** Next.js (App Router), TypeScript
- **Datenbank + Storage + Auth:** Supabase (Postgres, Storage-Buckets für Bilder, Supabase Auth)
- **Hosting:** Vercel
- **KI-Extraktion:** Anthropic Claude API (Vision + PDF) für das Auslesen von Bestelllisten

## Nutzer & Zugriffsschutz
- 2–3 Nutzer, keine individuellen Konten nötig.
- **Ein gemeinsames Passwort** als Zugriffsschutz (keine Supabase Auth, kein
  E-Mail-Login). Passwort liegt als Umgebungsvariable (z. B. `APP_PASSWORD`),
  Abfrage über eine simple Passwort-Seite; nach Eingabe wird ein signiertes
  Cookie/Session gesetzt. Ziel ist nur, Zufallsbesucher fernzuhalten.
- Prüfung serverseitig (Middleware / Server Action), nicht im Client-Code.
- Hinweis: einfacher Schutz, kein Hochsicherheits-Login – für internes Tool ohne
  sensible Kundendaten ausreichend.

## Startseite / Navigation
- **Startseite = Saldo-Dashboard.** Beim Öffnen der App sieht man sofort die
  aktuelle Gesamtbilanz als große, zentrale Zahl (z. B. „−1.000 €", später „−800 €").
  Farblich neutral (nur die Zahl ggf. dezent, kein greller Rot/Grün-Akzent, oder
  minimales Vorzeichen-Signal – siehe Design).
- Darunter: **offene Bestellungen** als To-do-Liste (was gerade zu tun ist) –
  siehe Funktionsbereich Bestellungen.
- Darunter drei Einstiege in die Unterbereiche:
  1. **Armbandbestand**
  2. **Perlenbestand**
  3. **Verlauf** (Bestellungen & Verkäufe / Buchungen)
- Von jedem Unterbereich zurück zur Startseite.

## Design
- Sehr clean, hell, übersichtlich. **Bewusst monochrom/neutral (Grau-/Weißtöne),
  KEINE Akzentfarben** – die Produkte selbst sind farbig, das Tool soll nicht damit
  konkurrieren.
- Klare Tabellen/Karten-Layouts, gute Lesbarkeit, mobil nutzbar.
- Fokus auf Funktion, nicht auf Verzierung.

---

## Funktionsbereich 1: Armband-Bestand

Übersicht aller Armbänder als Liste/Grid mit Foto.

**Pro Armband (Modell):**
- Name/Bezeichnung
- Foto (Upload in Supabase Storage)
- Hergestellte Menge (Ausgangsbestand, z. B. „6 Stück gemacht")
- Verwendete Perlen: Liste von Perlen aus dem Materialbestand mit jeweiliger Menge
  (Verknüpfung, nicht freier Text)
- **Automatisch berechnet:** Gesamt-Materialkosten des Armbands
  (Summe aus verwendete-Perlen × jeweiliger Perlenpreis)

### Bestandslogik: Zähler pro Modell + Bewegungshistorie
Es werden KEINE einzelnen physischen Exemplare durchnummeriert. Pro Modell gibt es
nur Zähler, die sich aus den erfassten Bewegungen ergeben:
- **Auf Lager** = hergestellt − verkauft − aktuell offen verliehen
- **Verliehen** = Anzahl offener (nicht zurückgegebener) Verleihungen
- **Verkauft** = Anzahl der Verkäufe

Jede Bewegung wird als Historien-Eintrag gespeichert:
- **Verkauf:** Datum, Käufer, Preis. Erzeugt gleichzeitig eine Bilanzbuchung
  (Einnahme). Geschenk = Verkauf mit Preis 0, Empfänger trotzdem dokumentiert.
- **Verleih:** Datum, an wen. Offener Status bis Rückgabe. **Keine Bilanzbuchung**
  (kein Geldfluss, Armband bleibt Bestand).
- **Rückgabe:** schließt einen offenen Verleih → Lagerbestand steigt wieder.

**Detailansicht Armband-Modell** zeigt:
- Foto, verbaute Perlen mit Einzel- und Gesamtkosten (Materialkosten).
- Die drei Zähler: auf Lager / verliehen / verkauft.
- **Verkaufshistorie:** Liste aller Verkäufe (wann, an wen, wie viel €), jeder
  Eintrag verlinkt zur zugehörigen Buchung in der Bilanz.
- **Verleihhistorie:** Liste aller Verleihungen (wann, an wen, zurück / noch offen),
  mit „Zurückerhalten"-Aktion für offene Verleihungen.
- Verkaufte/verliehene Modelle bzw. ausverkaufte Modelle (0 auf Lager) sollen in der
  Übersichtsliste erkennbar sein (z. B. ausgegraut / Badge), damit man sieht, welche
  Modelle gut laufen und gerade nicht auf Lager sind.
- **Offene Bestellungen für dieses Modell** (siehe Funktionsbereich Bestellungen).

### KI-Erkennung der Perlen aus dem Armband-Foto (halbautomatisch)
Beim Anlegen eines neuen Armbands: Foto hochladen → Claude API (Vision) analysiert
das Bild und macht einen **Vorschlag**, welche Perlen wie oft verbaut sind.

Ablauf:
1. Foto des fertigen Armbands hochladen.
2. Claude API bekommt das Foto **plus die Referenzbilder + Stammdaten (Farbe, Größe,
   Nummer) aller Perlen aus dem Materialbestand** mitgeschickt, damit sie die
   erkannten Perlen mit vorhandenen Perlen abgleichen kann.
3. Die KI liefert einen strukturierten Vorschlag zurück, z. B.:
   „Perle X: 20×, Perle Y: 10×" – möglichst mit Zuordnung zur passenden
   Artikelnummer aus dem Bestand.
   - Realistische Erwartung: Das **Zählen** der unterschiedlichen Perlentypen und
     ihrer Anzahl klappt meist gut. Die **Zuordnung** zur genauen Artikelnummer ist
     ein Vorschlag und kann danebenliegen (ähnliche Farben/Größen).
4. Vorschlag wird als editierbare Liste angezeigt. Jede erkannte Perle ist
   **anklickbar**; per Auswähldialog kann die falsch erkannte Perle durch die
   richtige aus dem Materialbestand ersetzt werden. Mengen sind manuell korrigierbar,
   Positionen hinzufügbar/löschbar.
5. Nach Bestätigung werden die Perlen mit dem Armband verknüpft (bracelet_beads)
   und die Materialkosten automatisch berechnet.

**Wichtig für die Zuordnungsqualität:** Jede Perle im Materialbestand sollte ein
sauberes Referenzfoto haben – daran gleicht die KI ab. Ohne Referenzfotos kann sie
nur Farbe/Größe grob schätzen.

Der KI-Aufruf läuft serverseitig (Server Action / API-Route), API-Key als
Umgebungsvariable, nie im Client.

---

## Funktionsbereich 1b: Bestellungen (Kundenanfragen)

Erfasst Anfragen von Leuten, die ein Armband haben wollen – noch KEIN Verkauf,
sondern eine offene Aufgabe.

**Pro Bestellung:**
- Besteller-Name
- Entweder verknüpftes **Modell** (aus dem Armbandbestand) ODER **Freitext-Wunsch**
  für individuelle Anfragen ohne bestehendes Modell (eins von beiden).
- Status: **offen** / **erledigt** / **storniert**

**Ablauf:**
- Neue Bestellung startet als „offen".
- **Erledigt:** führt zum Verkauf → Käufer + Preis erfassen → erzeugt Verkaufs-Eintrag
  in der Historie des Modells und die zugehörige Bilanzbuchung (Einnahme). Bei einem
  reinen Wunsch ohne Modell wird nur die Verkaufsbuchung erzeugt.
- **Storniert:** Bestellung wird geschlossen, keine Buchung.
- Eine offene Bestellung berührt die Bilanz NICHT (kein Geldfluss).

**Anzeige:**
- Offene Bestellungen als To-do-Liste auf der **Startseite** (unter dem Saldo).
- Offene Bestellungen für ein bestimmtes Modell in dessen **Detailansicht**.
- Wunsch-Bestellungen ohne Modell erscheinen nur auf der Startseite.

Durchsuchbare Übersicht aller Perlen/Materialien.

**Pro Perle:**
- Artikelnummer
- Name (z. B. „Donut")
- Bild
- Größe (Durchmesser in mm)
- Farbe
- Material (z. B. „Edelstahl vg.")
- **Packungspreis** (was die Packung gekostet hat, z. B. 4,95 €)
- **Packungsmenge** (wie viele Perlen in der Packung, z. B. 20)
- **Preis pro Perle** = Packungspreis ÷ Packungsmenge (automatisch berechnet und in
  der Übersicht angezeigt, z. B. 0,2475 €). Nur dieser Stückpreis ist relevant für
  die Materialkostenberechnung der Armbänder.
- Bezugsquelle / Shop (wo bestellt) + ggf. Link/Seite

**KEIN Lagerbestand:** Es wird NICHT verfolgt, wie viele Stück einer Perle vorhanden
sind. Dieselbe Perle wird mehrfach nachgekauft; die Stückzahl ist irrelevant. Menge/
Preis dienen ausschließlich der Umrechnung auf den Stückpreis.

**Foto pro Perle (manuell hinzufügen):**
- Bestelllisten enthalten MEISTENS keine Bilder – die liefern oft nur Nummer, Größe,
  Preis, Shop. (Wenn doch Bilder dabei sind, werden sie beim Upload automatisch
  übernommen – siehe Funktionsbereich Upload.) Das Foto ist aber entscheidend, weil
  eine leere Perle später über ihr Aussehen wiedergefunden werden muss (man kennt
  Aussehen + Größe, sucht Nummer + Bezugsquelle).
- Deshalb: In der Perlen-Detailansicht gibt es die Option „Foto hinzufügen". Der
  Nutzer kann direkt per **Kamera** ein Foto aufnehmen oder eine **Datei hochladen**.
- Das Foto ist ein normales Feld an der Perle (image_url), jederzeit ergänz-/ersetzbar.
- Dieses Foto dient zugleich als Referenzbild für die KI-Armbanderkennung
  (Funktionsbereich 1).

**Suche/Filter:** Nach Nummer, Farbe, Größe suchen. Ziel: „Perle ist alle" →
schnell finden, wo und zu welchem Preis nachbestellt werden kann.

**Upload von Bestelllisten (halbautomatisch):**
- Nutzer lädt Bestellbestätigung/Materialliste hoch (PDF, Screenshot, Bild – Formate gemischt).
- Datei geht an Claude API (Vision/PDF-Fähigkeit, Modell claude-sonnet-5 aus
  Kostengründen), die die enthaltenen Positionen ausliest: Nummer, Name,
  Material, Größe, Farbe, Packungspreis/-menge, Shop. Automatisches
  Bild-Ausschneiden aus der Datei gibt es bewusst NICHT (zweiter Modell-Aufruf
  war zu teuer) – das Foto-Feld bleibt leer und wird später manuell an der
  Perle ergänzt, z. B. über den automatisch erzeugten Shop-Suchlink (siehe
  oben).
- Ergebnis wird als **vorausgefülltes, editierbares Formular** angezeigt.
- Nutzer prüft/korrigiert und bestätigt → dann werden die Positionen in den
  Materialbestand übernommen (neue Perle anlegen, oder vorhandene mit gleicher
  Artikelnummer aktualisieren – z. B. Preis/Packungsmenge). Kein Bestandszähler.
- Wichtig: Extraktion ist ein Vorschlag, der Mensch bestätigt immer.

---

## Funktionsbereich 3: Bilanz / Buchhaltung

Laufende Bilanz (aktuell im Minus wegen Materialeinkäufen).

**Buchungsarten:**
- **Ausgabe:** z. B. Materialbestellung. Felder: Datum, Beschreibung, Betrag (negativ).
  Idealerweise verknüpft mit einem Material-Upload/Bestellung, damit Ausgaben nicht
  doppelt erfasst werden.
- **Verkauf (Einnahme):** entsteht automatisch, wenn ein Armband im Armbandbereich
  als verkauft erfasst wird (welches Modell, an wen, Preis). Nicht separat hier
  eintippen – die Buchung wird durch den Verkauf erzeugt und ist mit ihm verknüpft.
- **Geschenk:** ist ein Verkauf mit Preis 0 (Empfänger dokumentiert), erscheint mit
  Betrag 0 in der Historie.
- **Rücksendung / Erstattung:** wird als normale positive Buchung im Bilanz-Bereich
  manuell erfasst (Datum, Beschreibung z. B. „Erstattung Shop XY", Betrag positiv).
  Keine eigene Perlen-Mechanik, kein Bestandsbezug.
- **Verleih:** erzeugt bewusst KEINE Buchung – kein Geldfluss, das Armband bleibt
  Bestand.

**Anzeige:**
- Laufende Gesamtbilanz (Saldo).
- Chronologische Liste aller Buchungen mit Filter (Zeitraum, Typ).
- Optional: Summen Ausgaben vs. Einnahmen.

---

## Datenmodell (Vorschlag)

- **bracelets** (Modell): id, name, photo_url, made_count (hergestellte Menge),
  notes, created_at
- **bracelet_beads** (Verknüpfungstabelle): id, bracelet_id, bead_id, quantity
- **sales:** id, bracelet_id, sale_date, buyer_name, price, is_gift (bool),
  transaction_id, created_at
- **loans:** id, bracelet_id, borrower_name, loaned_at, returned_at (nullable →
  NULL = noch offen/draußen), created_at
- **orders** (Kundenbestellungen): id, customer_name, bracelet_id (nullable →
  NULL = individueller Wunsch), wish_text (nullable, Freitext für Wunsch ohne Modell),
  status (open/done/cancelled), sale_id (nullable → gesetzt wenn als Verkauf erledigt),
  created_at
- **beads:** id, article_number, name, material, image_url, size_mm, color,
  package_price (Packungspreis), package_quantity (Packungsmenge), source_shop,
  source_url, created_at
  - Preis pro Perle = package_price / package_quantity (berechnet, nicht gespeichert
    – oder als generierte Spalte). Kein Lagerbestand.
- **transactions:** id, date, type (expense/sale/refund), description, amount,
  bracelet_id (nullable), counterparty_name (nullable), created_at
  - Verkäufe erzeugen automatisch eine transaction (type=sale) und verweisen darüber
    aus der Verkaufshistorie in die Bilanz. Geschenke: amount 0.
  - Rücksendungen/Erstattungen: manuell erfasste transaction (type=refund, positiver
    Betrag). Keine eigene Perlen-/Bestandsmechanik.
  - Verleihungen erzeugen KEINE transaction.
- **material_orders** (optional, für Uploads): id, file_url, extracted_json, status
  (pending/confirmed), created_at

Abgeleitete Zähler pro Modell (nicht gespeichert, berechnet):
- verkauft = COUNT(sales)
- offen verliehen = COUNT(loans WHERE returned_at IS NULL)
- auf Lager = made_count − verkauft − offen verliehen

Materialkosten eines Armbands = Summe über bracelet_beads
(quantity × Preis pro Perle), wobei Preis pro Perle = package_price / package_quantity.

---

## Umsetzungsreihenfolge (Empfehlung)
1. Supabase-Setup: Schema, Storage-Buckets. Passwortschutz (gemeinsames Passwort,
   Middleware).
2. Startseite/Saldo-Dashboard mit Navigation zu den drei Bereichen (zunächst mit
   Platzhalter-Zahl, sobald transactions steht: echter Saldo).
3. Material-/Perlenbestand: CRUD + Suche + Referenzfoto-Upload (manuell zuerst).
   Referenzfotos sind wichtig für die spätere KI-Zuordnung.
4. Armband-Bestand: CRUD + Foto + Perlen-Verknüpfung (manuell) + Kostenberechnung
   + Verleih.
5. Bilanz/Verlauf: Buchungen (Ausgabe/Verkauf/Geschenk) + Saldo-Berechnung fürs
   Dashboard.
6. **KI-Feature A – zuletzt:** Perlen-Erkennung aus dem Armband-Foto (Vision +
   Abgleich mit Referenzbildern, editierbarer Vorschlag).
7. **KI-Feature B – zuletzt:** halbautomatischer Bestelllisten-Upload für den
   Materialbestand (PDF/Bild → Vorschlag → Bestätigung).

Beide KI-Features ganz am Ende, weil sie am komplexesten sind. Der komplette Rest
funktioniert schon mit manueller Eingabe – ihr habt also früh ein nutzbares Tool,
und die KI ist die Komfort-Schicht obendrauf.
