// K2 Capital: portfolio page logic.
// Data comes from /api/portfolio (see functions/api/portfolio.js).
// Positions, average prices and realized gains are computed there; this file converts to CAD and renders.

const PALETTE = ["#495a30", "#c9a227", "#8c2f39", "#2a7f9e", "#8e5ea2", "#d2691e", "#4b5563", "#9bb36b", "#c2185b", "#00897b"];

// Sample data used when the page is opened straight from a file (no server) or
// when no /api/portfolio function exists yet. Live data replaces this once deployed.
const SAMPLE = {
  "demo": true,
  "warnings": [],
  "fx": {
    "USD": 1.4,
    "CAD": 1,
    "source": "sample rate"
  },
  "invested": {
    "USD": 8174.6,
    "CAD": 4710
  },
  "holdings": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "sector": "Technology",
      "currency": "USD",
      "shares": 6,
      "avg": 172.5,
      "buyDate": "2025-09-15",
      "price": 228.1
    },
    {
      "ticker": "JPM",
      "name": "JPMorgan Chase",
      "sector": "Financials",
      "currency": "USD",
      "shares": 8,
      "avg": 150.2,
      "buyDate": "2025-09-15",
      "price": 211.4
    },
    {
      "ticker": "MSFT",
      "name": "Microsoft Corp.",
      "sector": "Technology",
      "currency": "USD",
      "shares": 6,
      "avg": 380,
      "buyDate": "2025-10-02",
      "price": 415.3
    },
    {
      "ticker": "JNJ",
      "name": "Johnson & Johnson",
      "sector": "Health Care",
      "currency": "USD",
      "shares": 7,
      "avg": 160,
      "buyDate": "2025-11-10",
      "price": 152.6
    },
    {
      "ticker": "XOM",
      "name": "Exxon Mobil",
      "sector": "Energy",
      "currency": "USD",
      "shares": 12,
      "avg": 104,
      "buyDate": "2026-01-20",
      "price": 111.9
    },
    {
      "ticker": "RY.TO",
      "name": "Royal Bank of Canada",
      "sector": "Financials",
      "currency": "CAD",
      "shares": 20,
      "avg": 138,
      "buyDate": "2026-02-03",
      "price": 165.2
    }
  ],
  "sells": [
    {
      "date": "2026-05-15",
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "sector": "Technology",
      "currency": "USD",
      "shares": 4,
      "avgCost": 172.5,
      "sellPrice": 215,
      "realized": 170,
      "returnPct": 0.2463768115942029
    },
    {
      "date": "2026-04-02",
      "ticker": "SHOP.TO",
      "name": "Shopify Inc.",
      "sector": "Technology",
      "currency": "CAD",
      "shares": 15,
      "avgCost": 130,
      "sellPrice": 118,
      "realized": -180,
      "returnPct": -0.09230769230769231
    },
    {
      "date": "2026-03-12",
      "ticker": "NVDA",
      "name": "NVIDIA Corp.",
      "sector": "Technology",
      "currency": "USD",
      "shares": 5,
      "avgCost": 120,
      "sellPrice": 175,
      "realized": 275,
      "returnPct": 0.4583333333333333
    }
  ]
};
SAMPLE.updated = new Date().toISOString();

const state = { holdings: [], sells: [], fx: { CAD: 1, USD: 1.4 }, invested: {}, sector: "All", group: true, sortKey: "valueCad", sortDir: -1, allSells: false };

const $ = (id) => document.getElementById(id);
const money = (n, cur = "CAD") => n == null || isNaN(n) ? "–" :
  n.toLocaleString("en-CA", { style: "currency", currency: cur, maximumFractionDigits: 2 });
const pct = (n) => n == null || isNaN(n) ? "–" : (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
const cls = (n) => n == null || isNaN(n) ? "" : n >= 0 ? "gain" : "loss";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rate = (cur) => state.fx[cur] ?? 1;
const toCad = (n, cur) => (n == null ? null : n * rate(cur));
const fmtDate = (d) => !d || d.startsWith("1970") ? "–" :
  new Date(d + "T12:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

function enrichHolding(h) {
  const cost = h.avg * h.shares;
  const value = h.price != null ? h.price * h.shares : null;
  const gain = value != null ? value - cost : null;
  return {
    ...h, cost, value, gain,
    roi: value != null && cost ? gain / cost : null,
    costCad: toCad(cost, h.currency),
    valueCad: toCad(value, h.currency),
    gainCad: toCad(gain, h.currency),
  };
}

function enrichSell(s) {
  return { ...s, realizedCad: toCad(s.realized, s.currency) };
}

function totals(list) {
  const priced = list.filter((h) => h.valueCad != null);
  const value = priced.reduce((a, h) => a + h.valueCad, 0);
  const cost = priced.reduce((a, h) => a + h.costCad, 0);
  return { value, cost, gain: value - cost, roi: cost ? (value - cost) / cost : null };
}

function setText(id, text, c) {
  $(id).textContent = text;
  if (c !== undefined) $(id).className = "value " + c;
}

function renderSummary() {
  const t = totals(state.holdings);
  setText("s-value", money(t.value));
  setText("s-cost", money(t.cost));
  setText("s-gain", money(t.gain), cls(t.gain));
  setText("s-roi", pct(t.roi), cls(t.roi));

  const realized = state.sells.reduce((a, s) => a + s.realizedCad, 0);
  const total = realized + t.gain;
  const investedCad = Object.entries(state.invested).reduce((a, [cur, amt]) => a + toCad(amt, cur), 0);
  setText("f-real", money(realized), cls(realized));
  setText("f-total", money(total), cls(total));
  setText("f-roi", investedCad ? pct(total / investedCad) : "–", cls(investedCad ? total : null));
  const wins = state.sells.filter((s) => s.realized > 0).length;
  setText("f-closed", String(state.sells.length));
  $("f-win").textContent = state.sells.length ? `${Math.round((wins / state.sells.length) * 100)}% profitable` : "";
}

function sectorList() {
  return [...new Set(state.holdings.map((h) => h.sector || "Other"))].sort();
}

function renderAlloc() {
  const sectors = sectorList();
  const total = state.holdings.reduce((a, h) => a + (h.valueCad ?? h.costCad), 0) || 1;
  let bar = "", legend = "";
  sectors.forEach((s, i) => {
    const sum = state.holdings.filter((h) => (h.sector || "Other") === s).reduce((a, h) => a + (h.valueCad ?? h.costCad), 0);
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

const curTag = () => ""; // US$ already marks USD amounts; plain $ is CAD

function rowHtml(h) {
  return `<tr>
    <td><span class="ticker">${esc(h.ticker)}</span><div class="name">${esc(h.name)}</div></td>
    <td>${esc(h.sector || "Other")}</td>
    <td>${h.shares.toLocaleString("en-CA", { maximumFractionDigits: 4 })}</td>
    <td>${money(h.avg, h.currency)}${curTag(h.currency)}</td>
    <td>${money(h.price, h.currency)}${curTag(h.currency)}</td>
    <td>${money(h.valueCad)}</td>
    <td class="${cls(h.gainCad)}">${money(h.gainCad)}</td>
    <td class="${cls(h.roi)}"><strong>${pct(h.roi)}</strong></td>
    <td class="muted-cell">${fmtDate(h.buyDate)}</td>
  </tr>`;
}

function renderRows() {
  const list = state.holdings.filter((h) => state.sector === "All" || (h.sector || "Other") === state.sector);
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
        <td class="num ${cls(t.roi)}">${pct(t.roi)}</td><td></td></tr>`;
      html += items.map(rowHtml).join("");
    });
  } else {
    html = [...list].sort(cmp).map(rowHtml).join("");
  }
  $("rows").innerHTML = html || `<tr><td colspan="9" style="text-align:center;color:#6b7587">No holdings to show yet.</td></tr>`;
}

function renderSells() {
  const shown = state.allSells ? state.sells : state.sells.slice(0, 10);
  $("sellRows").innerHTML = shown.map((s) => `<tr>
    <td class="muted-cell">${fmtDate(s.date)}</td>
    <td><span class="ticker">${esc(s.ticker)}</span><div class="name">${esc(s.name)}</div></td>
    <td>${s.shares.toLocaleString("en-CA", { maximumFractionDigits: 4 })}</td>
    <td>${money(s.avgCost, s.currency)}${curTag(s.currency)}</td>
    <td>${money(s.sellPrice, s.currency)}${curTag(s.currency)}</td>
    <td class="${cls(s.realizedCad)}">${money(s.realizedCad)}</td>
    <td class="${cls(s.returnPct)}"><strong>${pct(s.returnPct)}</strong></td>
  </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:#6b7587">No sells recorded yet.</td></tr>`;
  const more = $("moreSells");
  more.hidden = state.sells.length <= 10;
  more.textContent = state.allSells ? "Show fewer" : `Show all ${state.sells.length} sells`;
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
    state.fx = data.fx || { CAD: 1, USD: 1.4 };
    state.invested = data.invested || {};
    state.holdings = data.holdings.map(enrichHolding);
    state.sells = (data.sells || []).map(enrichSell);

    if (data.demo) setStatus("Showing sample data. Connect your Google Sheet and price API key to go live (see README).");
    else if (data.warnings && data.warnings.length) setStatus("Heads up: " + esc(data.warnings.join(" · ")));

    $("fxnote").textContent = `All totals in CAD. 1 USD = ${rate("USD").toFixed(4)} CAD (${state.fx.source || "rate"}${state.fx.date ? ", " + state.fx.date : ""}).`;
    $("updated").textContent = (data.demo ? "Sample prices. " : "Prices last refreshed " + new Date(data.updated).toLocaleString("en-CA") + ". Quotes refresh about every 15 minutes and may be delayed.");
    renderSummary(); renderAlloc(); renderChips(); renderRows(); renderSells();
  } catch (e) {
    setStatus("Couldn't load the portfolio right now. Please try again shortly.", "error");
    console.error(e);
  }
}

document.querySelectorAll("#holdings-table thead th").forEach((th) =>
  th.addEventListener("click", () => {
    const k = th.dataset.k;
    state.sortDir = state.sortKey === k ? -state.sortDir : (k === "ticker" || k === "sector" ? 1 : -1);
    state.sortKey = k;
    renderRows();
  })
);
$("group").addEventListener("change", (e) => { state.group = e.target.checked; renderRows(); });
$("moreSells").addEventListener("click", () => { state.allSells = !state.allSells; renderSells(); });

load();
