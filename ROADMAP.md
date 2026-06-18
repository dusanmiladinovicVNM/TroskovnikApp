# Roadmap

Prioriteti za dalji razvoj. Podeljeno na higijenu/tehnički dug (A) i proizvodni
razvoj (B).

## A) Higijena / tehnički dug

Status nakon poslednjeg prolaza:

- [x] **Popravljen ekran Izveštaji** — HTML usklađen sa `app.js` (`reportsYear`,
  `reportsMonth`, `reportsYearA/B`, `type=yearlyCompare`, vidljiv search box).
- [x] **`titles` mapa dopunjena** (`reports`, `budgets`, `public-prices`).
- [x] **`.form-grid` CSS dodat** (koristio se a nije bio definisan).
- [x] **Obrisani mrtvi fajlovi** (`oldIndex.html`, `dashboard_standalone_test.html`).
- [x] **Service worker cache bumpovan** (v5 → v6).
- [x] **Dokumentacija** (`README.md`, `CLAUDE.md`, `backend/README.md`).

Preostalo (zahteva pristup backendu ili mrežu van mog okruženja):

- [ ] **Verzionisati `.gs` backend u `backend/`** — najvažnije za sigurnost projekta.
  Backend trenutno postoji samo u GAS editoru. Uputstvo: `backend/README.md`.
- [ ] **JSONP → `doPost`** — uvesti pravi POST na backendu da nestane limit od
  ~6000 karaktera na ručnom računu. Zahteva izmenu GAS-a (i CORS handling), pa se
  ne sme raditi samo na frontendu (polovičan prelaz bi polomio app).
- [ ] **Bundlovati `html5-qrcode` lokalno** (vidi komandu u `README.md`) za pravi
  offline i nezavisnost od unpkg CDN-a; dodati fajl u `ASSETS` u service workeru.
- [ ] **Konfigurabilan GAS URL** umesto hardkodovanog `DEFAULT_GAS_URL` za javnu verziju.

## B) Proizvodni razvoj

Poređano otprilike po odnosu vrednost/trud.

### Brze pobede
- [ ] **Eksport izveštaja** u CSV/PDF.
- [ ] **Pravi grafikoni** (trenutno samo bar po danima) — linijski/pita po kategorijama.
- [ ] **Push notifikacije** za prekoračenje budžeta (PWA podržava).

### Srednje
- [ ] **AI auto-kategorizacija** — LLM klasifikuje nove artikle umesto ručnog
  razvrstavanja (rešava najdosadniji deo toka). Default na najnoviji Claude model.
- [ ] **Praćenje pretplata / ponavljajućih troškova** i ciljeva štednje.
- [ ] **Skladištenje slike računa** + OCR fallback kad QR ne uspe.
- [ ] **Barcode skener u prodavnici** — proširenje shopping asistenta na licu mesta.

### Veliko (menja arhitekturu)
- [ ] **Shopping asistent nad javnim cenovnicima** kao zaseban proizvod —
  `data.gov.rs` obaveza trgovaca da objavljuju cene je realna prilika za
  poređenje cena. Glavni diferencijator.
- [ ] **Multi-user / deljeni kućni budžet** — zahteva pravi backend
  (Supabase/Firebase), autentikaciju i migraciju sa „jedan Sheet = jedan korisnik".
- [ ] **Više valuta.**

## Predlog redosleda

1. Verzionisati backend (A) — bez ovoga je sve rizično.
2. JSONP → POST (A) — otključava pouzdan unos.
3. AI auto-kategorizacija (B) — najveća ušteda vremena korisniku.
4. Eksport + grafikoni (B) — vidljiva vrednost uz mali trud.
5. Tek onda razmatrati multi-user / zaseban price-compare proizvod.
