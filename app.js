// K2 Capital: Portfolio page. Needs site.js, sample-data.js and k2.js loaded first.

const { $, money, money0, pct, cls, esc, fmtDate, setValue, setText, totals } = K2;
const PALETTE = ["#495a30", "#c9a227", "#8c2f39", "#2a7f9e", "#8e5ea2", "#d2691e", "#4b5563", "#9bb36b", "#c2185b", "#00897b"];
const state = { data: null, holdings: [], sells: [], perf: null, sector: "All", group: true, sortKey: "valueCad", sortDir: -1, allSells: false, chartMode: "value" };

// ---------- Fund performance ----------

function renderPerf() {
  const f = state.data.fund, p = state.perf;
  if (f) {
    setValue("p-worth", money(f.nav));
    setText("p-worth-sub", "equity · holdings worth " + money0(f.holdingsValue));
    setValue("p-gain", money(f.gain), cls(f.gain));
    setText("p-gain-sub", `${money0(f.realized)} realized · ${money0(f.unrealized)} unrealized` + (f.income ? ` · ${money0(f.income)} interest` : ""));
    setValue("p-since", f.returnOnCapital == null ? "–" : pct(f.returnOnCapital), cls(f.returnOnCapital));
    setText("p-since-sub", "gain ÷ capital contributed");
    setValue("p-ytd", money(f.contributed));
    setText("p-ytd-sub", "deposits less withdrawals");
  } else {
    ["p-worth", "p-gain", "p-since", "p-ytd"].forEach((id) => setValue(id, "–", ""));
    setText("p-worth-sub", "Fund tab not connected");
  }
  const ok = !!(p && p.points.length > 1);
  $("perf-empty").hidden = ok;
  $("perf-block").hidden = !ok;
  if (!ok) return;
  setText("perf-note", "Weekly snapshots of portfolio worth. Dashed line shows money contributed to the fund.");
  drawChart();
}

function renderEarlier() {
  const f = state.data.fund;
  const list = f ? (f.byStock || f.prior || []) : [];
  $("earlier-block").hidden = !list.length;
  if (!list.length) return;
  setValue("e-real", money(f.realized), cls(f.realized));
  setText("e-real-sub", "earlier results + sells logged since");
  setValue("e-win", String(list.filter((x) => x.amount > 0).length));
  setValue("e-lose", String(list.filter((x) => x.amount < 0).length));
  $("earlierRows").innerHTML = list.map((x) => `<tr><td><span class="ticker">${esc(x.ticker)}</span></td><td class="${cls(x.amount)}">${money(x.amount)}</td></tr>`).join("");
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function drawChart() {
  const host = $("chart");
  const pts = state.perf && state.perf.points;
  if (!pts || !pts.length) { host.innerHTML = ""; return; }

  const mode = state.chartMode;
  const W = Math.max(host.clientWidth, 320), H = 320, m = { l: 58, r: 16, t: 14, b: 30 };
  const t = pts.map((p) => new Date(p.date + "T12:00:00").getTime());
  const main = pts.map((p) => (mode === "value" ? p.nav : p.cum * 100));
  const extra = mode === "value" ? pts.map((p) => p.contributed) : [];
  let lo = Math.min(...main, ...extra), hi = Math.max(...main, ...extra);
  if (mode === "return") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  if (mode === "value" && lo < 0) lo = 0;

  const x = (v) => m.l + ((v - t[0]) / ((t[t.length - 1] - t[0]) || 1)) * (W - m.l - m.r);
  const y = (v) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const step = niceStep((hi - lo) / 5);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const fmtY = (v) => mode === "value"
    ? v.toLocaleString("en-CA", { style: "currency", currency: "CAD", notation: "compact", maximumFractionDigits: 1 })
    : v.toFixed(0) + "%";

  const line = main.map((v, i) => `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(t[t.length - 1]).toFixed(1)},${y(lo).toFixed(1)}L${x(t[0]).toFixed(1)},${y(lo).toFixed(1)}Z`;
  const contrib = extra.length ? "M" + extra.map((v, i) => `${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`).join("L") : "";

  const labelIdx = [0, 1, 2, 3, 4].map((k) => Math.round((k * (pts.length - 1)) / 4)).filter((v, i, a) => a.indexOf(v) === i);
  const xl = labelIdx.map((i) => {
    const d = new Date(t[i]);
    const anchor = i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle";
    return `<text x="${x(t[i]).toFixed(1)}" y="${H - 8}" text-anchor="${anchor}" class="ax">${d.toLocaleDateString("en-CA", { month: "short", year: "numeric" })}</text>`;
  }).join("");

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Fund performance chart">
      ${ticks.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${m.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="ax">${fmtY(v)}</text>`).join("")}
      ${mode === "return" ? `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/>` : ""}
      <path d="${area}" class="area"/>
      ${contrib ? `<path d="${contrib}" class="contrib"/>` : ""}
      <path d="${line}" class="series"/>
      ${xl}
      <line id="hx" class="hx" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0" hidden/>
      <circle id="hd" class="hd" r="4.5" hidden/>
      <rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" id="hit"/>
    </svg><div class="tip" id="tip" hidden></div>`;

  const hit = $("hit"), hx = $("hx"), hd = $("hd"), tip = $("tip");
  const show = (ev) => {
    const box = host.getBoundingClientRect();
    const px = (ev.clientX - box.left) * (W / box.width);
    let best = 0;
    t.forEach((v, i) => { if (Math.abs(x(v) - px) < Math.abs(x(t[best]) - px)) best = i; });
    const p = pts[best], cx = x(t[best]), cy = y(main[best]);
    hx.setAttribute("x1", cx); hx.setAttribute("x2", cx); hd.setAttribute("cx", cx); hd.setAttribute("cy", cy);
    hx.hidden = hd.hidden = tip.hidden = false;
    tip.innerHTML = `<strong>${fmtDate(p.date)}</strong><br>` + (mode === "value"
      ? `Worth ${money(p.nav)}<br><span class="muted-cell">Contributed ${money(p.contributed)}</span>`
      : `Return ${pct(p.cum)}<br><span class="muted-cell">Worth ${money(p.nav)}</span>`);
    const left = Math.min(Math.max((cx / W) * box.width - 70, 4), box.width - 150);
    tip.style.left = left + "px";
    tip.style.top = Math.max((cy / H) * box.height - 70, 0) + "px";
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", () => { hx.hidden = hd.hidden = tip.hidden = true; });
}


// ---------- Weekly summary ----------

// Weeks come from the Performance tab (one row per week). Without it, calendar weeks (Mon to Sun) are used.
function weekPeriods() {
  const p = state.perf;
  if (p && p.points.length > 1) {
    return p.points.slice(1).map((pt, i) => ({
      start: p.points[i].date, end: pt.date, // trades with start < date <= end belong to this week
      pct: pt.periodPct, gain: pt.nav - p.points[i].nav - pt.flow, flow: pt.flow, cum: pt.cum, nav: pt.nav,
    })).reverse();
  }
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // this Monday
  for (let i = 0; i < 12; i++) {
    const mon = new Date(d); mon.setDate(d.getDate() - i * 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const prev = new Date(mon); prev.setDate(mon.getDate() - 1);
    const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    out.push({ start: iso(prev), end: iso(sun), pct: null, gain: null, flow: 0, cum: null, nav: null });
  }
  return out;
}

function renderWeekSelect() {
  state.weeks = weekPeriods();
  $("week-select").innerHTML = state.weeks.map((w, i) => `<option value="${i}">${fmtDate(w.end)}</option>`).join("");
  renderWeek();
}

function renderWeek() {
  const w = state.weeks[+$("week-select").value || 0];
  if (!w) { $("week-block").hidden = true; return; }
  const trades = (state.data.trades || []).filter((t) => t.date > w.start && t.date <= w.end);
  const buys = trades.filter((t) => t.side === "BUY").length, sells = trades.filter((t) => t.side === "SELL").length;
  const realized = state.sells.filter((s) => s.date > w.start && s.date <= w.end).reduce((a, s) => a + s.realizedCad, 0);

  setValue("w-ret", pct(w.pct), cls(w.pct));
  setText("w-ret-sub", w.pct == null ? "needs Performance tab" : "time-weighted");
  setValue("w-gain", w.gain == null ? "–" : money(w.gain), cls(w.gain));
  setText("w-gain-sub", w.flow ? `excludes ${money0(w.flow)} ${w.flow > 0 ? "deposit" : "withdrawal"}` : "");
  setValue("w-trades", String(trades.length));
  setText("w-trades-sub", `${buys} buy${buys === 1 ? "" : "s"} · ${sells} sell${sells === 1 ? "" : "s"}`);
  setValue("w-real", sells ? money(realized) : "–", cls(sells ? realized : null));
  setText("w-real-sub", sells ? `from ${sells} sell${sells === 1 ? "" : "s"}` : "no sells");
  setValue("w-since", w.nav ? money(w.nav) : "–");
  setText("w-since-sub", w.nav ? "total fund, end of week" : "");

  $("week-trades-wrap").hidden = !trades.length;
  $("weekRows").innerHTML = trades.map((t) => `<tr>
    <td class="muted-cell">${fmtDate(t.date)}</td>
    <td><span class="side ${t.side === "BUY" ? "buy" : "sell"}">${t.side}</span></td>
    <td><span class="ticker">${esc(t.ticker)}</span><div class="name">${esc(t.name)}</div></td>
    <td>${t.shares.toLocaleString("en-CA", { maximumFractionDigits: 4 })}</td>
    <td>${money(t.price, t.currency)}</td>
    <td>${money(state.data.toCad(t.shares * t.price, t.currency))}</td>
  </tr>`).join("");
  $("week-note").textContent = (trades.length ? "" : "No trades this week. ") + "Week return and gain are for the whole fund, so they include price moves on every holding, not only this week's trades. Realized gain counts sells only.";
}

// ---------- Current holdings ----------

function renderHoldingsSummary() {
  const t = totals(state.holdings);
  setValue("s-value", money(t.value));
  setValue("s-cost", money(t.cost));
  setValue("s-gain", money(t.gain), cls(t.gain));
  setValue("s-roi", pct(t.roi), cls(t.roi));

  const nav = state.data.fund ? state.data.fund.nav : null;
  if (nav && t.value) {
    const lev = t.value / nav;
    setValue("s-lev", lev.toFixed(2) + "x");
    setText("s-lev-sub", lev > 1 ? `about ${money0(t.value - nav)} borrowed` : `about ${Math.round((1 - lev) * 100)}% cash`);
  } else {
    setValue("s-lev", "–");
    setText("s-lev-sub", "needs Fund tab");
  }
}

const sectorList = () => [...new Set(state.holdings.map((h) => h.sector || "Other"))].sort();

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
  $("chips").innerHTML = ["All", ...sectorList()]
    .map((s) => `<button class="chip ${s === state.sector ? "on" : ""}" data-s="${esc(s)}">${esc(s)}</button>`).join(" ");
  $("chips").querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => { state.sector = b.dataset.s; renderChips(); renderRows(); }));
}

const rowHtml = (h) => `<tr>
    <td><span class="ticker">${esc(h.ticker)}</span><div class="name">${esc(h.name)}</div></td>
    <td>${esc(h.sector || "Other")}</td>
    <td>${h.shares.toLocaleString("en-CA", { maximumFractionDigits: 4 })}</td>
    <td>${money(h.avg, h.currency)}</td>
    <td>${money(h.price, h.currency)}</td>
    <td>${money(h.valueCad)}</td>
    <td class="${cls(h.gainCad)}">${money(h.gainCad)}</td>
    <td class="${cls(h.roi)}"><strong>${pct(h.roi)}</strong></td>
    <td class="muted-cell">${fmtDate(h.buyDate)}</td>
  </tr>`;

function renderRows() {
  const list = state.holdings.filter((h) => state.sector === "All" || (h.sector || "Other") === state.sector);
  const k = state.sortKey, d = state.sortDir;
  const val = (h) => (h[k] == null ? -Infinity : h[k]);
  const cmp = (a, b) => (typeof a[k] === "string" ? a[k].localeCompare(b[k]) * d : (val(a) - val(b)) * d);
  let html = "";
  if (state.group) {
    [...new Set(list.map((h) => h.sector || "Other"))].sort().forEach((s) => {
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

// ---------- Sells ----------

function renderSells() {
  const realized = state.sells.reduce((a, s) => a + s.realizedCad, 0);
  const wins = state.sells.filter((s) => s.realized > 0).length;
  setValue("r-real", state.sells.length ? money(realized) : "–", cls(state.sells.length ? realized : null));
  setValue("r-count", String(state.sells.length));
  setValue("r-win", state.sells.length ? Math.round((wins / state.sells.length) * 100) + "%" : "–");

  const shown = state.allSells ? state.sells : state.sells.slice(0, 10);
  $("sellRows").innerHTML = shown.map((s) => `<tr>
    <td class="muted-cell">${fmtDate(s.date)}</td>
    <td><span class="ticker">${esc(s.ticker)}</span><div class="name">${esc(s.name)}</div></td>
    <td>${s.shares.toLocaleString("en-CA", { maximumFractionDigits: 4 })}</td>
    <td>${money(s.avgCost, s.currency)}</td>
    <td>${money(s.sellPrice, s.currency)}</td>
    <td class="${cls(s.realizedCad)}">${money(s.realizedCad)}</td>
    <td class="${cls(s.returnPct)}"><strong>${pct(s.returnPct)}</strong></td>
  </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:#6b7587">No sells recorded yet.</td></tr>`;
  const more = $("moreSells");
  more.hidden = state.sells.length <= 10;
  more.textContent = state.allSells ? "Show fewer" : `Show all ${state.sells.length} sells`;
}

// ---------- Load ----------

function setStatus(msg, kind) {
  $("status").innerHTML = msg ? `<div class="banner ${kind || ""}">${msg}</div>` : "";
}

async function load() {
  try {
    const data = await K2.load();
    Object.assign(state, { data, holdings: data.holdings, sells: data.sells, perf: data.performance || null });
    if (data.demo) setStatus("Showing sample data. Connect your Google Sheet and price API key to go live (see README).");
    else if (data.warnings && data.warnings.length) setStatus("Heads up: " + esc(data.warnings.join(" · ")));

    $("fxnote").textContent = `Holdings are in CAD. 1 USD = ${data.rate("USD").toFixed(4)} CAD (${data.fx.source || "rate"}${data.fx.date ? ", " + data.fx.date : ""}).`;
    $("updated").textContent = data.demo ? "Sample prices." : "Prices last refreshed " + new Date(data.updated).toLocaleString("en-CA") + ". Quotes refresh about every 15 minutes and may be delayed.";
    // Each section is drawn on its own so one problem can't blank the whole page.
    const problems = [];
    [renderPerf, renderEarlier, renderWeekSelect, renderHoldingsSummary, renderAlloc, renderChips, renderRows, renderSells].forEach((fn) => {
      try { fn(); } catch (err) { console.error(fn.name, err); problems.push(fn.name + ": " + err.message); }
    });
    if (problems.length) setStatus("Part of the page failed to draw (" + esc(problems.join("; ")) + ")", "error");
  } catch (e) {
    setStatus("Couldn't load the portfolio (" + esc(e.message || e) + "). Open /api/portfolio on this site to see the details.", "error");
    console.error(e);
  }
}

document.querySelectorAll("#holdings-table thead th").forEach((th) =>
  th.addEventListener("click", () => {
    const k = th.dataset.k;
    state.sortDir = state.sortKey === k ? -state.sortDir : (k === "ticker" || k === "sector" ? 1 : -1);
    state.sortKey = k;
    renderRows();
  }));
$("week-select").addEventListener("change", renderWeek);
$("group").addEventListener("change", (e) => { state.group = e.target.checked; renderRows(); });
$("moreSells").addEventListener("click", () => { state.allSells = !state.allSells; renderSells(); });
document.querySelectorAll("#chart-modes .chip").forEach((b) => b.addEventListener("click", () => {
  state.chartMode = b.dataset.mode;
  document.querySelectorAll("#chart-modes .chip").forEach((c) => c.classList.toggle("on", c === b));
  drawChart();
}));
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 120); });

load();
