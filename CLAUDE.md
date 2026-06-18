# CLAUDE.md

Tehnička dokumentacija za developere i AI asistente koji rade na ovom repou.
Pregled proizvoda i setup su u [`README.md`](README.md).

## Šta je ovo

PWA za praćenje ličnih troškova sa srpskih fiskalnih računa. Frontend je čist
vanilla JS bez build koraka; backend je Google Apps Script (GAS) + Google Sheets,
i **nije u ovom repou** (vidi `backend/README.md`).

## Ključne konvencije

- **Bez build sistema, bez framework-a, bez npm-a.** Sve su statični fajlovi koji
  se serviraju direktno. Ne uvoditi bundler/transpajler bez jakog razloga.
- **Sav frontend kod je u `app.js`** (jedan fajl). Funkcije prate konzistentan obrazac:
  - `setXStatus(text, type)` — postavlja status poruku (`type` = `ok|warn|error`).
  - `loadX()` — poziva backend preko `callGasJsonp` i prosleđuje rezultat u `renderX`.
  - `renderX(data)` — generiše HTML iz podataka i ubacuje ga u DOM.
- **Globalni state** je objekat `appState` na vrhu `app.js`.
- **Ekrani** se prebacuju preko `showScreen(name)`; vidljiv je `.screen.active`.
  Svaki novi ekran zahteva: `<section id="screen-NAME">`, dugme u `.bottom-nav`
  sa `data-screen="NAME"`, i (opciono) unos u `titles` mapi u `showScreen`.
- **Escaping**: koristi `escapeHtml()` za sadržaj i `escapeJs()` za vrednosti koje
  ulaze u inline `onclick="..."` u template stringovima. Uvek escape-uj podatke iz backenda.
- **Novac**: `parseMoney()` (parsira `"1.234,56"` → `1234.56`) i `formatMoney()`
  (formatira u `sr-RS` + `RSD`). `normalizeText()` skida srpsku diakritiku za pretragu.

## Komunikacija sa backendom (VAŽNO)

Sav saobraćaj ide kroz **JSONP** helper `callGasJsonp(params, onSuccess, onError)`:

- Pravi `<script src="GAS_URL?...&callback=ime">` i čeka da GAS pozove callback.
- **Svi zahtevi su GET.** Nema POST-a. Veliki payload-i (npr. ručni račun) se šalju
  kao `payload=<JSON string>` u query-ju → otud limit od ~6000 karaktera.
- Timeout je 60s; greška mreže ide u `onError`.

GAS URL se čita iz `appState.gasUrl` (localStorage `gasUrl`), uz fallback na
`DEFAULT_GAS_URL` na vrhu `app.js`.

Kompletan spisak akcija, parametara i oblika odgovora je u
[`backend/README.md`](backend/README.md). Pri svakoj izmeni frontenda koja menja
API, **ažuriraj i taj ugovor**.

## Mapa funkcionalnosti → kod

| Ekran | HTML `id` | Glavne funkcije u `app.js` |
|-------|-----------|----------------------------|
| QR skener | `screen-scan` | `startScanner`, `onScanSuccess`, `sendToGas`, `scanQrFromImage` |
| Ručni unos | `screen-manual` | `addManualItemRow`, `recalcManualTotals`, `saveManualReceipt` |
| Kategorizacija | `screen-categorize` | `loadCategoryQueue`, `saveCategoryForQueueItem`, `loadCategoryCoverage` |
| Dashboard | `screen-dashboard` | `loadDashboard`, `renderDashboard`, `renderDailyBars` |
| Izveštaji | `screen-reports` | `loadReports`, `renderReports`, `onReportsTypeChange` |
| Budžeti | `screen-budgets` | `loadBudgets`, `renderBudgetRow`, `saveBudgetFromButton`, `saveAllBudgets` |
| Pretraga cena | `screen-prices` | `loadPriceSearch`, `renderPriceGroup`, `loadPriceHistory` |
| Javni cenovnici | `screen-public-prices` | `loadPublicPriceSources`, `importPublicPriceSource`, `loadPublicPriceSearch` |
| Podešavanja | `screen-settings` | `saveSettings`, `testGas`, `loadLookups` |

## Gotchas / zamke

- **HTML i `app.js` moraju da budu usklađeni po `id`-jevima.** Ekran Izveštaji je
  ranije bio polomljen baš zbog ovoga (HTML je koristio `reportsYearFrom/To`, a JS
  čita `reportsYear`/`reportsYearA`/`reportsYearB`). Brza provera pre commita:
  ```bash
  # svaki getElementById iz app.js mora imati id u index.html
  for id in $(grep -oE 'getElementById\("[^"]+"\)' app.js | sed -E 's/.*"([^"]+)".*/\1/' | sort -u); do
    grep -q "id=\"$id\"" index.html || echo "MISSING id: $id"
  done
  node --check app.js   # sintaksa
  ```
- **Tip izveštaja „poređenje godina" ima vrednost `yearlyCompare`** (ne `yearly`) —
  tako `renderReports`/`onReportsTypeChange` i backend očekuju.
- **Pri izmeni `index.html`/`app.js`/`styles.css` podigni `CACHE_NAME`** u
  `service-worker.js` (npr. `racuni-pwa-v6` → `v7`), inače vraćeni korisnici dobijaju
  stare keširane fajlove (cache-first strategija).
- **`html5-qrcode` se učitava sa unpkg CDN-a** — nije keširan u service workeru.
- **`DEFAULT_GAS_URL`** u `app.js` je realan deployment URL. Za javnu/multi-user
  verziju ga ne hardkoduj.

## Stil odgovora i jezik

UI tekst, statusi i dokumentacija su na srpskom (latinica). Drži se toga radi
konzistentnosti.
