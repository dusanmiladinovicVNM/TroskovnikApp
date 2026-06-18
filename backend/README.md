# Backend (Google Apps Script)

Backend je **Google Apps Script (GAS)** Web App, sa **Google Sheets** kao bazom.
Trenutno **NIJE verzionisan u ovom repou** — živi u GAS editoru. Ovaj folder služi
da se to popravi.

## Kako verzionisati backend (uradi ovo)

1. Otvori GAS projekat (Apps Script editor).
2. Kopiraj sadržaj svakog `.gs` fajla (npr. `Code.gs`, `Phase4_Categorization.gs`,
   `Phase5_Dashboard.gs`, `Phase6_Reports.gs`, `Phase7_Budgets.gs`,
   `Phase8_Prices.gs`, `Phase8A_PublicPrices.gs`) u istoimeni fajl ovde u `backend/`.
3. Commit-uj. Tako backend dobija bekap i istoriju izmena.

> Alternativa: [`clasp`](https://github.com/google/clasp) za sinhronizaciju GAS ↔ git.

## Model komunikacije

- Frontend zove backend isključivo preko **JSONP** (GET + `callback` parametar).
- Ulaz su query parametri; veći objekti se šalju kao `payload=<JSON string>`.
- `doGet(e)` rutira po `e.parameter.action` i vraća `jsonp_(callback, objekat)`.
- Odgovori su ili `{ ok: true, ... }` ili `{ result: "STRING" }` (za upise/akcije).

## API ugovor (rekonstruisan iz `app.js`)

Niže je svaki `action` koji frontend koristi, sa očekivanim parametrima i oblikom
odgovora. Ovo je referenca — proveri/uskladi sa stvarnim `.gs` kodom kad ga dodaš.

### Skeniranje / test
| action | params | odgovor |
|--------|--------|---------|
| *(bez action-a)* `qr` | `qr` = QR URL | `{ result: "OK:..." \| "DUPLICATE" \| "<greška>" }` |
| *(prazno)* | — | `{ result: "..." }` (health-check za „Testiraj GAS") |

### Lookups
| action | params | odgovor |
|--------|--------|---------|
| `categories` | — | `{ categories: [{ category, subcategory }] }` |
| `vendors` | — | `{ vendors: [{ vendorName }] }` |
| `vendorItems` | `vendor` | `{ items: [{ itemName, lastPrice, category, subcategory, taxRate }] }` |

### Ručni unos
| action | params | odgovor |
|--------|--------|---------|
| `manualReceipt` | `payload` (JSON) | `{ result: "MANUAL OK:..." \| "DUPLICATE" \| "<greška>" }` |

`payload`:
```json
{
  "receiptDate": "YYYY-MM-DDTHH:mm", "vendor": "...", "invoiceNumber": "...",
  "paymentMethod": "...", "note": "...", "totalAmount": 0,
  "items": [{ "itemName","qty","unitPrice","total","category","subcategory","taxRate","rememberMode" }]
}
```

### Kategorizacija (Faza 4)
| action | params | odgovor |
|--------|--------|---------|
| `categoryCoverage` | — | `{ total, categorized, uncategorized }` |
| `categoryQueue` | `q`, `limit` | `{ items: [{ itemName, vendorName, lastPrice, timesBought, taxRate }], total }` |
| `updateCategory` | `payload` (JSON) | `{ result: "OK..." }` |

`updateCategory` payload: `{ vendorName, itemName, category, subcategory, taxRate, price, rememberMode }`
(`rememberMode` ∈ `vendor` \| `global` \| `both`).

### Dashboard (Faza 5)
| action | params | odgovor |
|--------|--------|---------|
| `dashboard` | `year`, `month` | `{ ok, dashboard: {...} }` |

`dashboard`:
```json
{
  "summary": { "totalAmount","receiptCount","itemCount","uncategorizedCount" },
  "previousMonth": { "totalAmount","difference","differencePct" },
  "categoryTotals": [{ "category","subcategory","amount","count" }],
  "vendorTotals":   [{ "vendor","amount","count" }],
  "dailyTotals":    [{ "day","amount","count" }],
  "topItems":       [{ "itemName","amount","count" }]
}
```

### Izveštaji (Faza 6)
| action | params | odgovor |
|--------|--------|---------|
| `reports` | `type`, `year`, `month`, `yearA`, `yearB`, `q`, `limit` | `{ ok, type, summary, report }` |

`summary`: `{ totalAmount, receiptCount, itemCount, uncategorizedCount }`.
`type` i oblik `report.rows`:
- `category` → `{ category, subcategory, amount, count }`
- `monthly` → `{ key, amount, count }`
- `yearlyCompare` → `report = { yearA, yearB, rows: [{ month, amountA, amountB, difference }] }`
- `vendor` → `{ vendor, amount, receiptCount }`
- `topItems` → `{ itemName, vendor, amount }`
- `priceTrend` → `report = { minPrice, averagePrice, maxPrice, message, rows: [{ date, vendor, itemName, unitPrice }] }`

### Budžeti (Faza 7)
| action | params | odgovor |
|--------|--------|---------|
| `budgets` | `year`, `month` | `{ ok, summary, rows }` |
| `saveBudget` | `payload` (JSON) | `{ result: "BUDGET OK:..." }` |
| `saveBudgetsBulk` | `payload` (JSON) | `{ result: "BUDGET BULK OK:..." }` |

`budgets.summary`: `{ totalPlanned, totalActual, difference, percentUsed }`.
`budgets.rows[]`: `{ category, subcategory, plannedAmount, actualAmount, difference, percentUsed, status }`
(`status` ∈ `ok` \| `warn` \| `over` \| `none`).
`saveBudget` payload: `{ year, month, category, subcategory, plannedAmount }`.
`saveBudgetsBulk` payload: `{ items: [ <gore> ] }`.

### Pretraga cena (Faza 8)
| action | params | odgovor |
|--------|--------|---------|
| `priceSearch` | `query`, `currentPrice`, `limit` | `{ ok, groups }` |
| `priceHistory` | `normalizedItem`, `limit` | `{ ok, rows }` |

`groups[]`: `{ normalizedItem, displayName, category, subcategory, vendorCount,
stats: { minLastPrice, bestVendorName, averageLastPrice, minEverPrice },
currentCompare: { currentPrice, bestKnownPrice, difference, differencePct, status },
vendors: [{ vendorName, itemName, lastPrice, minPrice, averagePrice }] }`.
`priceHistory.rows[]`: `{ receiptDate, importedAt, vendorName, unitPrice, quantity }`.

### Javni cenovnici (Faza 8A)
| action | params | odgovor |
|--------|--------|---------|
| `addPublicPriceSource` | `payload` (JSON) | `{ result }` |
| `publicPriceSources` | — | `{ ok, sources: [{ sourceId, retailerName, resourceUrl, lastStatus }] }` |
| `publicPriceImport` | `sourceId`, `limit` | `{ ok, importedRows, productsIndex: { rows } }` |
| `publicPriceSearch` | `query`, `currentPrice`, `limit` | `{ ok, groups }` |

`addPublicPriceSource` payload: `{ retailerName, resourceUrl, importLimitRows, notes }`.
`publicPriceSearch.groups[]`: `{ displayName, brand, categoryName, barcode,
bestCurrentPrice, bestRetailerName,
currentCompare: { currentPrice, bestPublicPrice, difference, differencePct, status },
retailers: [{ retailerName, productName, priceDate, unit, currentPrice, isDiscounted, unitPrice }] }`.
