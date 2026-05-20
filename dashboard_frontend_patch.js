/* PHASE 5 FRONTEND PATCH — ubaci u svoj app.js i prilagodi imena ako se razlikuju.

Očekuje se da već imaš:
- GAS URL u localStorage ili promenljivoj
- jsonp helper
- setStatus helper ili sopstveni render
*/

async function loadDashboardPhase5() {
  const gasUrl = localStorage.getItem("gasUrl") || window.GAS_URL || "";
  const now = new Date();

  const year = document.getElementById("dashboardYear")?.value || now.getFullYear();
  const month = document.getElementById("dashboardMonth")?.value || (now.getMonth() + 1);

  const url = gasUrl + "?action=dashboard&year=" + encodeURIComponent(year) + "&month=" + encodeURIComponent(month);

  const payload = await jsonp(url);
  renderDashboardPhase5(payload.dashboard);
}

function renderDashboardPhase5(d) {
  const root = document.getElementById("dashboardContent");
  if (!root) return;

  const money = n => new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 2 }).format(Number(n || 0)) + " RSD";
  const s = d.summary;

  root.innerHTML = `
    <div class="dash-grid">
      <div class="dash-card"><span>Ukupno</span><strong>${money(s.totalAmount)}</strong></div>
      <div class="dash-card"><span>Računa</span><strong>${s.receiptCount}</strong></div>
      <div class="dash-card"><span>Stavki</span><strong>${s.itemCount}</strong></div>
      <div class="dash-card"><span>Nerazvrstano</span><strong>${s.uncategorizedCount}</strong></div>
    </div>

    <h3>Top kategorije</h3>
    ${phase5MiniTable(["Kategorija", "Iznos"], d.categoryTotals.slice(0, 8).map(r => [
      `${r.category} / ${r.subcategory}`, money(r.amount)
    ]))}

    <h3>Top prodavci</h3>
    ${phase5MiniTable(["Prodavac", "Iznos"], d.vendorTotals.slice(0, 8).map(r => [
      r.vendor, money(r.amount)
    ]))}

    <h3>Po danima</h3>
    ${phase5MiniTable(["Dan", "Iznos"], d.dailyTotals.map(r => [
      r.day, money(r.amount)
    ]))}
  `;
}

function phase5MiniTable(headers, rows) {
  return `<div class="mini-table">
    <div class="mini-row mini-head">${headers.map(h => `<div>${h}</div>`).join("")}</div>
    ${rows.map(row => `<div class="mini-row">${row.map(c => `<div>${c}</div>`).join("")}</div>`).join("")}
  </div>`;
}
