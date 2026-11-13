// Cloudflare Pages Function: GET /api/portfolio
//
// 1. Reads the holdings from a Google Sheet published as CSV  (env: SHEET_CSV_URL)
// 2. Looks up current prices from Finnhub                      (env: FINNHUB_KEY)
// 3. Returns merged JSON, cached for 15 minutes so free-tier limits are never a problem.
//
// If the env vars are missing, sample data is returned so the site still renders.

const CACHE_SECONDS = 900;

const DEMO = {
  demo: true,
  updated: new Date().toISOString(),
  warnings: [],
  holdings: [
    { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", shares: 10, buy: 172.5, price: 228.1 },
    { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", shares: 6, buy: 380.0, price: 415.3 },
    { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", shares: 8, buy: 150.2, price: 211.4 },
    { ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care", shares: 7, buy: 160.0, price: 152.6 },
    { ticker: "XOM", name: "Exxon Mobil", sector: "Energy", shares: 12, buy: 104.0, price: 111.9 },
  ],
};

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

// Turns CSV rows into holdings. Expected header (case-insensitive):
// ticker, name, sector, shares, buy_price, buy_date
export function rowsToHoldings(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const idx = (name) => head.indexOf(name);
  const get = (r, name) => (idx(name) >= 0 ? (r[idx(name)] || "").trim() : "");
  const num = (s) => parseFloat(String(s).replace(/[$,\s]/g, ""));

  return rows.slice(1).map((r) => ({
    ticker: get(r, "ticker").toUpperCase(),
    name: get(r, "name"),
    sector: get(r, "sector") || "Other",
    shares: num(get(r, "shares")),
    buy: num(get(r, "buy_price")),
    buyDate: get(r, "buy_date"),
  })).filter((h) => h.ticker && isFinite(h.shares) && isFinite(h.buy));
}

async function fetchPrice(ticker, key) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
  const q = await res.json();
  // Finnhub returns c = current price (0 when the symbol is unknown or not covered)
  if (!q || !q.c) throw new Error(`${ticker}: no price`);
  return q.c;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;

  if (!env.SHEET_CSV_URL || !env.FINNHUB_KEY) return json({ ...DEMO, updated: new Date().toISOString() });

  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/portfolio", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const sheetRes = await fetch(env.SHEET_CSV_URL);
    if (!sheetRes.ok) throw new Error("Could not read the Google Sheet (HTTP " + sheetRes.status + ")");
    const holdings = rowsToHoldings(parseCsv(await sheetRes.text()));

    const tickers = [...new Set(holdings.map((h) => h.ticker))];
    const prices = {};
    const warnings = [];
    await Promise.all(
      tickers.map(async (t) => {
        try { prices[t] = await fetchPrice(t, env.FINNHUB_KEY); }
        catch (e) { warnings.push(t); }
      })
    );

    const body = {
      demo: false,
      updated: new Date().toISOString(),
      warnings,
      holdings: holdings.map((h) => ({ ...h, price: prices[h.ticker] ?? null })),
    };
    const response = json(body);
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
