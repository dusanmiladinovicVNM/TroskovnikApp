PHASE 4 — KATEGORIZACIJA

1. Upload/replace frontend files: index.html, styles.css, app.js, manifest.json, service-worker.js.
2. In Apps Script add file Phase4_Categorization.gs.
3. In Code.gs doGet(e), inside try block before QR processing, add:

if (p.action === "categoryCoverage") {
  return jsonp_(callback, p4GetCategoryCoverageForPwa_());
}
if (p.action === "categoryQueue") {
  return jsonp_(callback, p4GetCategoryQueueForPwa_(p));
}
if (p.action === "updateCategory") {
  const payload = JSON.parse(p.payload || "{}");
  return jsonp_(callback, { result: p4UpdateCategoryForPwa_(payload) });
}

4. Deploy new Apps Script version.
5. Open PWA → Kategor. → Osveži listu.
