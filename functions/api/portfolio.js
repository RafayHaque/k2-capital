// Cloudflare Pages Function: GET /api/portfolio
//
// Reads the club's trades from a Google Sheet "Transactions" tab (published as CSV),
// works out open positions (average cost method) and realized gains on sells,
// fetches current prices (Finnhub, with a Yahoo fallback) and the USD->CAD rate,
// and returns everything as JSON. Cached for 15 minutes.
//
// Environment variables (Cloudflare Pages > Settings > Variables and secrets):
//   TRANSACTIONS_CSV_URL  published CSV link of the Transactions tab (preferred)
//   SHEET_CSV_URL         legacy Holdings tab link (still works if Transactions is not set)
//   FINNHUB_KEY           Finnhub API key
//   USDCAD_RATE           optional: fixed USD->CAD rate instead of the automatic one

const CACHE_SECONDS = 900;
const EPS = 1e-9;

// ---------- CSV ----------

// Minimal CSV parser (handles quoted fields and commas inside quotes).
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const normHeader = (h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");
const num = (s) => parseFloat(String(s ?? "").replace(/[$,\s]/g, ""));

// Accepts 2025-09-15, 9/15/2025, 15-Sep-2025, "Sep 15, 2025". Returns YYYY-MM-DD or "".
export function parseDate(s) {
  s = String(s ?? "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // month/day/year (Google Sheets US format)
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(s + " UTC");
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

// Transactions tab columns (any order, case-insensitive):
// date, ticker, name, sector, side (BUY/SELL), shares, price, currency (USD/CAD), fees
export function rowsToTransactions(rows) {
  const out = { transactions: [], skipped: [] };
  if (!rows.length) return out;
  const head = rows[0].map(normHeader);
  const col = (r, name) => { const i = head.indexOf(name); return i >= 0 ? (r[i] || "").trim() : ""; };

  rows.slice(1).forEach((r, k) => {
    const side = col(r, "side").toUpperCase();
    const t = {
      date: parseDate(col(r, "date")),
      ticker: col(r, "ticker").toUpperCase(),
      name: col(r, "name"),
      sector: col(r, "sector"),
      side: side.startsWith("B") ? "BUY" : side.startsWith("S") ? "SELL" : "",
      shares: num(col(r, "shares")),
      price: num(col(r, "price")),
      currency: (col(r, "currency") || "USD").toUpperCase(),
      fees: num(col(r, "fees")) || 0,
    };
    if (t.date && t.ticker && t.side && t.shares > 0 && isFinite(t.price)) out.transactions.push(t);
    else out.skipped.push(k + 2); // sheet row number
  });
  return out;
}

// Old Holdings tab (ticker, name, sector, shares, buy_price, buy_date) treated as BUY rows.
export function rowsToLegacyTransactions(rows) {
  const out = { transactions: [], skipped: [] };
  if (!rows.length) return out;
  const head = rows[0].map(normHeader);
  const col = (r, name) => { const i = head.indexOf(name); return i >= 0 ? (r[i] || "").trim() : ""; };
  rows.slice(1).forEach((r, k) => {
    const t = {
      date: parseDate(col(r, "buy_date")) || "1970-01-01",
      ticker: col(r, "ticker").toUpperCase(),
      name: col(r, "name"),
      sector: col(r, "sector"),
      side: "BUY",
      shares: num(col(r, "shares")),
      price: num(col(r, "buy_price")),
      currency: (col(r, "currency") || "USD").toUpperCase(),
      fees: 0,
    };
    if (t.ticker && t.shares > 0 && isFinite(t.price)) out.transactions.push(t);
    else out.skipped.push(k + 2);
  });
  return out;
}

// ---------- Portfolio maths (average cost method) ----------

export function buildPortfolio(transactions) {
  const sorted = transactions
    .map((t, i) => ({ ...t, i }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i));

  const pos = {};
  const sellsRaw = [];
  const invested = {}; // total cost of every purchase, by currency
  const warnings = [];

  for (const t of sorted) {
    const p = (pos[t.ticker] ??= { ticker: t.ticker, name: "", sector: "", currency: t.currency, shares: 0, cost: 0, buyDate: "" });
    if (t.name) p.name = t.name;
    if (t.sector) p.sector = t.sector;
    if (t.currency !== p.currency) warnings.push(`${t.ticker}: mixed currencies (${p.currency} and ${t.currency}), check the sheet`);

    if (t.side === "BUY") {
      if (p.shares <= EPS) { p.shares = 0; p.cost = 0; p.buyDate = t.date; } // a new position starts
      const c = t.shares * t.price + t.fees;
      p.shares += t.shares;
      p.cost += c;
      invested[t.currency] = (invested[t.currency] || 0) + c;
    } else {
      if (p.shares <= EPS) { warnings.push(`${t.ticker}: sell on ${t.date} but no shares held`); continue; }
      let q = t.shares;
      if (q > p.shares + EPS) { warnings.push(`${t.ticker}: sold more than held on ${t.date}`); q = p.shares; }
      const avg = p.cost / p.shares;
      const fee = t.fees * (q / t.shares);
      const gross = q * t.price;
      const basis = q * avg;
      sellsRaw.push({
        date: t.date, ticker: t.ticker, name: p.name, sector: p.sector || "Other", currency: p.currency,
        shares: q, gross, basis, realized: gross - fee - basis,
      });
      p.cost -= basis;
      p.shares -= q;
      if (p.shares <= EPS) { p.shares = 0; p.cost = 0; }
    }
  }

  // One row per ticker per day.
  const merged = {};
  for (const s of sellsRaw) {
    const k = s.ticker + "|" + s.date;
    const m = (merged[k] ??= { ...s, shares: 0, gross: 0, basis: 0, realized: 0 });
    m.shares += s.shares; m.gross += s.gross; m.basis += s.basis; m.realized += s.realized;
  }
  const sells = Object.values(merged)
    .map((m) => ({
      date: m.date, ticker: m.ticker, name: m.name, sector: m.sector, currency: m.currency,
      shares: m.shares, avgCost: m.basis / m.shares, sellPrice: m.gross / m.shares,
      realized: m.realized, returnPct: m.basis ? m.realized / m.basis : null,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.ticker.localeCompare(b.ticker)));

  const holdings = Object.values(pos)
    .filter((p) => p.shares > EPS)
    .map((p) => ({
      ticker: p.ticker, name: p.name, sector: p.sector || "Other", currency: p.currency,
      shares: p.shares, avg: p.cost / p.shares, buyDate: p.buyDate,
    }));

  return { holdings, sells, invested, warnings };
}

// ---------- Prices and FX ----------

async function finnhubPrice(ticker, key) {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const q = await res.json();
  if (!q || !q.c) throw new Error("no price");
  return q.c;
}

// Unofficial, no key. Only used when Finnhub has no price (for example TSX tickers like RY.TO).
async function yahooPrice(ticker) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!p) throw new Error("no price");
  return p;
}

async function getPrice(ticker, key) {
  try { return await finnhubPrice(ticker, key); }
  catch { return await yahooPrice(ticker); }
}

async function getUsdCad(env) {
  if (env.USDCAD_RATE && +env.USDCAD_RATE > 0) return { rate: +env.USDCAD_RATE, source: "set manually" };
  for (const url of [
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD",
    "https://api.frankfurter.app/latest?from=USD&to=CAD",
  ]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.rates?.CAD > 0) return { rate: j.rates.CAD, date: j.date, source: "European Central Bank via Frankfurter" };
    } catch { /* try next */ }
  }
  return { rate: 1.4, source: "estimate", failed: true };
}

// ---------- Demo data (shown until the sheet is connected) ----------

export const SAMPLE_TRANSACTIONS = [
  { date: "2025-09-15", ticker: "AAPL", name: "Apple Inc.", sector: "Technology", side: "BUY", shares: 10, price: 172.5, currency: "USD", fees: 0 },
  { date: "2025-09-15", ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", side: "BUY", shares: 8, price: 150.2, currency: "USD", fees: 0 },
  { date: "2025-10-02", ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", side: "BUY", shares: 6, price: 380, currency: "USD", fees: 0 },
  { date: "2025-10-20", ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", side: "BUY", shares: 5, price: 120, currency: "USD", fees: 0 },
  { date: "2025-11-10", ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care", side: "BUY", shares: 7, price: 160, currency: "USD", fees: 0 },
  { date: "2026-01-08", ticker: "SHOP.TO", name: "Shopify Inc.", sector: "Technology", side: "BUY", shares: 15, price: 130, currency: "CAD", fees: 0 },
  { date: "2026-01-20", ticker: "XOM", name: "Exxon Mobil", sector: "Energy", side: "BUY", shares: 12, price: 104, currency: "USD", fees: 0 },
  { date: "2026-02-03", ticker: "RY.TO", name: "Royal Bank of Canada", sector: "Financials", side: "BUY", shares: 20, price: 138, currency: "CAD", fees: 0 },
  { date: "2026-03-12", ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", side: "SELL", shares: 5, price: 175, currency: "USD", fees: 0 },
  { date: "2026-04-02", ticker: "SHOP.TO", name: "Shopify Inc.", sector: "Technology", side: "SELL", shares: 15, price: 118, currency: "CAD", fees: 0 },
  { date: "2026-05-15", ticker: "AAPL", name: "Apple Inc.", sector: "Technology", side: "SELL", shares: 4, price: 215, currency: "USD", fees: 0 },
];
export const SAMPLE_PRICES = { AAPL: 228.1, MSFT: 415.3, JPM: 211.4, JNJ: 152.6, XOM: 111.9, "RY.TO": 165.2 };

export function demoResponse() {
  const p = buildPortfolio(SAMPLE_TRANSACTIONS);
  return {
    demo: true,
    updated: new Date().toISOString(),
    warnings: [],
    fx: { USD: 1.4, CAD: 1, source: "sample rate" },
    invested: p.invested,
    holdings: p.holdings.map((h) => ({ ...h, price: SAMPLE_PRICES[h.ticker] ?? null })),
    sells: p.sells,
  };
}

// ---------- Handler ----------

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` },
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const sheetUrl = env.TRANSACTIONS_CSV_URL || env.SHEET_CSV_URL;
  if (!sheetUrl || !env.FINNHUB_KEY) return json(demoResponse());

  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/portfolio", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const sheetRes = await fetch(sheetUrl);
    if (!sheetRes.ok) throw new Error("Could not read the Google Sheet (HTTP " + sheetRes.status + ")");
    const rows = parseCsv(await sheetRes.text());
    const parsed = env.TRANSACTIONS_CSV_URL ? rowsToTransactions(rows) : rowsToLegacyTransactions(rows);
    const p = buildPortfolio(parsed.transactions);
    const warnings = [...p.warnings];
    if (parsed.skipped.length) warnings.push(`Skipped incomplete sheet rows: ${parsed.skipped.slice(0, 10).join(", ")}`);

    const fx = await getUsdCad(env);
    if (fx.failed) warnings.push("USD to CAD rate unavailable, using an estimate");

    const prices = {};
    const missing = [];
    await Promise.all(
      [...new Set(p.holdings.map((h) => h.ticker))].map(async (t) => {
        try { prices[t] = await getPrice(t, env.FINNHUB_KEY); }
        catch { missing.push(t); }
      })
    );
    if (missing.length) warnings.push("No price found for " + missing.join(", "));

    const unsupported = [...new Set(p.holdings.map((h) => h.currency))].filter((c) => c !== "USD" && c !== "CAD");
    if (unsupported.length) warnings.push("Unsupported currency: " + unsupported.join(", ") + " (use USD or CAD)");

    const response = json({
      demo: false,
      updated: new Date().toISOString(),
      warnings,
      fx: { USD: fx.rate, CAD: 1, date: fx.date, source: fx.source },
      invested: p.invested,
      holdings: p.holdings.map((h) => ({ ...h, price: prices[h.ticker] ?? null })),
      sells: p.sells,
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
