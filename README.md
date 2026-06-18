# Računi PWA (TroškovnikApp)

Lični finansijski/troškovni asistent kao **PWA** (Progressive Web App), prilagođen
srpskom tržištu. Skeniraš QR kod sa fiskalnog računa (verifikacioni URL Poreske
uprave), backend ga parsira i upiše u Google Sheet, a aplikacija daje analitiku,
budžete i poređenje cena.

Sve je mobile-first, dark tema, instalabilno kao aplikacija na telefon.

## Arhitektura

```
┌────────────────────┐     JSONP (GET)     ┌──────────────────────────┐
│  Frontend (PWA)    │ ──────────────────► │  Google Apps Script (GAS)│
│  vanilla JS, no     │ ◄────────────────── │  Web App  (doGet)        │
│  build, no framework│   { ok, ... }       │                          │
└────────────────────┘                     │  Google Sheets = baza    │
                                            └──────────────────────────┘
```

- **Frontend**: čist vanilla JavaScript, bez build koraka i bez framework-a.
- **Backend**: Google Apps Script deployovan kao Web App; Google Sheets je baza.
- **Komunikacija**: JSONP (dinamička `<script>` injekcija, GET zahtevi) — zaobilazi
  CORS ograničenja GAS-a. Detalji i ograničenja u [`CLAUDE.md`](CLAUDE.md).

> ⚠️ Backend (`.gs` fajlovi) trenutno **nije** u ovom repou — živi u Google Apps
> Script editoru. Vidi [`backend/README.md`](backend/README.md) za rekonstruisani
> API ugovor i plan da se backend verzioniše.

## Struktura projekta

| Fajl | Opis |
|------|------|
| `index.html` | SPA ljuska sa svim ekranima i donjom navigacijom |
| `app.js` | Sva logika frontenda (state, JSONP klijent, render funkcije) |
| `styles.css` | Dark, mobile-first stilovi |
| `manifest.json` | PWA manifest (ime, ikona, standalone) |
| `service-worker.js` | Offline keširanje ljuske (cache-first) |
| `backend/README.md` | Rekonstruisani API ugovor GAS backenda |
| `README_PHASE4.txt` | Uputstvo za backend setup — kategorizacija |
| `README_PHASE5.txt` | Uputstvo za backend setup — dashboard |
| `ROADMAP.md` | Prioriteti za dalji razvoj |
| `CLAUDE.md` | Tehnička dokumentacija za developere / AI asistente |

## Funkcionalnosti (po fazama razvoja)

- **QR skener** — kamera, skeniranje iz slike, ručno lepljenje QR URL-a, detekcija duplikata.
- **Ručni unos** — kompletan unos računa sa autocomplete prodavaca i artikala.
- **Kategorizacija** (Faza 4) — razvrstavanje artikala sa „pamti" modovima (vendor/global/both).
- **Dashboard** (Faza 5) — mesečni pregled, poređenje sa prethodnim mesecom, top liste, potrošnja po danima.
- **Izveštaji** (Faza 6) — po kategorijama, mesecima, poređenje godina, prodavcima, top artikli, trend cene.
- **Budžeti** (Faza 7) — planirano vs. ostvareno po kategoriji sa progress barovima.
- **Pretraga cena** (Faza 8) — najjeftiniji prodavac za artikal iz tvoje istorije.
- **Javni cenovnici** (Faza 8A) — uvoz CSV cenovnika trgovaca sa `data.gov.rs` i poređenje.

## Pokretanje lokalno

Frontend su statični fajlovi — dovoljan je bilo koji HTTP server (service worker i
kamera zahtevaju `http://localhost` ili HTTPS, ne `file://`):

```bash
# iz korena repoa
python3 -m http.server 8080
# pa otvori http://localhost:8080/index.html
```

U aplikaciji idi na **Podeš.** i unesi svoj GAS Web App `/exec` URL (ili koristi
podrazumevani iz `app.js`), pa **Testiraj GAS endpoint**.

## Deploy

- **Frontend**: bilo koji statički hosting (GitHub Pages, Netlify, Cloudflare Pages…).
  Mora HTTPS da bi radili kamera i PWA instalacija.
- **Backend**: vidi [`backend/README.md`](backend/README.md) i `README_PHASE*.txt`.

## Poznata ograničenja

- **Ručni račun je ograničen na ~6000 karaktera** payload-a jer JSONP koristi GET
  (`app.js`, `saveManualReceipt`). Rešenje je `doPost` na backendu — vidi `ROADMAP.md`.
- **`html5-qrcode` se učitava sa CDN-a** (unpkg) pa prvo skeniranje offline ne radi.
  Za pravi offline, bundluj biblioteku lokalno:
  ```bash
  mkdir -p vendor
  curl -L -o vendor/html5-qrcode.min.js \
    https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js
  # zatim u index.html promeni <script src> na "vendor/html5-qrcode.min.js"
  # i dodaj "./vendor/html5-qrcode.min.js" u ASSETS u service-worker.js (+ bump CACHE_NAME)
  ```
- **Single-user**: jedan Google Sheet = jedan korisnik. Za multi-user treba pravi backend.
