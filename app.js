const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbzSiA1M2dRFDMT0_b2xQkvFSUffSscOu1cyTJHzVdS0ucOt387OGc2W3krMyyNPq-Cm/exec";
const STORAGE_KEYS = { GAS_URL: "racuni.gasUrl" };
let scanner = null;
let running = false;
let locked = false;
const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  initSettings();
  bindNavigation();
  bindButtons();
  registerServiceWorker();
  updateConnectionBadge();
  window.addEventListener("online", updateConnectionBadge);
  window.addEventListener("offline", updateConnectionBadge);
});

function cacheElements() {
  els.pageTitle = document.getElementById("pageTitle");
  els.connectionBadge = document.getElementById("connectionBadge");
  els.reader = document.getElementById("reader");
  els.status = document.getElementById("status");
  els.startBtn = document.getElementById("startBtn");
  els.restartBtn = document.getElementById("restartBtn");
  els.scanImageBtn = document.getElementById("scanImageBtn");
  els.qrImageInput = document.getElementById("qrImageInput");
  els.manualQrText = document.getElementById("manualQrText");
  els.sendManualQrBtn = document.getElementById("sendManualQrBtn");
  els.gasUrlInput = document.getElementById("gasUrlInput");
  els.saveSettingsBtn = document.getElementById("saveSettingsBtn");
  els.testGasBtn = document.getElementById("testGasBtn");
  els.settingsStatus = document.getElementById("settingsStatus");
}

function initSettings() {
  const savedGasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL;
  localStorage.setItem(STORAGE_KEYS.GAS_URL, savedGasUrl);
  els.gasUrlInput.value = savedGasUrl;
}

function getGasUrl() {
  return (localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL).trim();
}

function setStatus(text, type) {
  els.status.textContent = text;
  els.status.className = "status";
  if (type) els.status.classList.add(type);
}

function setSettingsStatus(text, type) {
  els.settingsStatus.textContent = text;
  els.settingsStatus.className = "status compact";
  if (type) els.settingsStatus.classList.add(type);
}

function bindNavigation() {
  document.querySelectorAll(".bottom-nav button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const view = btn.dataset.view;
      if (!view) return;
      if (view !== "scan") await stopScannerSilently();
      document.querySelectorAll(".bottom-nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
      document.getElementById(`view-${view}`).classList.add("active");
      const titles = { dashboard: "Pregled", scan: "Skeniraj QR", manual: "Ručni unos", prices: "Pretraga cena", settings: "Podešavanja" };
      els.pageTitle.textContent = titles[view] || "Računi";
    });
  });
}

function bindButtons() {
  els.startBtn.addEventListener("click", startScanner);
  els.restartBtn.addEventListener("click", restartScanner);
  els.scanImageBtn.addEventListener("click", () => els.qrImageInput.click());
  els.qrImageInput.addEventListener("change", scanQrFromImage);
  els.sendManualQrBtn.addEventListener("click", () => {
    const qrText = els.manualQrText.value.trim();
    if (!qrText) {
      setStatus("Nalepi QR URL pre slanja.", "error");
      return;
    }
    sendToGas(qrText);
  });
  els.saveSettingsBtn.addEventListener("click", () => {
    const url = els.gasUrlInput.value.trim();
    if (!isValidGasUrl(url)) {
      setSettingsStatus("GAS URL mora biti https://... i završavati se na /exec.", "error");
      return;
    }
    localStorage.setItem(STORAGE_KEYS.GAS_URL, url);
    setSettingsStatus("Podešavanja sačuvana.", "ok");
  });
  els.testGasBtn.addEventListener("click", testGasEndpoint);
}

function isValidGasUrl(url) {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(url);
}

async function startScanner() {
  if (running) return;
  if (!window.Html5Qrcode) {
    setStatus("html5-qrcode biblioteka nije učitana. Proveri internet/CDN.", "error");
    return;
  }
  locked = false;
  setStatus("Pokrećem kameru...");
  try {
    els.reader.innerHTML = "";
    scanner = new Html5Qrcode("reader");
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      onScanSuccess,
      () => {}
    );
    running = true;
    setStatus("Kamera radi. Uperi je u QR kod sa računa.");
  } catch (err) {
    running = false;
    setStatus("Ne mogu da pokrenem kameru: " + formatError(err), "error");
  }
}

async function onScanSuccess(decodedText) {
  if (locked) return;
  locked = true;
  setStatus("QR pročitan. Šaljem u Google Sheet...");
  await stopScannerSilently();
  sendToGas(decodedText);
}

async function stopScannerSilently() {
  try {
    if (scanner && running) {
      await scanner.stop();
      await scanner.clear();
    }
  } catch (e) {}
  running = false;
}

async function restartScanner() {
  await stopScannerSilently();
  locked = false;
  els.reader.innerHTML = "";
  setStatus("Spremno za novo skeniranje.");
  startScanner();
}

async function scanQrFromImage(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!window.Html5Qrcode) {
    setStatus("html5-qrcode biblioteka nije učitana. Proveri internet/CDN.", "error");
    return;
  }
  await stopScannerSilently();
  locked = true;
  setStatus("Čitam QR iz slike...");
  try {
    els.reader.innerHTML = "";
    const imageScanner = new Html5Qrcode("reader");
    const decodedText = await imageScanner.scanFile(file, true);
    try { await imageScanner.clear(); } catch (e) {}
    setStatus("QR pročitan iz slike. Šaljem u Google Sheet...");
    sendToGas(decodedText);
  } catch (err) {
    locked = false;
    setStatus("Ne mogu da pročitam QR iz slike: " + formatError(err), "error");
  }
}

function sendToGas(qrText) {
  const gasUrl = getGasUrl();
  if (!isValidGasUrl(gasUrl)) {
    setStatus("GAS URL nije podešen. Idi na Podeš. i unesi /exec URL.", "error");
    return;
  }
  if (!qrText || !/^https?:\/\//i.test(qrText.trim())) {
    setStatus("QR nije validan URL.", "error");
    return;
  }
  setStatus("Šaljem u GAS...");
  const callbackName = "gasCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  const script = document.createElement("script");
  const timeoutId = window.setTimeout(() => {
    cleanupJsonp(callbackName, script);
    setStatus("GAS nije vratio odgovor u roku. Proveri internet, deploy i Sheet.", "error");
  }, 45000);
  window[callbackName] = function(response) {
    window.clearTimeout(timeoutId);
    cleanupJsonp(callbackName, script);
    const result = response && response.result ? String(response.result) : "Nema odgovora";
    handleGasResult(result);
  };
  script.onerror = function() {
    window.clearTimeout(timeoutId);
    cleanupJsonp(callbackName, script);
    setStatus("Greška: ne mogu da pozovem GAS backend.", "error");
  };
  script.src = gasUrl + "?qr=" + encodeURIComponent(qrText.trim()) + "&callback=" + encodeURIComponent(callbackName) + "&_ts=" + Date.now();
  document.body.appendChild(script);
}

function cleanupJsonp(callbackName, script) {
  try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
  if (script && script.parentNode) script.parentNode.removeChild(script);
}

function handleGasResult(result) {
  if (result.indexOf("OK:") === 0) return setStatus(result, "ok");
  if (result === "DUPLICATE") return setStatus("DUPLICATE — ovaj račun je već dodat.", "warn");
  if (result.indexOf("MANUAL JOURNAL OK:") === 0) return setStatus(result, "ok");
  if (result.indexOf("ERROR:") === 0 || result.indexOf("HTTP ") === 0 || result.indexOf("JSON") >= 0) return setStatus(result, "error");
  setStatus(result, "warn");
}

function testGasEndpoint() {
  const gasUrl = els.gasUrlInput.value.trim();
  if (!isValidGasUrl(gasUrl)) {
    setSettingsStatus("GAS URL mora biti https://.../exec.", "error");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl);
  setSettingsStatus("Testiram GAS endpoint...");
  const callbackName = "gasTestCallback_" + Date.now();
  const script = document.createElement("script");
  const timeoutId = window.setTimeout(() => {
    cleanupJsonp(callbackName, script);
    setSettingsStatus("Nema odgovora od GAS-a u roku.", "error");
  }, 20000);
  window[callbackName] = function(response) {
    window.clearTimeout(timeoutId);
    cleanupJsonp(callbackName, script);
    const result = response && response.result ? String(response.result) : "Nema odgovora";
    setSettingsStatus("GAS odgovor: " + result, result.indexOf("OK:") === 0 ? "ok" : "warn");
  };
  script.onerror = function() {
    window.clearTimeout(timeoutId);
    cleanupJsonp(callbackName, script);
    setSettingsStatus("Ne mogu da pozovem GAS endpoint.", "error");
  };
  script.src = gasUrl + "?callback=" + encodeURIComponent(callbackName) + "&_ts=" + Date.now();
  document.body.appendChild(script);
}

function updateConnectionBadge() {
  if (!els.connectionBadge) return;
  if (navigator.onLine) {
    els.connectionBadge.textContent = "Online";
    els.connectionBadge.style.color = "#bbf7d0";
  } else {
    els.connectionBadge.textContent = "Offline";
    els.connectionBadge.style.color = "#fed7aa";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function formatError(err) {
  if (!err) return "nepoznata greška";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  return String(err);
}
