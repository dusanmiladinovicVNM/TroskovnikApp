const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbzSiA1M2dRFDMT0_b2xQkvFSUffSscOu1cyTJHzVdS0ucOt387OGc2W3krMyyNPq-Cm/exec";

let scanner = null;
let running = false;
let locked = false;

let appState = {
  gasUrl: localStorage.getItem("gasUrl") || DEFAULT_GAS_URL,
  categories: [],
  vendors: [],
  vendorItems: [],
  categoryQueue: [],
  categorySearchTimer: null,
  selectedVendor: ""
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("gasUrlInput").value = appState.gasUrl;
  setDefaultManualDate();
  addManualItemRow();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  if (document.getElementById("autoReloadLookups").checked) {
    loadLookups();
    loadCategoryCoverage();
  }
});

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");

  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.bottom-nav button[data-screen="${name}"]`);
  if (btn) btn.classList.add("active");

  const titles = {
    dashboard: "Pregled",
    scan: "Skeniraj QR",
    manual: "Ručni unos",
    categorize: "Kategorizacija",
    prices: "Pretraga cena",
    settings: "Podešavanja"
  };
  document.getElementById("screenTitle").textContent = titles[name] || "Računi";

  if (name === "categorize") {
    loadCategoryCoverage();
    loadCategoryQueue();
  }
}

function setStatus(text, type) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = "status";
  if (type) el.classList.add(type);
}

function setManualStatus(text, type) {
  const el = document.getElementById("manualStatus");
  el.textContent = text;
  el.className = "status mt";
  if (type) el.classList.add(type);
}

function setSettingsStatus(text, type) {
  const el = document.getElementById("settingsStatus");
  el.textContent = text;
  el.className = "status mt";
  if (type) el.classList.add(type);
}

function setCategorizeStatus(text, type) {
  const el = document.getElementById("categoryStatus");
  if (!el) return;
  el.textContent = text;
  el.className = "status mt";
  if (type) el.classList.add(type);
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RSD";
}

function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  let s = String(value).trim();
  if (!s) return 0;

  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[š]/g, "s")
    .replace(/[ž]/g, "z")
    .replace(/[đ]/g, "dj")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* JSONP API */

function callGasJsonp(params, onSuccess, onError) {
  const gasUrl = appState.gasUrl || DEFAULT_GAS_URL;
  const callbackName = "gasCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

  const script = document.createElement("script");
  const query = new URLSearchParams();

  Object.keys(params || {}).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      query.set(key, params[key]);
    }
  });

  query.set("callback", callbackName);

  let done = false;
  const timeout = setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
    if (onError) onError(new Error("GAS timeout"));
  }, 60000);

  function cleanup() {
    clearTimeout(timeout);
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
  }

  window[callbackName] = function(payload) {
    if (done) return;
    done = true;
    cleanup();
    onSuccess(payload || {});
  };

  script.onerror = function() {
    if (done) return;
    done = true;
    cleanup();
    if (onError) onError(new Error("Ne mogu da pozovem GAS backend"));
  };

  script.src = gasUrl + "?" + query.toString();
  document.body.appendChild(script);
}

/* QR SCANNER */

async function startScanner() {
  if (running) return;

  locked = false;
  setStatus("Pokrećem kameru...");

  try {
    document.getElementById("reader").innerHTML = "";
    scanner = new Html5Qrcode("reader");

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      function () {}
    );

    running = true;
    setStatus("Kamera radi. Uperi je u QR kod sa računa.");
  } catch (err) {
    setStatus("Ne mogu da pokrenem kameru: " + err, "error");
  }
}

async function onScanSuccess(decodedText) {
  if (locked) return;
  locked = true;

  setStatus("QR pročitan. Šaljem u Google Sheet...");

  try {
    if (scanner && running) {
      await scanner.stop();
      await scanner.clear();
    }
  } catch (e) {}

  running = false;
  sendToGas(decodedText);
}

function sendToGas(qrText) {
  callGasJsonp(
    { qr: qrText },
    response => {
      const result = response && response.result ? String(response.result) : "Nema odgovora";

      if (result.indexOf("OK:") === 0) {
        setStatus(result, "ok");
        loadLookups();
      } else if (result === "DUPLICATE") {
        setStatus("DUPLICATE — ovaj račun je već dodat.", "warn");
      } else {
        setStatus(result, "error");
      }
    },
    err => setStatus("Greška: " + err.message, "error")
  );
}

async function restartScanner() {
  try {
    if (scanner && running) {
      await scanner.stop();
      await scanner.clear();
    }
  } catch (e) {}

  running = false;
  locked = false;
  document.getElementById("reader").innerHTML = "";
  setStatus("Spremno za novo skeniranje.");
  startScanner();
}

async function scanQrFromImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  setStatus("Čitam QR iz slike...");

  try {
    const imageScanner = new Html5Qrcode("reader");
    const decodedText = await imageScanner.scanFile(file, true);
    setStatus("QR pročitan iz slike. Šaljem u Google Sheet...");
    sendToGas(decodedText);
  } catch (err) {
    setStatus("Ne mogu da pročitam QR iz slike: " + err, "error");
  } finally {
    event.target.value = "";
  }
}

function sendManualQr() {
  const text = document.getElementById("manualQrText").value.trim();
  if (!text) {
    setStatus("Nalepi QR URL.", "error");
    return;
  }
  setStatus("Šaljem ručno unet QR URL...");
  sendToGas(text);
}

/* SETTINGS */

function saveSettings() {
  const url = document.getElementById("gasUrlInput").value.trim();
  if (!url) {
    setSettingsStatus("Unesi GAS URL.", "error");
    return;
  }

  appState.gasUrl = url;
  localStorage.setItem("gasUrl", url);
  setSettingsStatus("Podešavanja sačuvana.", "ok");
}

function testGas() {
  saveSettings();
  setSettingsStatus("Testiram GAS...");

  callGasJsonp(
    {},
    response => {
      const result = response && response.result ? String(response.result) : JSON.stringify(response);
      setSettingsStatus("GAS odgovor: " + result, "ok");
    },
    err => setSettingsStatus("Greška: " + err.message, "error")
  );
}

/* LOOKUPS */

function loadLookups() {
  loadCategories();
  loadVendors();
}

function loadCategories() {
  callGasJsonp(
    { action: "categories" },
    response => {
      appState.categories = response.categories || [];
      refreshCategorySelects();
    },
    () => {}
  );
}

function loadVendors() {
  callGasJsonp(
    { action: "vendors" },
    response => {
      appState.vendors = response.vendors || [];
      const list = document.getElementById("vendorsList");
      list.innerHTML = "";
      appState.vendors.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.vendorName || v;
        list.appendChild(opt);
      });
    },
    () => {}
  );
}

function onVendorChanged() {
  const vendor = document.getElementById("manualVendor").value.trim();
  appState.selectedVendor = vendor;

  if (!vendor) return;

  callGasJsonp(
    { action: "vendorItems", vendor },
    response => {
      appState.vendorItems = response.items || [];
      refreshVendorItemsList();
    },
    () => {}
  );
}

function refreshVendorItemsList() {
  const list = document.getElementById("vendorItemsList");
  list.innerHTML = "";

  appState.vendorItems.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.itemName || item.ItemName || "";
    const price = item.lastPrice || item.LastPrice || "";
    const cat = item.category || item.Category || "";
    opt.label = [opt.value, price ? formatMoney(price) : "", cat].filter(Boolean).join(" — ");
    list.appendChild(opt);
  });
}

function refreshCategorySelects() {
  document.querySelectorAll(".categorySelect").forEach(select => fillCategorySelect(select, select.dataset.currentValue || ""));
}

function fillCategorySelect(select, currentValue) {
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Nerazvrstano";
  select.appendChild(empty);

  appState.categories.forEach(c => {
    const category = c.category || c.Category || "";
    const subcategory = c.subcategory || c.Subcategory || "";
    const value = category + "|" + subcategory;

    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = category + " / " + subcategory;
    select.appendChild(opt);
  });

  if (currentValue) select.value = currentValue;
}

/* MANUAL RECEIPT */

function setDefaultManualDate() {
  const el = document.getElementById("manualDate");
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  el.value = now.toISOString().slice(0, 16);
}

function addManualItemRow(prefill = {}) {
  const container = document.getElementById("manualItems");
  const row = document.createElement("div");
  row.className = "item-row";

  row.innerHTML = `
    <div class="item-row-top">
      <div class="item-row-title">Stavka</div>
      <button type="button" class="small secondary" onclick="removeItemRow(this)">Obriši</button>
    </div>

    <label>Artikal</label>
    <input class="itemName" list="vendorItemsList" placeholder="Izaberi ili unesi artikal" oninput="onItemNameChanged(this)" value="${escapeHtml(prefill.itemName || "")}">

    <div class="grid2">
      <div>
        <label>Količina</label>
        <input class="itemQty" type="number" step="0.001" min="0" value="${prefill.qty || 1}" oninput="recalcManualTotals()">
      </div>
      <div>
        <label>Jed. cena</label>
        <input class="itemUnitPrice" inputmode="decimal" placeholder="0,00" value="${prefill.unitPrice || ""}" oninput="recalcManualTotals()">
      </div>
    </div>

    <label>Ukupno</label>
    <input class="itemTotal" inputmode="decimal" placeholder="0,00" value="${prefill.total || ""}" oninput="recalcManualTotals()">

    <label>Kategorija</label>
    <select class="categorySelect"></select>

    <label>Poreska oznaka / stopa</label>
    <input class="itemTaxRate" placeholder="npr. Е, Ђ, A..." value="${escapeHtml(prefill.taxRate || "")}">
  `;

  container.appendChild(row);
  fillCategorySelect(row.querySelector(".categorySelect"), "");
  recalcManualTotals();
}

function removeItemRow(btn) {
  btn.closest(".item-row").remove();
  recalcManualTotals();
}

function onItemNameChanged(input) {
  const value = input.value.trim();
  const normalized = normalizeText(value);
  const row = input.closest(".item-row");

  const found = appState.vendorItems.find(item =>
    normalizeText(item.itemName || item.ItemName || "") === normalized
  );

  if (!found) return;

  const price = found.lastPrice || found.LastPrice || "";
  const category = found.category || found.Category || "";
  const subcategory = found.subcategory || found.Subcategory || "";
  const taxRate = found.taxRate || found.TaxRate || "";

  if (price) row.querySelector(".itemUnitPrice").value = String(price).replace(".", ",");
  if (taxRate) row.querySelector(".itemTaxRate").value = taxRate;

  const select = row.querySelector(".categorySelect");
  if (category) {
    const value = category + "|" + (subcategory || "");
    select.dataset.currentValue = value;
    fillCategorySelect(select, value);
  }

  recalcManualTotals();
}

function recalcManualTotals() {
  let total = 0;

  document.querySelectorAll(".item-row").forEach(row => {
    const qty = Number(row.querySelector(".itemQty").value || 0);
    const unit = parseMoney(row.querySelector(".itemUnitPrice").value);
    const totalInput = row.querySelector(".itemTotal");

    if (document.activeElement !== totalInput) {
      const rowTotal = qty * unit;
      totalInput.value = rowTotal ? rowTotal.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
    }

    total += parseMoney(totalInput.value);
  });

  document.getElementById("manualTotal").textContent = formatMoney(total);
}

function collectManualReceiptPayload() {
  const vendor = document.getElementById("manualVendor").value.trim();
  if (!vendor) throw new Error("Unesi prodavca.");

  const items = [];

  document.querySelectorAll(".item-row").forEach(row => {
    const itemName = row.querySelector(".itemName").value.trim();
    if (!itemName) return;

    const qty = Number(row.querySelector(".itemQty").value || 0);
    const unitPrice = parseMoney(row.querySelector(".itemUnitPrice").value);
    const total = parseMoney(row.querySelector(".itemTotal").value);
    const taxRate = row.querySelector(".itemTaxRate").value.trim();

    const categoryValue = row.querySelector(".categorySelect").value || "";
    const [category, subcategory] = categoryValue ? categoryValue.split("|") : ["Nerazvrstano", "Nerazvrstano"];

    items.push({
      itemName,
      qty,
      unitPrice,
      total: total || qty * unitPrice,
      category: category || "Nerazvrstano",
      subcategory: subcategory || "Nerazvrstano",
      taxRate,
      rememberMode: "vendor"
    });
  });

  if (!items.length) throw new Error("Dodaj bar jednu stavku.");

  const totalAmount = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

  return {
    receiptDate: document.getElementById("manualDate").value,
    vendor,
    invoiceNumber: document.getElementById("manualInvoiceNumber").value.trim(),
    paymentMethod: document.getElementById("manualPaymentMethod").value,
    note: document.getElementById("manualNote").value.trim(),
    totalAmount,
    items
  };
}

function saveManualReceipt() {
  let payload;

  try {
    payload = collectManualReceiptPayload();
  } catch (err) {
    setManualStatus(err.message, "error");
    return;
  }

  const payloadText = JSON.stringify(payload);

  if (payloadText.length > 6000) {
    setManualStatus("Račun ima previše podataka za JSONP GET. Smanji broj stavki ili ćemo u sledećoj fazi dodati POST proxy.", "error");
    return;
  }

  setManualStatus("Šaljem ručni račun u GAS...");

  callGasJsonp(
    { action: "manualReceipt", payload: payloadText },
    response => {
      const result = response && response.result ? String(response.result) : JSON.stringify(response);

      if (result.indexOf("MANUAL OK:") === 0) {
        setManualStatus(result, "ok");
        resetManualForm(false);
        loadLookups();
      } else if (result === "DUPLICATE") {
        setManualStatus("DUPLICATE — ovaj ručni račun je već dodat.", "warn");
      } else {
        setManualStatus(result, "error");
      }
    },
    err => setManualStatus("Greška: " + err.message, "error")
  );
}

function resetManualForm(resetDate = true) {
  document.getElementById("manualVendor").value = "";
  document.getElementById("manualInvoiceNumber").value = "";
  document.getElementById("manualPaymentMethod").value = "MANUAL";
  document.getElementById("manualNote").value = "";
  document.getElementById("manualItems").innerHTML = "";
  appState.vendorItems = [];
  refreshVendorItemsList();
  if (resetDate) setDefaultManualDate();
  addManualItemRow();
  setManualStatus("Forma je očišćena.");
}


/* CATEGORIZATION — PHASE 4 */

function loadCategoryCoverage() {
  const el = document.getElementById("categoryCoverage");
  if (!el) return;

  callGasJsonp(
    { action: "categoryCoverage" },
    response => {
      const total = Number(response.total || 0);
      const categorized = Number(response.categorized || 0);
      const uncategorized = Number(response.uncategorized || 0);
      const percent = total ? Math.round((categorized / total) * 100) : 0;

      el.textContent = `Kategorisano: ${categorized}/${total} (${percent}%). Nerazvrstano: ${uncategorized}.`;
    },
    () => {
      el.textContent = "Ne mogu da učitam status kategorizacije.";
    }
  );
}

function debouncedLoadCategoryQueue() {
  clearTimeout(appState.categorySearchTimer);
  appState.categorySearchTimer = setTimeout(loadCategoryQueue, 350);
}

function loadCategoryQueue() {
  const qEl = document.getElementById("categorySearch");
  const q = qEl ? qEl.value.trim() : "";

  setCategorizeStatus("Učitavam nerazvrstane artikle...");

  callGasJsonp(
    { action: "categoryQueue", q, limit: 80 },
    response => {
      appState.categoryQueue = response.items || [];
      renderCategoryQueue();

      const total = response.total || appState.categoryQueue.length;
      if (appState.categoryQueue.length) {
        setCategorizeStatus(`Prikazujem ${appState.categoryQueue.length} od ${total} nerazvrstanih artikala.`, "ok");
      } else {
        setCategorizeStatus("Nema nerazvrstanih artikala za prikaz.", "ok");
      }
    },
    err => setCategorizeStatus("Greška: " + err.message, "error")
  );
}

function renderCategoryQueue() {
  const container = document.getElementById("categoryQueue");
  if (!container) return;

  container.innerHTML = "";

  if (!appState.categoryQueue.length) {
    container.innerHTML = `<div class="empty-state">Nema stavki za kategorizaciju.</div>`;
    return;
  }

  appState.categoryQueue.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "category-card";
    card.dataset.index = String(index);

    const lastPrice = item.lastPrice ? formatMoney(item.lastPrice) : "bez cene";
    const timesBought = item.timesBought || 1;
    const tax = item.taxRate ? `Porez: ${escapeHtml(item.taxRate)}` : "";

    card.innerHTML = `
      <div class="category-card-title">${escapeHtml(item.itemName || "")}</div>
      <div class="category-card-meta">${escapeHtml(item.vendorName || "")}</div>
      <div class="category-pill-row">
        <span class="pill">${lastPrice}</span>
        <span class="pill">${timesBought} kup.</span>
        ${tax ? `<span class="pill">${tax}</span>` : ""}
      </div>

      <div class="category-actions">
        <label>Kategorija</label>
        <select class="categorySelect categoryAssignSelect"></select>

        <label>Primeni</label>
        <select class="rememberMode">
          <option value="vendor">Uvek za ovaj artikal kod ovog prodavca</option>
          <option value="global">Uvek za ovaj artikal kod svih prodavaca</option>
          <option value="both">Kod ovog prodavca + globalno</option>
        </select>

        <button onclick="saveCategoryForQueueItem(this)">Sačuvaj kategoriju</button>
      </div>
    `;

    container.appendChild(card);
    fillCategorySelect(card.querySelector(".categoryAssignSelect"), "");
  });
}

function saveCategoryForQueueItem(btn) {
  const card = btn.closest(".category-card");
  const index = Number(card.dataset.index || 0);
  const item = appState.categoryQueue[index];
  if (!item) return;

  const categoryValue = card.querySelector(".categoryAssignSelect").value || "";
  if (!categoryValue) {
    setCategorizeStatus("Izaberi kategoriju pre čuvanja.", "error");
    return;
  }

  const [category, subcategory] = categoryValue.split("|");
  const rememberMode = card.querySelector(".rememberMode").value || "vendor";

  const payload = {
    vendorName: item.vendorName,
    itemName: item.itemName,
    category,
    subcategory,
    taxRate: item.taxRate || "",
    price: item.lastPrice || "",
    rememberMode
  };

  btn.disabled = true;
  btn.textContent = "Čuvam...";
  setCategorizeStatus("Čuvam kategoriju...");

  callGasJsonp(
    { action: "updateCategory", payload: JSON.stringify(payload) },
    response => {
      const result = response && response.result ? String(response.result) : JSON.stringify(response);
      setCategorizeStatus(result, result.indexOf("OK") === 0 ? "ok" : "warn");

      appState.categoryQueue.splice(index, 1);
      renderCategoryQueue();
      loadCategoryCoverage();
      loadLookups();
    },
    err => {
      btn.disabled = false;
      btn.textContent = "Sačuvaj kategoriju";
      setCategorizeStatus("Greška: " + err.message, "error");
    }
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
