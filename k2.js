// K2 Capital: shared data loading and formatting, used by the Home and Portfolio pages.
// Positions, average prices, realized gains and performance are computed in functions/api/portfolio.js.

const K2 = (() => {
  const $ = (id) => document.getElementById(id);
  const money = (n, cur = "CAD") => n == null || isNaN(n) ? "–" :
    n.toLocaleString("en-CA", { style: "currency", currency: cur, maximumFractionDigits: 2 });
  const money0 = (n) => n == null || isNaN(n) ? "–" :
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  const pct = (n) => n == null || isNaN(n) ? "–" : (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
  const cls = (n) => n == null || isNaN(n) ? "" : n >= 0 ? "gain" : "loss";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => !d || d.startsWith("1970") ? "–" :
    new Date(d + "T12:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  const setValue = (id, text, c) => { const el = $(id); if (!el) return; el.textContent = text; if (c !== undefined) el.className = "value " + c; };
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  async function fetchData() {
    try {
      if (location.protocol === "file:") throw new Error("no server");
      const res = await fetch("/api/portfolio");
      if (res.status === 404) throw new Error("no function");
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      // Opened as a local file, or no function deployed yet: use sample data.
      if (location.protocol === "file:" || String(e.message) === "no function") return { ...window.K2_SAMPLE, updated: new Date().toISOString() };
      throw e;
    }
  }

  // Returns the data with CAD conversion and per-holding maths added.
  async function load() {
    const data = await fetchData();
    const fx = data.fx || { CAD: 1, USD: 1.4 };
    const rate = (cur) => fx[cur] ?? 1;
    const toCad = (n, cur) => (n == null ? null : n * rate(cur));

    const holdings = data.holdings.map((h) => {
      const cost = h.avg * h.shares;
      const value = h.price != null ? h.price * h.shares : null;
      const gain = value != null ? value - cost : null;
      return { ...h, cost, value, gain, roi: value != null && cost ? gain / cost : null,
        costCad: toCad(cost, h.currency), valueCad: toCad(value, h.currency), gainCad: toCad(gain, h.currency) };
    });
    const sells = (data.sells || []).map((s) => ({ ...s, realizedCad: toCad(s.realized, s.currency) }));
    return { ...data, fx, holdings, sells, rate, toCad };
  }

  function totals(list) {
    const priced = list.filter((h) => h.valueCad != null);
    const value = priced.reduce((a, h) => a + h.valueCad, 0);
    const cost = priced.reduce((a, h) => a + h.costCad, 0);
    return { value, cost, gain: value - cost, roi: cost ? (value - cost) / cost : null };
  }

  return { $, money, money0, pct, cls, esc, fmtDate, setValue, setText, load, totals };
})();
