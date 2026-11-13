// K2 Capital: portfolio page logic.
// Data comes from /api/portfolio (see functions/api/portfolio.js).

const PALETTE = ["#495a30", "#c9a227", "#8c2f39", "#2a7f9e", "#8e5ea2", "#d2691e", "#4b5563", "#9bb36b", "#c2185b", "#00897b"];

// Sample data used when the page is opened straight from a file (no server) or
// when no /api/portfolio function exists yet. Live data replaces this once deployed.
const SAMPLE = {
  demo: true,
  updated: new Date().toISOString(),
  warnings: [],
  holdings: [
    { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", shares: 10, buy: 172.5, price: 228.1 },
    { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", shares: 6, buy: 380.0, price: 415.3 },
    { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", shares: 8, buy: 150.2, price: 211.4 },
    { ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care", shares: 7, buy: 160.0, price: 152.6 },
    { ticker: "XOM", name: "Exxon Mobil", sector: "Energy", shares: 12, buy: 104.0, price: 111.9 }
  ]
};

const state = { holdings: [], sector: "All", group: true, sortKey: "value", sortDir: -1 };

const $ = (id) => document.getElementById(id);
const money = (n) => n == null || isNaN(n) ? "–" :
  n.toLocaleString("en-CA", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const pct = (n) => n == null || isNaN(n) ? "–" : (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
const cls = (n) => n == null || isNaN(n) ? "" : n >= 0 ? "gain" : "loss";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function enrich(h) {
  const value = h.price != null ? h.price * h.shares : null;
  const cost = h.buy * h.shares;
  const gain = value != null ? value - cost : null;
  const roi = h.price != null && h.buy ? (h.price - h.buy) / h.buy : null;
  return { ...h, value, cost, gain, roi };
}

function totals(list) {
  const priced = list.filter((h) => h.value != null);
  const value = priced.reduce((a, h) => a + h.value, 0);
  const cost = priced.reduce((a, h) => a + h.cost, 0);
  return { value, cost, gain: value - cost, roi: cost ? (value - cost) / cost : null };
}

function renderSummary() {
  const t = totals(state.holdings);
  $("s-value").textContent = money(t.value);
  $("s-cost").textContent = money(t.cost);
  $("s-gain").textContent = money(t.gain);
  $("s-gain").className = "value " + cls(t.gain);
  $("s-roi").textContent = pct(t.roi);
  $("s-roi").className = "value " + cls(t.roi);
}

function sectorList() {
  return [...new Set(state.holdings.map((h) => h.sector || "Other"))].sort();
}

function renderAlloc() {
  const sectors = sectorList();
  const total = state.holdings.reduce((a, h) => a + (h.value ?? h.cost), 0) || 1;
  let bar = "", legend = "";
  sectors.forEach((s, i) => {
    const sum = state.holdings.filter((h) => (h.sector || "Other") === s).reduce((a, h) => a + (h.value ?? h.cost), 0);
    const w = (sum / total) * 100;
    const color = PALETTE[i % PALETTE.length];
    bar += `<div style="width:${w}%;background:${color}" title="${esc(s)} ${w.toFixed(1)}%"></div>`;
    legend += `<span><i style="background:${color}"></i>${esc(s)} ${w.toFixed(1)}%</span>`;
  });
  $("alloc").innerHTML = bar;
  $("legend").innerHTML = legend;
}

function renderChips() {
  const items = ["All", ...sectorList()];
  $("chips").innerHTML = items
    .map((s) => `<button class="chip ${s === state.sector ? "on" : ""}" data-s="${esc(s)}">${esc(s)}</button>`)
    .join(" ");
  $("chips").querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => { state.sector = b.dataset.s; renderChips(); renderRows(); })
  );
}

function rowHtml(h) {
  return `<tr>
    <td><span class="ticker">${esc(h.ticker)}</span><div class="name">${esc(h.name)}</div></td>
    <td>${esc(h.sector || "Other")}</td>
    <td>${h.shares.toLocaleString()}</td>
    <td>${money(h.buy)}</td>
    <td>${money(h.price)}</td>
    <td>${money(h.value)}</td>
    <td class="${cls(h.gain)}">${money(h.gain)}</td>
    <td class="${cls(h.roi)}"><strong>${pct(h.roi)}</strong></td>
  </tr>`;
}

function renderRows() {
  let list = state.holdings.filter((h) => state.sector === "All" || (h.sector || "Other") === state.sector);
  const k = state.sortKey, d = state.sortDir;
  const val = (h) => (h[k] == null ? -Infinity : h[k]);
  const cmp = (a, b) => (typeof a[k] === "string" ? a[k].localeCompare(b[k]) * d : (val(a) - val(b)) * d);
  let html = "";

  if (state.group) {
    const sectors = [...new Set(list.map((h) => h.sector || "Other"))].sort();
    sectors.forEach((s) => {
      const items = list.filter((h) => (h.sector || "Other") === s).sort(cmp);
      const t = totals(items);
      html += `<tr class="group"><td colspan="5">${esc(s)} (${items.length})</td>
        <td class="num">${money(t.value)}</td>
        <td class="num ${cls(t.gain)}">${money(t.gain)}</td>
        <td class="num ${cls(t.roi)}">${pct(t.roi)}</td></tr>`;
      html += items.map(rowHtml).join("");
    });
  } else {
    html = list.sort(cmp).map(rowHtml).join("");
  }
  $("rows").innerHTML = html || `<tr><td colspan="8" style="text-align:center;color:#6b7587">No holdings to show yet.</td></tr>`;
}

function setStatus(msg, kind) {
  $("status").innerHTML = msg ? `<div class="banner ${kind || ""}">${msg}</div>` : "";
}

async function load() {
  try {
    let data;
    try {
      if (location.protocol === "file:") throw new Error("no server");
      const res = await fetch("/api/portfolio");
      if (res.status === 404) throw new Error("no function");
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();
    } catch (e) {
      // Not deployed yet (or opened as a local file): fall back to sample data.
      if (location.protocol === "file:" || String(e.message) === "no function") data = SAMPLE;
      else throw e;
    }
    state.holdings = data.holdings.map(enrich);
    if (data.demo) setStatus("Showing sample data. Connect your Google Sheet and price API key to go live (see README).");
    else if (data.warnings && data.warnings.length) setStatus("Some prices could not be loaded: " + esc(data.warnings.join(", ")));
    $("updated").textContent = (data.demo ? "Sample prices. " : "Prices last refreshed " + new Date(data.updated).toLocaleString("en-CA") + ". Quotes refresh about every 15 minutes and may be delayed. ") +
      "Amounts in USD unless noted.";
    renderSummary(); renderAlloc(); renderChips(); renderRows();
  } catch (e) {
    setStatus("Couldn't load the portfolio right now. Please try again shortly.", "error");
    console.error(e);
  }
}

document.querySelectorAll("thead th").forEach((th) =>
  th.addEventListener("click", () => {
    const k = th.dataset.k;
    state.sortDir = state.sortKey === k ? -state.sortDir : (k === "ticker" || k === "sector" ? 1 : -1);
    state.sortKey = k;
    renderRows();
  })
);
$("group").addEventListener("change", (e) => { state.group = e.target.checked; renderRows(); });

load();
