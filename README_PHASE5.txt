PHASE 5 — DASHBOARD I OSNOVNA ANALITIKA

Ovaj paket dodaje dashboard API u GAS.
Ne menja Code.gs logiku za QR.
Ne menja Receipts.
Ne menja Items.

1) Apps Script

Dodaj novi fajl:

  Phase5_Dashboard.gs

i nalepi sadržaj iz ovog paketa.

2) Code.gs ruta

U doGet(e), unutar try bloka, pre QR obrade, dodaj:

  if (p.action === "dashboard") {
    return jsonp_(callback, p5GetDashboardForPwa_(p));
  }

Primer lokacije:

  try {
    if (p.action === "dashboard") {
      return jsonp_(callback, p5GetDashboardForPwa_(p));
    }

    if (p.action === "categoryCoverage") {
      return jsonp_(callback, p4GetCategoryCoverageForPwa_());
    }

    ...
    if (qrParam) {
      result = processReceipt(qrParam);
    }

3) Deploy

Deploy → Manage deployments → Edit → New version → Deploy

4) Test u Apps Script editoru

Pokreni:

  p5TestDashboard

Gledaj Execution log.

Zatim pokreni:

  p5DashboardPreviewToSheet

Treba da se pojavi sheet:

  P5_Dashboard_Preview

5) Test kroz browser

Otvori URL:

  TVOJ_GAS_EXEC_URL?action=dashboard&year=2026&month=5&callback=testCb

Ako želiš direktno u browser konzoli:

  window.testCb = console.log

6) Frontend

Ako već koristiš Phase4 PWA, dashboard ekran treba da pozove:

  action=dashboard&year=YYYY&month=M

i da očekuje JSONP payload oblika:

  {
    ok: true,
    result: "OK",
    dashboard: {
      year,
      month,
      summary,
      previousMonth,
      categoryTotals,
      vendorTotals,
      dailyTotals,
      topItems,
      uncategorizedPreview
    }
  }

Summary:
- totalAmount
- receiptTotalAmount
- receiptCount
- itemCount
- vendorCount
- categoryCount
- uncategorizedCount

