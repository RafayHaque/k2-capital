// K2 Capital: event cards, shared by the Home and Events pages. Needs events-data.js.

function eventHtml(e) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const d = new Date(e.date + "T12:00:00");
  const meta = [e.time, e.location].filter(Boolean).map(esc).join(" · ");
  return `<article class="event">
    <div class="date"><span class="mon">${d.toLocaleDateString("en-CA", { month: "short" })}</span><span class="day">${d.getDate()}</span></div>
    <div class="body">
      <div class="tags"><span class="tag t-${esc(e.type)}">${esc(EVENT_TYPES[e.type] || e.type)}</span>${e.sample ? '<span class="tag sample">Sample</span>' : ""}</div>
      <h3>${esc(e.title)}</h3>
      ${meta ? `<div class="name">${meta}</div>` : ""}
      ${e.description ? `<p>${esc(e.description)}</p>` : ""}
      ${e.link ? `<a href="${esc(e.link)}" rel="noopener">Details &rarr;</a>` : ""}
    </div>
  </article>`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const upcomingEvents = (n, type) => EVENTS
  .filter((e) => e.date >= todayIso() && (!type || e.type === type))
  .sort((a, b) => (a.date < b.date ? -1 : 1))
  .slice(0, n || 99);

function renderEventCards(el, list, emptyText) {
  el.innerHTML = list.length ? list.map(eventHtml).join("") : `<div class="empty">${emptyText}</div>`;
}
